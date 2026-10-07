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
  /**
   * Validates whether an authorization letter is required and present.
   * Throws AUTHORIZATION_LETTER_REQUIRED (400) if relationship is Authorized Representative and no letter exists.
   */
  static validateAuthorizationLetterRequirement(relationship, attachments = []) {
    if (relationship === "Authorized Representative") {
      const hasAuthLetter = Array.isArray(attachments) && attachments.some(
        (a) => a && a.category === "authorization_letter"
      );
      if (!hasAuthLetter) {
        const error = new Error(
          "An authorization letter is required when requesting documents as an Authorized Representative."
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
      relationship: requestData.relationship,
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
            relationship: (requestData.relationship || "Self").trim(),
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

      // 3. Enforce Authorization Letter requirement for Authorized Representatives
      if (request.relationship === "Authorized Representative") {
        const authLetter = await tx.requestAttachment.findFirst({
          where: { requestId, category: "authorization_letter" },
        });

        ParishionerRequestService.validateAuthorizationLetterRequirement(
          request.relationship,
          authLetter ? [authLetter] : []
        );
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

      for (const reqId of correctionRequirementIds.filter((id) => id !== "valid_id")) {
        if (!attachmentCategories.includes(reqId)) {
          const error = new Error(`Replacement file for requirement "${reqId}" is missing.`);
          error.statusCode = 400;
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
}
