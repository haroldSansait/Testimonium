import { prisma } from "../config/db.js";
import { ParishionerRequestRepository } from "../repositories/ParishionerRequestRepository.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";
import { DocumentRequirementService } from "./DocumentRequirementService.js";
import { RecipientResolver } from "./RecipientResolver.js";
import {
  CANONICAL_DOCUMENT_TYPES,
  normalizeDocumentType,
  getEffectiveOfferedDocuments,
} from "../config/documents.js";
import {
  IdempotencyService,
  computeRequestPayloadHash,
} from "./IdempotencyService.js";
import { isProfileIncomplete } from "../utils/profileCompleteness.js";
import { buildApplicantName } from "../utils/nameUtils.js";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";
import {
  isSelfRelationship,
  requireCanonicalRelationship,
} from "../config/relationshipEvidence.js";
import { compareSelfRegistrantName, SELF_NAME_MATCH } from "../utils/selfRegistrantNameMatcher.js";
import { DocumentReturnStorageService } from "./DocumentReturnStorageService.js";
import { DocumentReturnReasonCode, DOCUMENT_RETURN_REASONS } from "../shared/constants.js";
import { FileValidator } from "../utils/fileValidator.js";
import { logger } from "../config/logger.js";

export async function assertParishionerOwnerRole(userId, client = prisma) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: { role: true, governmentIdVerification: true },
  });
  const isParishioner = Boolean(
    user && (
      user.role?.roleName === "PARISHIONER" ||
      (!user.role && (!user.roleId || user.roleId === 1))
    )
  );
  if (!isParishioner) {
    const error = new Error("Parishioner document-request access is restricted to parishioner accounts.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
  return user;
}

export class ParishionerRequestService {
  static validateSelfRegistrantName(relationship, applicantName, authoritativeProfileName) {
    if (!isSelfRelationship(relationship)) return { outcome: "NOT_APPLICABLE" };
    const result = compareSelfRegistrantName(authoritativeProfileName, applicantName);
    if (result.outcome === SELF_NAME_MATCH.UNAVAILABLE) {
      const error = new Error("Your verified profile name is unavailable. Please update your profile and verify your Government ID before submitting a Self request.");
      error.statusCode = 409;
      error.code = "SELF_REGISTRANT_NAME_UNAVAILABLE";
      throw error;
    }
    if (result.outcome === SELF_NAME_MATCH.MISMATCH) {
      const error = new Error("The registrant name does not appear to match your verified profile name. Please check the name or select the appropriate relationship if you are requesting a document for someone else.");
      error.statusCode = 400;
      error.code = "SELF_REGISTRANT_NAME_MISMATCH";
      throw error;
    }
    return result;
  }

  /**
   * Validates whether an authorization letter is required and present.
   * Throws AUTHORIZATION_LETTER_REQUIRED (400) for any non-Self relationship without a letter.
   */
  static validateAuthorizationLetterRequirement(relationship, attachments = []) {
    if (!isSelfRelationship(relationship)) {
      const hasAuthLetter = Array.isArray(attachments) && attachments.some(
        (a) => a && a.category === "authorization_letter"
      );
      if (!hasAuthLetter) {
        const error = new Error(
          "An authorization letter is required when requesting a document for another person."
        );
        error.code = "AUTHORIZATION_LETTER_REQUIRED";
        error.statusCode = 400;
        throw error;
      }
    }
    return true;
  }

  constructor(parishionerRequestRepository = new ParishionerRequestRepository()) {
    this.parishionerRequestRepository = parishionerRequestRepository;
  }

  /**
   * Creates a new request in Draft state, supporting user-scoped idempotent creation.
   */
  async createDraft(userId, requestData, idempotencyKey = null) {
    const normalizedDocType = normalizeDocumentType(requestData.documentType);
    if (!normalizedDocType) {
      const error = new Error(`Unsupported document type "${requestData.documentType}".`);
      error.statusCode = 400;
      throw error;
    }

    const canonicalRelationship = requireCanonicalRelationship(requestData.relationship, { allowOmitted: true });
    const numericParishId = parseInt(requestData.parishId, 10);
    if (isNaN(numericParishId)) {
      const error = new Error("Invalid parish ID.");
      error.statusCode = 400;
      throw error;
    }

    const user = await assertParishionerOwnerRole(userId);
    if (isProfileIncomplete(user)) {
      const error = new Error("Please complete your profile details (full name and contact number) before requesting documents.");
      error.statusCode = 403;
      error.code = "PROFILE_INCOMPLETE";
      throw error;
    }
    if (!isEffectivelyVerified(user.governmentIdVerification)) {
      const error = new Error("Please verify your Government ID before requesting documents.");
      error.statusCode = 403;
      error.code = "IDENTITY_NOT_VERIFIED";
      throw error;
    }

    let resolvedApplicantName = typeof requestData.applicantName === "string" ? requestData.applicantName.trim() : "";
    if (requestData.applicantFirstName && requestData.applicantLastName) {
      resolvedApplicantName = buildApplicantName({
        firstName: requestData.applicantFirstName,
        middleName: requestData.applicantMiddleName,
        lastName: requestData.applicantLastName,
      });
    }

    if (!resolvedApplicantName) {
      const error = new Error("Applicant name is required.");
      error.statusCode = 400;
      error.code = "INVALID_APPLICANT_NAME";
      throw error;
    }

    if (resolvedApplicantName.length > 150) {
      const error = new Error("Applicant name must not exceed 150 characters.");
      error.statusCode = 400;
      error.code = "INVALID_APPLICANT_NAME";
      throw error;
    }

    // Canonical applicant name populated on requestData
    requestData.applicantName = resolvedApplicantName;

    const hasValidKey = IdempotencyService.isValidKey(idempotencyKey);
    const payloadHash = computeRequestPayloadHash({
      parishId: numericParishId,
      documentType: normalizedDocType,
      applicantName: resolvedApplicantName,
      relationship: canonicalRelationship,
      purpose: requestData.purpose,
    });

    const executeCreate = async () => {
      return await prisma.$transaction(async (tx) => {
        // 1. If idempotency key provided, check for existing record in transaction
        if (hasValidKey) {
          const existingRecord = await IdempotencyService.findRecord(
            userId,
            idempotencyKey,
            "DOCUMENT_REQUEST_CREATE",
            tx
          );

          if (existingRecord) {
            if (existingRecord.payloadHash === payloadHash) {
              // Recover and return existing draft
              const existingDraft = await tx.documentRequest.findFirst({
                where: { id: existingRecord.resourceId, userId },
                include: {
                  parish: {
                    select: {
                      id: true,
                      parishName: true,
                      type: true,
                      municipalityCity: true,
                      province: true,
                    },
                  },
                  attachments: true,
                  requestHistory: true,
                },
              });
              if (existingDraft) {
                return existingDraft;
              }
            } else {
              // Different payload with same key => 409 Conflict
              const conflictErr = new Error(
                "Idempotency key conflict: This key was already used with a different request payload."
              );
              conflictErr.statusCode = 409;
              throw conflictErr;
            }
          }
        }

        // 2. Validate parish and offerings
        const parish = await tx.parish.findUnique({
          where: { id: numericParishId },
        });

        if (!parish) {
          const error = new Error("Selected parish does not exist.");
          error.statusCode = 404;
          throw error;
        }

        const effectiveOffered = getEffectiveOfferedDocuments(parish.availableDocuments);
        if (!effectiveOffered.includes(normalizedDocType)) {
          const error = new Error(
            `The requested document type "${normalizedDocType}" is not currently offered by ${parish.parishName}.`
          );
          error.statusCode = 400;
          throw error;
        }

        // 3. Resolve fee snapshot from parish document requirements configuration
        const reqConfig = await DocumentRequirementService.getRequirements(normalizedDocType, numericParishId);
        const feeSnapshot = reqConfig?.baseFee !== undefined ? parseFloat(reqConfig.baseFee) : 100.00;

        // 4. Validate dynamic required fields
        if (reqConfig?.requiredFields) {
          for (const field of reqConfig.requiredFields) {
            // Obsolete/duplicate personal name requirement is already canonically validated above
            if (
              field.id === "applicantName" ||
              field.id === "applicant_name" ||
              (typeof field.label === "string" && field.label.toLowerCase().includes("baptized person"))
            ) {
              continue;
            }
            if (field.required) {
              const val = requestData[field.id];
              if (!val || (typeof val === "string" && val.trim() === "")) {
                const fieldErr = new Error(`Required field "${field.label || field.id}" is required.`);
                fieldErr.statusCode = 400;
                throw fieldErr;
              }
            }
          }
        }

        // 5. Create request with isDraft: true and authoritative fee snapshot
        const draft = await tx.documentRequest.create({
          data: {
            userId,
            parishId: numericParishId,
            documentType: normalizedDocType,
            applicantName: resolvedApplicantName,
            relationship: canonicalRelationship,
            purpose: (requestData.purpose || "").trim(),
            isDraft: true,
            status: "PENDING",
            fee: feeSnapshot,
          },
        });

        // Generate tracking number using SR-YYYY-000000 sequence
        const year = new Date().getFullYear();
        const trackingNumber = `SR-${year}-${String(draft.id).padStart(6, "0")}`;

        // Update draft with tracking number
        const updatedDraft = await tx.documentRequest.update({
          where: { id: draft.id },
          data: { trackingNumber },
          include: {
            parish: {
              select: {
                id: true,
                parishName: true,
                type: true,
                municipalityCity: true,
                province: true,
              },
            },
            attachments: true,
            requestHistory: true,
          },
        });

        // 6. Record idempotency key inside transaction (throws on race conflict)
        if (hasValidKey) {
          await IdempotencyService.recordKey(
            {
              userId,
              key: idempotencyKey,
              resourceType: "DOCUMENT_REQUEST_CREATE",
              resourceId: updatedDraft.id,
              payloadHash,
            },
            tx
          );
        }

        // Create history entry
        await tx.requestHistory.create({
          data: {
            requestId: updatedDraft.id,
            actorId: userId,
            action: "DRAFT_CREATED",
            remarks: "Draft request initialized",
          },
        });

        await AuditLogService.log(
          userId,
          "Document Request Draft Created",
          tx,
          false,
          {
            affectedTable: "document_requests",
            affectedRecordId: updatedDraft.id,
            parishId: updatedDraft.parishId,
            metadata: {
              trackingNumber,
            },
          }
        );

        return updatedDraft;
      }, { maxWait: 10000, timeout: 20000 });
    };

    try {
      return await executeCreate();
    } catch (err) {
      // If a concurrent transaction won the idempotency key race, recover the winning draft
      if (hasValidKey && IdempotencyService.isUniqueConstraintError(err)) {
        const winningRecord = await IdempotencyService.findRecord(
          userId,
          idempotencyKey,
          "DOCUMENT_REQUEST_CREATE",
          prisma
        );
        if (winningRecord) {
          if (winningRecord.payloadHash === payloadHash) {
            const winningDraft = await prisma.documentRequest.findFirst({
              where: { id: winningRecord.resourceId, userId },
              include: {
                parish: {
                  select: {
                    id: true,
                    parishName: true,
                    type: true,
                    municipalityCity: true,
                    province: true,
                  },
                },
                attachments: true,
                requestHistory: true,
              },
            });
            if (winningDraft) {
              return winningDraft;
            }
          } else {
            const conflictErr = new Error(
              "Idempotency key conflict: This key was already used with a different request payload."
            );
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
        }
      }
      throw err;
    }
  }

  /**
   * Finalizes and submits a draft request.
   */
  async submitDraft(requestId, userId) {
    return prisma.$transaction(async (tx) => {
      const user = await assertParishionerOwnerRole(userId, tx);
      if (isProfileIncomplete(user)) {
        const error = new Error("Please complete your profile details (full name and contact number) before submitting document requests.");
        error.statusCode = 403;
        error.code = "PROFILE_INCOMPLETE";
        throw error;
      }
      if (!isEffectivelyVerified(user.governmentIdVerification)) {
        const error = new Error("Please verify your Government ID before submitting document requests.");
        error.statusCode = 403;
        error.code = "IDENTITY_NOT_VERIFIED";
        throw error;
      }

      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${Number(requestId)} FOR UPDATE`;
      }
      const request = await tx.documentRequest.findFirst({
        where: { id: requestId, userId },
      });

      if (!request) {
        const error = new Error("Request not found or does not belong to this user.");
        error.statusCode = 404;
        throw error;
      }

      if (!request.isDraft) {
        const error = new Error("Request has already been submitted.");
        error.statusCode = 400;
        throw error;
      }

      // The requester name comes only from the authenticated server-side profile.
      ParishionerRequestService.validateSelfRegistrantName(
        request.relationship,
        request.applicantName,
        user.fullName
      );

      // Check authoritative requirements for this parish and document type
      const reqConfig = await DocumentRequirementService.getRequirements(request.documentType, request.parishId);

      // 1. Verify required form fields
      if (reqConfig?.requiredFields) {
        for (const field of reqConfig.requiredFields) {
          // Obsolete/duplicate personal name requirement is already canonically stored on request
          if (
            field.id === "applicantName" ||
            field.id === "applicant_name" ||
            (typeof field.label === "string" && field.label.toLowerCase().includes("baptized person"))
          ) {
            continue;
          }
          if (field.required) {
            const val = request[field.id];
            if (!val || (typeof val === "string" && val.trim() === "")) {
              const error = new Error(`Cannot submit request: Required field "${field.label || field.id}" is missing.`);
              error.statusCode = 400;
              throw error;
            }
          }
        }
      }

      // 2. Verify all required document requirements exist (authoritative requirement IDs)
      const requiredDocs = (reqConfig?.requiredDocuments || []).filter((d) => d.required);
      if (requiredDocs.length > 0) {
        const attachments = await tx.requestAttachment.findMany({
          where: { requestId },
        });
        const uploadedRequirementIds = new Set(attachments.map((a) => a.category));

        // Effective Government ID verification automatically satisfies valid_id requirement
        if (isEffectivelyVerified(user.governmentIdVerification)) {
          uploadedRequirementIds.add("valid_id");
        }

        const missing = [];
        for (const reqDoc of requiredDocs) {
          if (!uploadedRequirementIds.has(reqDoc.id)) {
            missing.push(reqDoc.label || reqDoc.id);
          }
        }

        if (missing.length > 0) {
          const error = new Error(`Cannot submit request without required attachments: ${missing.join(", ")}`);
          error.statusCode = 400;
          throw error;
        }
      }

      // 3. Enforce relationship evidence from the persisted relationship.
      if (!isSelfRelationship(request.relationship)) {
        const authLetter = await tx.requestAttachment.findFirst({
          where: { requestId, category: "authorization_letter" },
        });

        ParishionerRequestService.validateAuthorizationLetterRequirement(
          request.relationship,
          authLetter ? [authLetter] : []
        );

        const evidence = await tx.registrantIdEvidence.findUnique({
          where: { requestId },
        });
        const missing = [];
        if (!evidence?.frontObjectKey) missing.push("front");
        if (!evidence?.backObjectKey) missing.push("back");
        if (missing.length > 0) {
          const error = new Error(`Registrant Government ID evidence is incomplete. Missing: ${missing.join(", ")}.`);
          error.statusCode = 400;
          error.code = "REGISTRANT_ID_REQUIRED";
          error.details = { missing };
          throw error;
        }
        if (!evidence.frontSha256 || !evidence.backSha256 || evidence.frontSha256 === evidence.backSha256) {
          const error = new Error("Registrant Government ID front and back evidence is invalid.");
          error.statusCode = 400;
          error.code = "DUPLICATE_ID_IMAGE";
          throw error;
        }
      }

      // Finalize and flip isDraft to false
      const submittedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          isDraft: false,
          status: "PENDING", // Enforce initial review state
        },
      });

      // Log to request history
      const submitHistory = await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: "SUBMITTED",
          oldStatus: "PENDING", // status before submit (in draft)
          newStatus: "PENDING", // status after submit
          remarks: "Parishioner finalized and submitted the request",
        },
      });

      // Parishioner-initiated submission: notify parishioner + admins
      await RequestNotificationService.notifyStatusChange(
        userId,
        submittedRequest.parishId,
        submittedRequest.id,
        submittedRequest.trackingNumber,
        "DRAFT",
        "PENDING",
        tx,
        true, // notifyAdmins: new request visible to Secretary and Coordinator
        submitHistory.id
      );

      await AuditLogService.log(
        userId,
        "Document Request Submitted",
        tx,
        false,
        {
          affectedTable: "document_requests",
          affectedRecordId: submittedRequest.id,
          parishId: submittedRequest.parishId,
          previousValues: {
            isDraft: true,
            status: "PENDING",
          },
          newValues: {
            isDraft: false,
            status: "PENDING",
          },
          metadata: {
            trackingNumber: submittedRequest.trackingNumber,
          },
        }
      );

      return submittedRequest;
    }, { maxWait: 10000, timeout: 20000 });
  }

  /**
   * Cancels a document request. Can be initiated by parishioner or staff.
   */
  async cancelRequest(requestId, userId, remarks = "Cancelled by requester") {
    return prisma.$transaction(async (tx) => {
      await assertParishionerOwnerRole(userId, tx);
      const request = await tx.documentRequest.findFirst({
        where: { id: requestId, userId },
      });

      if (!request) {
        const error = new Error("Request not found or does not belong to this user.");
        error.statusCode = 404;
        throw error;
      }

      const currentStatus = request.status;
      const targetStatus = "CANCELLED";

      // Verify transition legality
      if (!canTransition(currentStatus, targetStatus)) {
        const error = new Error(`Cannot transition request status from ${currentStatus} to ${targetStatus}`);
        error.statusCode = 400;
        throw error;
      }

      const updatedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: { status: targetStatus },
      });

      // Log request history
      const cancelHistory = await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: "CANCELLED",
          oldStatus: currentStatus,
          newStatus: targetStatus,
          remarks,
        },
      });

      // Parishioner-initiated cancellation: notify parishioner + admins
      await RequestNotificationService.notifyStatusChange(
        userId,
        request.parishId,
        request.id,
        request.trackingNumber,
        currentStatus,
        targetStatus,
        tx,
        true, // notifyAdmins: cancellation affects administrative workload
        cancelHistory.id
      );

      await AuditLogService.log(
        userId,
        "Document Request Cancelled",
        tx,
        false,
        {
          affectedTable: "document_requests",
          affectedRecordId: updatedRequest.id,
          parishId: updatedRequest.parishId,
          previousValues: {
            status: currentStatus,
          },
          newValues: {
            status: targetStatus,
          },
          metadata: {
            trackingNumber: request.trackingNumber,
          },
        }
      );

      return updatedRequest;
    }, { maxWait: 10000, timeout: 20000 });
  }

  /**
   * Lists requests for a parishioner, paginated and filtered.
   */
  async listRequests(userId, filters) {
    await assertParishionerOwnerRole(userId);
    return this.parishionerRequestRepository.findMany({
      userId,
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
      status: filters.status,
      documentType: filters.documentType,
    });
  }

  /**
   * Retrieves a single request by ID.
   */
  async getRequestById(id, userId) {
    await assertParishionerOwnerRole(userId);
    const request = await this.parishionerRequestRepository.findById(id, userId);
    if (!request) {
      const error = new Error("Request not found.");
      error.statusCode = 404;
      throw error;
    }
    return request;
  }

  /**
   * Retrieves a single request by tracking number.
   */
  async getRequestByTrackingNumber(trackingNumber, userId) {
    await assertParishionerOwnerRole(userId);
    const request = await this.parishionerRequestRepository.findByTrackingNumber(trackingNumber, userId);
    if (!request) {
      const error = new Error("Request tracking number not found.");
      error.statusCode = 404;
      throw error;
    }
    return request;
  }

  /**
   * Resubmits corrected document requirements.
   */
  async resubmitCorrections(requestId, userId) {
    return prisma.$transaction(async (tx) => {
      const user = await assertParishionerOwnerRole(userId, tx);
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${Number(requestId)} FOR UPDATE`;
      }
      // 1. Verify ownership
      const request = await tx.documentRequest.findFirst({
        where: { id: requestId, userId },
      });

      if (!request) {
        const error = new Error("Request not found or does not belong to this user.");
        error.statusCode = 404;
        throw error;
      }

      // 2. Verify request status is NEEDS_CORRECTION
      if (request.status !== "NEEDS_CORRECTION") {
        const error = new Error("Document request is not in NEEDS_CORRECTION status.");
        error.statusCode = 400;
        throw error;
      }

      const correctionRequirementIds = request.correctionRequirementIds || [];
      const requiresGovernmentIdVerification = correctionRequirementIds.includes("valid_id");
      if (
        requiresGovernmentIdVerification &&
        !isEffectivelyVerified(user.governmentIdVerification)
      ) {
        const error = new Error(
          "Please complete Government ID verification before resubmitting this document request."
        );
        error.statusCode = 403;
        error.code = "IDENTITY_NOT_VERIFIED";
        throw error;
      }

      // 3. Verify attachment-backed replacements exist. Legacy valid_id corrections
      // remain governed by the separate Government ID verification subsystem above.
      const attachments = await tx.requestAttachment.findMany({
        where: { requestId },
      });
      const attachmentCategories = attachments.map((a) => a.category);
      const relationshipCorrectionIds = correctionRequirementIds.filter((id) =>
        ["authorization_letter", "registrant_id_front", "registrant_id_back"].includes(id)
      );
      const correctionSnapshot = relationshipCorrectionIds.length > 0
        ? await tx.relationshipEvidenceCorrection.findFirst({
            where: { requestId, completedAt: null },
            orderBy: { requestedAt: "desc" },
          })
        : null;

      if (relationshipCorrectionIds.length > 0 && !correctionSnapshot) {
        const error = new Error("This legacy correction cannot prove replacement evidence. Ask the parish office to restart the correction request.");
        error.statusCode = 409;
        error.code = "RELATIONSHIP_EVIDENCE_CORRECTION_RESTART_REQUIRED";
        throw error;
      }

      for (const reqId of correctionRequirementIds.filter((id) =>
        !["valid_id", "registrant_id_front", "registrant_id_back", "authorization_letter"].includes(id)
      )) {
        if (!attachmentCategories.includes(reqId)) {
          const error = new Error(`Replacement file for requirement "${reqId}" is missing.`);
          error.statusCode = 400;
          throw error;
        }
      }


      if (relationshipCorrectionIds.includes("authorization_letter")) {
        const newestLetter = attachments
          .filter((attachment) => attachment.category === "authorization_letter")
          .sort((a, b) => b.id - a.id)[0];
        if (!newestLetter || newestLetter.id === correctionSnapshot.baselineAuthAttachmentId) {
          const error = new Error("A new Authorization Letter is required for this correction round.");
          error.statusCode = 400;
          error.code = "CORRECTION_REPLACEMENT_REQUIRED";
          throw error;
        }
      }

      if (relationshipCorrectionIds.some((id) => id.startsWith("registrant_id_"))) {
        const evidence = await tx.registrantIdEvidence.findUnique({ where: { requestId } });
        if (relationshipCorrectionIds.includes("registrant_id_front") && (!evidence?.frontObjectKey || evidence.frontRevision <= correctionSnapshot.baselineFrontRevision)) {
          const error = new Error("A new registrant ID front image is required for this correction round.");
          error.statusCode = 400;
          error.code = "CORRECTION_REPLACEMENT_REQUIRED";
          throw error;
        }
        if (relationshipCorrectionIds.includes("registrant_id_back") && (!evidence?.backObjectKey || evidence.backRevision <= correctionSnapshot.baselineBackRevision)) {
          const error = new Error("A new registrant ID back image is required for this correction round.");
          error.statusCode = 400;
          error.code = "CORRECTION_REPLACEMENT_REQUIRED";
          throw error;
        }
      }

      // 4. Transition request to UNDER_REVIEW
      const updatedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          status: "UNDER_REVIEW",
          correctionRequirementIds: [],
          correctionNote: null,
        },
      });

      if (correctionSnapshot) {
        await tx.relationshipEvidenceCorrection.update({ where: { id: correctionSnapshot.id }, data: { completedAt: new Date() } });
      }

      // 5. Create request history entry
      await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: "RESUBMITTED",
          oldStatus: "NEEDS_CORRECTION",
          newStatus: "UNDER_REVIEW",
          remarks: "Parishioner resubmitted corrected documents.",
        },
      });

      // 6. Log to audit trail
      await AuditLogService.log(
        userId,
        "Document Request Corrections Submitted",
        tx,
        false,
        {
          affectedTable: "document_requests",
          affectedRecordId: updatedRequest.id,
          parishId: updatedRequest.parishId,
          previousValues: {
            status: "NEEDS_CORRECTION",
          },
          newValues: {
            status: "UNDER_REVIEW",
          },
          metadata: {
            trackingNumber: request.trackingNumber,
          },
        }
      );

      // 7. Notify Parishioner
      await RequestNotificationService.send(
        userId,
        "Corrections Submitted",
        "Your corrected documents have been submitted successfully and are awaiting review.",
        "IN_APP",
        "DOCUMENT_REQUEST",
        requestId,
        tx
      );

      // 8. Notify Admins (Secretaries & Coordinators)
      const adminIds = await RecipientResolver.getAdminRecipients(request.parishId, tx);
      for (const adminId of adminIds) {
        if (adminId === userId) continue;
        await RequestNotificationService.send(
          adminId,
          "Corrected Documents Resubmitted",
          "Corrected documents have been resubmitted and are ready for review.",
          "IN_APP",
          "DOCUMENT_REQUEST",
          requestId,
          tx
        );
      }

      return updatedRequest;
    }, { maxWait: 10000, timeout: 20000 });
  }
  /**
   * Submits a post-release document return for free correction.
   * COMPLETED -> RETURNED
   */
  async returnDocument({ requestId, userId, reasonCode, notes, file }) {
    if (!file) {
      const error = new Error("A defective document file is required.");
      error.statusCode = 400;
      error.code = "RETURN_FILE_REQUIRED";
      throw error;
    }

    if (!reasonCode || !DOCUMENT_RETURN_REASONS[reasonCode]) {
      const error = new Error("A valid return reason code is required.");
      error.statusCode = 400;
      error.code = "INVALID_RETURN_REASON";
      throw error;
    }

    if (notes && typeof notes === "string" && notes.trim().length > 1000) {
      const error = new Error("Notes cannot exceed 1000 characters.");
      error.statusCode = 400;
      error.code = "NOTES_TOO_LONG";
      throw error;
    }

    FileValidator.validateReturnDocument(file, "file");

    // Preliminary authorization & check before external storage I/O
    const initialRequest = await prisma.documentRequest.findFirst({
      where: { id: Number(requestId), userId: Number(userId) },
    });

    if (!initialRequest) {
      const error = new Error("Document request not found or does not belong to this user.");
      error.statusCode = 404;
      error.code = "REQUEST_NOT_FOUND";
      throw error;
    }

    if (initialRequest.status !== "COMPLETED") {
      const error = new Error("Only completed and released requests can be returned for correction.");
      error.statusCode = 400;
      error.code = "INVALID_REQUEST_STATUS";
      throw error;
    }

    // Determine estimated cycle number for unique object key
    const currentCount = await prisma.documentReturn.count({
      where: { requestId: Number(requestId) },
    });
    const nextCycleCandidate = currentCount + 1;

    // Create opaque object key and upload to private R2 storage
    const objectKey = DocumentReturnStorageService.createObjectKey(
      Number(requestId),
      nextCycleCandidate,
      "returned"
    );

    await DocumentReturnStorageService.upload(objectKey, file);

    // Atomically transition status, persist return cycle, and dispatch notifications
    try {
      return await prisma.$transaction(async (tx) => {
        await assertParishionerOwnerRole(userId, tx);

        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${Number(requestId)} FOR UPDATE`;
        }

        const request = await tx.documentRequest.findFirst({
          where: { id: Number(requestId), userId: Number(userId) },
          include: { parish: true },
        });

        if (!request) {
          const err = new Error("Document request not found.");
          err.statusCode = 404;
          throw err;
        }

        if (request.status !== "COMPLETED") {
          const err = new Error("Document request is not in COMPLETED status.");
          err.statusCode = 400;
          err.code = "INVALID_REQUEST_STATUS";
          throw err;
        }

        const authoritativeCount = await tx.documentReturn.count({
          where: { requestId: Number(requestId) },
        });
        const cycleNumber = authoritativeCount + 1;

        const updateResult = await tx.documentRequest.updateMany({
          where: { id: Number(requestId), status: "COMPLETED" },
          data: { status: "RETURNED" },
        });

        if (updateResult.count === 0) {
          const conflictErr = new Error("Concurrent update conflict. Request is no longer in COMPLETED status.");
          conflictErr.statusCode = 409;
          conflictErr.code = "CONCURRENT_STATUS_CONFLICT";
          throw conflictErr;
        }

        const documentReturn = await tx.documentReturn.create({
          data: {
            requestId: Number(requestId),
            cycleNumber,
            reasonCode,
            notes: notes ? notes.trim() : null,
            returnedObjectKey: objectKey,
            returnedFileName: file.originalname || "returned_document",
            returnedFileType: file.mimetype || "application/octet-stream",
            returnedFileSize: file.size || null,
            returnedByUserId: Number(userId),
          },
          select: {
            id: true,
            requestId: true,
            cycleNumber: true,
            reasonCode: true,
            notes: true,
            returnedFileName: true,
            returnedFileType: true,
            returnedFileSize: true,
            returnedAt: true,
            returnedByUserId: true,
            correctedFileName: true,
            correctedFileType: true,
            correctedFileSize: true,
            correctedAt: true,
            correctedByStaffId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.requestHistory.create({
          data: {
            requestId: Number(requestId),
            actorId: Number(userId),
            action: "DOCUMENT_RETURNED",
            remarks: `Document returned for correction (Cycle ${cycleNumber}). Reason: ${DOCUMENT_RETURN_REASONS[reasonCode] || reasonCode}${notes ? ` - ${notes.trim()}` : ""}`,
          },
        });

        await RequestNotificationService.notifyDocumentReturned({
          parishionerId: Number(userId),
          parishId: request.parishId,
          requestId: Number(requestId),
          trackingNumber: request.trackingNumber,
          reasonLabel: DOCUMENT_RETURN_REASONS[reasonCode] || reasonCode,
          returnCycle: cycleNumber,
          tx,
        });

        return documentReturn;
      }, { maxWait: 10000, timeout: 20000 });
    } catch (dbErr) {
      try {
        await DocumentReturnStorageService.delete(objectKey);
      } catch (cleanupErr) {
        logger.error(
          { cleanupErr, objectKey, requestId },
          "Failed to delete uploaded return document after database transaction error."
        );
      }
      throw dbErr;
    }
  }

  /**
   * Retrieves return cycle history for a request owned by the parishioner.
   */
  async getReturnHistory(requestId, userId) {
    const request = await prisma.documentRequest.findFirst({
      where: { id: Number(requestId), userId: Number(userId) },
    });
    if (!request) {
      const error = new Error("Document request not found or does not belong to this user.");
      error.statusCode = 404;
      throw error;
    }

    return prisma.documentReturn.findMany({
      where: { requestId: Number(requestId) },
      orderBy: { cycleNumber: "asc" },
      select: {
        id: true,
        requestId: true,
        cycleNumber: true,
        reasonCode: true,
        notes: true,
        returnedFileName: true,
        returnedFileType: true,
        returnedFileSize: true,
        returnedAt: true,
        returnedByUserId: true,
        correctedFileName: true,
        correctedFileType: true,
        correctedFileSize: true,
        correctedAt: true,
        correctedByStaffId: true,
        createdAt: true,
        updatedAt: true,
        returnedByUser: {
          select: { id: true, fullName: true },
        },
        correctedByStaff: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  /**
   * Securely streams returned or corrected document files for a request owned by the parishioner.
   */
  async getReturnFileStream(requestId, returnId, type, userId) {
    if (!["returned", "corrected"].includes(type)) {
      const error = new Error("Invalid file type requested.");
      error.statusCode = 400;
      throw error;
    }

    const request = await prisma.documentRequest.findFirst({
      where: { id: Number(requestId), userId: Number(userId) },
    });
    if (!request) {
      const error = new Error("Document request not found or does not belong to this user.");
      error.statusCode = 404;
      throw error;
    }

    const returnRecord = await prisma.documentReturn.findFirst({
      where: { id: Number(returnId), requestId: Number(requestId) },
    });
    if (!returnRecord) {
      const error = new Error("Return cycle record not found for this request.");
      error.statusCode = 404;
      throw error;
    }

    const key = type === "returned" ? returnRecord.returnedObjectKey : returnRecord.correctedObjectKey;
    const fileName = type === "returned" ? returnRecord.returnedFileName : returnRecord.correctedFileName;
    const mimeType = type === "returned" ? returnRecord.returnedFileType : returnRecord.correctedFileType;
    const fileSize = type === "returned" ? returnRecord.returnedFileSize : returnRecord.correctedFileSize;

    if (!key) {
      const error = new Error(`No ${type} document has been uploaded for this return cycle.`);
      error.statusCode = 404;
      throw error;
    }

    const stream = await DocumentReturnStorageService.download(key);
    return {
      stream,
      fileName: fileName || `${type}_document`,
      mimeType: mimeType || "application/octet-stream",
      fileSize,
    };
  }
}
