import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { AuditLogService } from './AuditLogService.js';

const VALID_POLICY_TYPES = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY'];

const configurationUnavailable = () => {
  const error = new Error('Authoritative legal policies currently unavailable.');
  error.statusCode = 503;
  error.code = 'LEGAL_POLICY_CONFIGURATION_UNAVAILABLE';
  return error;
};

const serializePolicy = (policy, includeManagementFields = false) => {
  if (!policy || !VALID_POLICY_TYPES.includes(policy.policyType) ||
    !Number.isInteger(policy.revision) || policy.revision < 1 ||
    typeof policy.content !== 'string' || !policy.content.trim() ||
    policy.content.length > 50000 || !(policy.effectiveAt instanceof Date) ||
    Number.isNaN(policy.effectiveAt.getTime())) throw configurationUnavailable();
  const result = {
    policyType: policy.policyType,
    version: `v${policy.revision}.0`,
    revision: policy.revision,
    effectiveAt: policy.effectiveAt.toISOString(),
    content: policy.content,
  };
  if (includeManagementFields) {
    result.updatedBy = policy.updatedBy
      ? { id: policy.updatedBy.id, fullName: policy.updatedBy.fullName }
      : null;
    result.updatedAt = policy.updatedAt instanceof Date ? policy.updatedAt.toISOString() : null;
    result.createdAt = policy.createdAt instanceof Date ? policy.createdAt.toISOString() : null;
  }
  return result;
};

const mapPolicyPair = (policies, includeManagementFields = false) => {
  const terms = policies.find((policy) => policy.policyType === 'TERMS_OF_SERVICE');
  const privacy = policies.find((policy) => policy.policyType === 'PRIVACY_POLICY');
  if (!terms || !privacy) throw configurationUnavailable();
  return {
    termsOfService: serializePolicy(terms, includeManagementFields),
    privacyPolicy: serializePolicy(privacy, includeManagementFields),
  };
};

const normalizeInfrastructureError = (error) => {
  if (error?.code === 'LEGAL_POLICY_CONFIGURATION_UNAVAILABLE' ||
      error?.code === 'LEGAL_POLICY_VERSION_CONFLICT' ||
      error?.code === 'P2002' ||
      (error?.statusCode >= 400 && error?.statusCode < 500)) return error;
  return configurationUnavailable();
};

export class LegalPolicyServiceClass {
  constructor(db = prisma, auditLogService = AuditLogService) {
    this.db = db;
    this.auditLogService = auditLogService;
  }

  async _readPolicyPair(client, includeManagementFields = false) {
    const policies = await client.legalPolicy.findMany(
      includeManagementFields
        ? { include: { updatedBy: { select: { id: true, fullName: true } } } }
        : undefined,
    );
    return mapPolicyPair(policies, includeManagementFields);
  }

  async getCurrentPolicies() {
    try {
      return await this._readPolicyPair(this.db, false);
    } catch (error) {
      throw normalizeInfrastructureError(error);
    }
  }

  async getManagePolicies() {
    try {
      return await this._readPolicyPair(this.db, true);
    } catch (error) {
      throw normalizeInfrastructureError(error);
    }
  }

  async withCurrentPoliciesForAcceptance(callback) {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT policy_type FROM legal_policies
          WHERE policy_type::text IN ('TERMS_OF_SERVICE', 'PRIVACY_POLICY')
          ORDER BY policy_type FOR SHARE
        `;
        return callback(tx, await this._readPolicyPair(tx, false));
      });
    } catch (error) {
      throw normalizeInfrastructureError(error);
    }
  }

  async updatePolicy(policyType, payload, coordinatorId) {
    if (!VALID_POLICY_TYPES.includes(policyType)) {
      const error = new Error(`Invalid policy type: ${policyType}`);
      error.statusCode = 400; error.code = 'INVALID_POLICY_TYPE'; throw error;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      const error = new Error('Payload must be a JSON object.');
      error.statusCode = 400; error.code = 'INVALID_PAYLOAD'; throw error;
    }
    for (const key of Object.keys(payload)) {
      if (!['content', 'expectedRevision'].includes(key)) {
        const error = new Error(`Unknown field: ${key}`);
        error.statusCode = 400; error.code = 'UNEXPECTED_FIELD'; throw error;
      }
    }

    const { content, expectedRevision } = payload;
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      const error = new Error('expectedRevision must be an integer >= 1.');
      error.statusCode = 400; error.code = 'INVALID_EXPECTED_REVISION'; throw error;
    }
    if (typeof content !== 'string' || !content.trim()) {
      const error = new Error('Policy content must be non-empty.');
      error.statusCode = 400; error.code = 'EMPTY_POLICY_CONTENT'; throw error;
    }
    if (content.length > 50000) {
      const error = new Error('Policy content exceeds maximum limit of 50,000 characters.');
      error.statusCode = 400; error.code = 'POLICY_CONTENT_TOO_LARGE'; throw error;
    }

    const normalizedContent = content.trim().replace(/\r\n/g, '\n');
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT policy_type FROM legal_policies
          WHERE policy_type::text = ${policyType} FOR UPDATE
        `;
        const current = await tx.legalPolicy.findUnique({
          where: { policyType },
          include: { updatedBy: { select: { id: true, fullName: true } } },
        });
        if (!current) throw configurationUnavailable();
        if (current.revision !== expectedRevision) {
          const error = new Error(`Policy revision mismatch. Expected ${expectedRevision}, but current revision is ${current.revision}.`);
          error.statusCode = 409; error.code = 'LEGAL_POLICY_VERSION_CONFLICT'; throw error;
        }
        if (normalizedContent === current.content.trim().replace(/\r\n/g, '\n')) {
          return { changed: false, policy: serializePolicy(current, true) };
        }

        const newRevision = current.revision + 1;
        const updateResult = await tx.legalPolicy.updateMany({
          where: { policyType, revision: expectedRevision },
          data: { content: normalizedContent, revision: newRevision, effectiveAt: new Date(), updatedById: coordinatorId },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Policy revision changed while this update was being saved.');
          error.statusCode = 409; error.code = 'LEGAL_POLICY_VERSION_CONFLICT'; throw error;
        }
        const updated = await tx.legalPolicy.findUnique({
          where: { policyType },
          include: { updatedBy: { select: { id: true, fullName: true } } },
        });
        if (!updated) throw configurationUnavailable();

        const oldHash = crypto.createHash('sha256').update(current.content, 'utf8').digest('hex');
        const newHash = crypto.createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
        await this.auditLogService.logOrThrow(coordinatorId, 'Legal Policy Published', tx, false, {
          affectedTable: 'legal_policies', affectedRecordId: null,
          metadata: {
            policyType, oldRevision: current.revision, newRevision,
            oldContentHash: oldHash, newContentHash: newHash,
          },
        });
        return { changed: true, policy: serializePolicy(updated, true) };
      });
    } catch (error) {
      throw normalizeInfrastructureError(error);
    }
  }
}

export const LegalPolicyService = new LegalPolicyServiceClass();
