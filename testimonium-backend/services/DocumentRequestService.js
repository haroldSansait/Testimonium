import { DocumentRequestRepository, listInclude } from "../repositories/DocumentRequestRepository.js";
import { prisma } from "../config/db.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { AuditLogService } from "./AuditLogService.js";
import { DocumentRequirementService } from "./DocumentRequirementService.js";
import { env } from "../config/env.js";
import { CORRECTION_REASONS } from "../shared/constants.js";
import { resolveRelationshipEvidence } from "../config/relationshipEvidence.js";
import { DocumentReturnStorageService } from "./DocumentReturnStorageService.js";
import { FileValidator } from "../utils/fileValidator.js";
import { logger } from "../config/logger.js";

export class DocumentRequestService {
  constructor(documentRequestRepository = new DocumentRequestRepository()) {
    this.documentRequestRepository = documentRequestRepository;
  }

  /**
   * Returns a paginated list of document requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search
   * @param {string|undefined} opts.status
   * @param {string|undefined} opts.documentType
   */
  async list({ page = 1, limit = 10, search, status, documentType, parishId } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return this.documentRequestRepository.findMany({
      page: parsedPage,
      limit: parsedLimit,
      search,
      status,
      documentType,
      parishId,
    });
  }

  /**
   * Updates the status of a document request.
   */
  async updateStatus(
    requestId,
    targetStatus,
    remarks = "",
    actorId,
    actorRole,
    actorParishId,
    correctionRequirementIds = [],
    correctionReasonCode = null,
    correctionNote = null
  ) {
    if (actorRole === "PRIEST") {
      const error = new Error("Priests have read-only access to document requests.");
      error.statusCode = 403;
      throw error;
    }

    if (targetStatus === "RETURNED") {
      const error = new Error("The RETURNED status cannot be manually set by staff. Parishioners must submit a return request.");
      error.statusCode = 400;
      error.code = "RETURN_STATUS_PARISHIONER_ONLY";
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const request = await tx.documentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        const error = new Error("Document request not found.");
        error.statusCode = 404;
        throw error;
      }

      const currentStatus = request.status;

      // Authorization & Ownership checks
      if (actorRole === "PARISHIONER") {
        if (targetStatus !== "CANCELLED" || request.userId !== actorId) {
          const error = new Error("Unauthorized to perform this status update.");
          error.statusCode = 403;
          throw error;
        }
      } else if (actorRole === "SECRETARY") {
        if (request.parishId !== actorParishId) {
          const error = new Error("Unauthorized: Request belongs to a different parish.");
          error.statusCode = 403;
          throw error;
        }
      } else if (actorRole !== "DIOCESE_COORDINATOR") {
        const error = new Error("Unauthorized role.");
        error.statusCode = 403;
        throw error;
      }

      // Idempotency is only safe after role and tenant ownership authorization.
      if (currentStatus === targetStatus) {
        return tx.documentRequest.findUnique({
          where: { id: requestId },
          include: listInclude,
        });
      }

      // Verify status change legality
      if (!canTransition(currentStatus, targetStatus)) {
        const error = new Error(`Cannot transition document request status from ${currentStatus} to ${targetStatus}`);
        error.statusCode = 400;
        throw error;
      }

      let updatePayload = {
        status: targetStatus,
        remarks: remarks || request.remarks,
      };
      let paymentTransactionUpdate = null;
      let duplicateOverrideAudit = null;
      let effectiveRemarks = remarks || `Status updated from ${currentStatus} to ${targetStatus}`;
      let correctionContext = null;
      let relationshipCorrectionSnapshot = null;

      if (currentStatus === "RETURNED" && targetStatus === "READY_FOR_PICKUP") {
        const latestReturn = await tx.documentReturn.findFirst({
          where: { requestId },
          orderBy: { cycleNumber: "desc" },
        });
        if (!latestReturn || !latestReturn.correctedObjectKey) {
          const error = new Error("Cannot mark request Ready for Pickup: A corrected document must be uploaded for the active return cycle first.");
          error.statusCode = 400;
          error.code = "CORRECTED_DOCUMENT_REQUIRED";
          throw error;
        }
        correctionContext = {
          returnCycle: latestReturn.cycleNumber,
          isCorrectedReturn: true,
        };
      }

      // If Needs Correction, strictly validate reason, requirement IDs, and optional note
      if (targetStatus === "NEEDS_CORRECTION") {
        if (!correctionReasonCode || !CORRECTION_REASONS[correctionReasonCode]) {
          const error = new Error("A valid correction reason is required.");
          error.statusCode = 400;
          throw error;
        }

        if (!correctionRequirementIds || !Array.isArray(correctionRequirementIds) || correctionRequirementIds.length === 0) {
          const error = new Error("At least one requirement must be selected for correction.");
          error.statusCode = 400;
          throw error;
        }

        // Check for duplicates
        const uniqueIds = new Set(correctionRequirementIds);
        if (uniqueIds.size !== correctionRequirementIds.length) {
          const error = new Error("Duplicate requirement IDs are not allowed.");
          error.statusCode = 400;
          throw error;
        }

        if (uniqueIds.has("valid_id")) {
          const error = new Error(
            "Government ID verification cannot be corrected through the document request attachment workflow."
          );
          error.statusCode = 400;
          error.code = "NON_CORRECTABLE_REQUIREMENT";
          throw error;
        }

        // Fetch valid requirements for this document type
        const requirementsConfig = await DocumentRequirementService.getRequirements(request.documentType, request.parishId);
        const validReqs = requirementsConfig.requiredDocuments || [];
        const reqMap = new Map(validReqs.map(r => [r.id, r.label]));
        for (const evidenceRequirement of resolveRelationshipEvidence(request.relationship)) {
          reqMap.set(evidenceRequirement.id, evidenceRequirement.label);
        }

        for (const id of correctionRequirementIds) {
          if (!reqMap.has(id)) {
            const error = new Error(`Invalid requirement ID: "${id}" does not belong to document type "${request.documentType}".`);
            error.statusCode = 400;
            throw error;
          }
        }

        if (correctionNote !== null && correctionNote !== undefined) {
          if (typeof correctionNote !== "string") {
            const error = new Error("Correction note must be a string.");
            error.statusCode = 400;
            throw error;
          }
          if (correctionNote.trim().length > 1000) {
            const error = new Error("Correction note must not exceed 1000 characters.");
            error.statusCode = 400;
            throw error;
          }
        }

        const reasonLabel = CORRECTION_REASONS[correctionReasonCode];
        const affectedLabels = correctionRequirementIds.map(id => reqMap.get(id)).join(", ");
        const trimmedNote = (correctionNote || "").trim();

        let snapshot = `Reason: ${reasonLabel}\nAffected requirements: ${affectedLabels}`;
        if (trimmedNote) {
          snapshot += `\nAdditional note: ${trimmedNote}`;
        }

        updatePayload.correctionNote = snapshot;
        updatePayload.correctionRequirementIds = correctionRequirementIds;
        updatePayload.remarks = snapshot;
        effectiveRemarks = snapshot;

        correctionContext = {
          reason: reasonLabel,
          affectedRequirements: affectedLabels,
          note: trimmedNote || null,
        };

        const relationshipIds = correctionRequirementIds.filter((id) =>
          ["authorization_letter", "registrant_id_front", "registrant_id_back"].includes(id)
        );
        if (relationshipIds.length > 0) {
          const [evidence, authLetter] = await Promise.all([
            tx.registrantIdEvidence.findUnique({ where: { requestId } }),
            tx.requestAttachment.findFirst({ where: { requestId, category: "authorization_letter" }, orderBy: { id: "desc" } }),
          ]);
          relationshipCorrectionSnapshot = {
            requestId,
            requestedRequirementIds: relationshipIds,
            baselineFrontRevision: evidence?.frontRevision || 0,
            baselineBackRevision: evidence?.backRevision || 0,
            baselineAuthAttachmentId: authLetter?.id || null,
          };
        }
      }

      if (targetStatus === "PAYMENT_NEEDS_CORRECTION") {
        if (!remarks || typeof remarks !== "string" || remarks.trim() === "") {
          const error = new Error("Payment correction note is required.");
          error.statusCode = 400;
          throw error;
        }
        updatePayload.paymentCorrectionNote = remarks.trim();

        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
          paymentTransactionUpdate = {
            where: { id: pendingTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          };
        }
        updatePayload.paymentStatus = "UNPAID";
      }

      if (targetStatus === "PAYMENT_UNDER_REVIEW" && currentStatus === "PAYMENT_NEEDS_CORRECTION") {
        // Staff cannot arbitrarily transition back to PAYMENT_UNDER_REVIEW from PAYMENT_NEEDS_CORRECTION
        // without an authoritative receipt meeting the quality gate.
        const activeReceipt = await tx.receiptUpload.findFirst({
          where: {
            transaction: { requestId },
            isSuperseded: false,
          },
          include: { ocrResult: true },
          orderBy: { attemptVersion: "desc" },
        });

        if (!activeReceipt) {
          const error = new Error("Cannot transition to PAYMENT_UNDER_REVIEW: No active receipt found. Parishioner must upload a valid receipt.");
          error.statusCode = 400;
          throw error;
        }

        if (request.paymentProofObjectKey && activeReceipt.r2ObjectKey !== request.paymentProofObjectKey) {
          const error = new Error("Cannot transition to PAYMENT_UNDER_REVIEW: Canonical payment proof pointer mismatch.");
          error.statusCode = 400;
          throw error;
        }

        const minConfidence = env.ocr?.minConfidence ?? 0.75;
        if (
          activeReceipt.ocrResult?.status === "COMPLETED" &&
          (activeReceipt.ocrResult.confidenceScore ?? 0) < minConfidence
        ) {
          const error = new Error("Cannot bypass payment quality gate: The current receipt failed readability check (< 75%). A newer acceptable receipt re-upload is required.");
          error.statusCode = 400;
          throw error;
        }
      }

      if (targetStatus === "PROCESSING" && currentStatus === "UNDER_REVIEW") {
        // Direct transition for Zero-Fee or Waived Document Requests
        updatePayload.paymentStatus = "CONFIRMED";
        updatePayload.status = "PROCESSING";
      }

      if (targetStatus === "PAYMENT_VERIFIED") {
        if (request.fee === null || request.fee === undefined) {
          const error = new Error("Cannot verify payment: Authoritative request fee amount is unavailable.");
          error.statusCode = 400;
          throw error;
        }

        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          include: { receipts: { include: { ocrResult: true } } },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
          // Quality Gate Validation for Payment Verification:
          // Authoritative receipt must exist, not be superseded, match canonical pointer,
          // and must not have failed the quality gate (< 75%).
          const activeReceipt = pendingTx.receipts?.find((r) => !r.isSuperseded);
          if (activeReceipt) {
            if (request.paymentProofObjectKey && activeReceipt.r2ObjectKey !== request.paymentProofObjectKey) {
              const error = new Error("Cannot verify payment: Canonical payment proof pointer mismatch.");
              error.statusCode = 400;
              throw error;
            }

            const minConfidence = env.ocr?.minConfidence ?? 0.75;
            if (
              activeReceipt.ocrResult?.status === "COMPLETED" &&
              (activeReceipt.ocrResult.confidenceScore ?? 0) < minConfidence
            ) {
              const error = new Error("Cannot verify payment: Current receipt failed quality threshold (< 75%). Re-upload required.");
              error.statusCode = 400;
              throw error;
            }

            if (activeReceipt.ocrResult?.status === "PENDING") {
              const error = new Error("Cannot verify payment: Receipt quality readability check is still in progress.");
              error.statusCode = 400;
              throw error;
            }
          }

          // Check for duplicate receipt/reference warning
          const duplicateReceipt = pendingTx.receipts?.find(r => r.ocrResult?.isDuplicate);
          if (duplicateReceipt) {
            if (actorRole !== "DIOCESE_COORDINATOR") {
              const error = new Error(
                "Cannot verify payment: Duplicate receipt image or reference number detected. Only Diocese Coordinators can override duplicate warnings."
              );
              error.statusCode = 400;
              throw error;
            }

            duplicateOverrideAudit = {
              affectedTable: "payment_transactions",
              affectedRecordId: pendingTx.id,
              parishId: request.parishId,
              metadata: {
                conflictingRequestId: duplicateReceipt.ocrResult.duplicateRequestId || "Unknown",
                duplicateReason: duplicateReceipt.ocrResult.duplicateReason || null,
              },
            };
          }

          paymentTransactionUpdate = {
            where: { id: pendingTx.id },
            data: {
              status: "VERIFIED",
              amount: request.fee,
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          };
        }
        updatePayload.paymentStatus = "CONFIRMED";
      } else if (targetStatus === "PAYMENT_PENDING" && currentStatus === "PAYMENT_VERIFIED") {
        // Rollback to pending payment if proof was marked bad
        const verifiedTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "VERIFIED" },
          orderBy: { createdAt: "desc" },
        });

        if (verifiedTx) {
          paymentTransactionUpdate = {
            where: { id: verifiedTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          };
        }
        updatePayload.paymentStatus = "UNPAID";
        updatePayload.paymentProofObjectKey = null; // Clear proof
      } else if (targetStatus === "REJECTED" || targetStatus === "CANCELLED") {
        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
          paymentTransactionUpdate = {
            where: { id: pendingTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          };
        }
        updatePayload.paymentStatus = "UNPAID";
      }

      const transitionClaim = await tx.documentRequest.updateMany({
        where: { id: requestId, status: currentStatus },
        data: updatePayload,
      });

      if (transitionClaim.count !== 1) {
        const latestRequest = await tx.documentRequest.findUnique({
          where: { id: requestId },
          include: listInclude,
        });
        if (latestRequest?.status === targetStatus) {
          return latestRequest;
        }
        const error = new Error("Document request status changed elsewhere. Reload and try again.");
        error.statusCode = 409;
        error.code = "DOCUMENT_REQUEST_CONCURRENCY_CONFLICT";
        throw error;
      }

      if (relationshipCorrectionSnapshot) {
        await tx.relationshipEvidenceCorrection.create({ data: relationshipCorrectionSnapshot });
      }

      if (duplicateOverrideAudit) {
        await AuditLogService.log(
          actorId,
          "Duplicate Payment Warning Overridden",
          tx,
          false,
          duplicateOverrideAudit
        );
      }
      if (paymentTransactionUpdate) {
        await tx.paymentTransaction.update(paymentTransactionUpdate);
      }

      const updatedRequest = await tx.documentRequest.findUnique({
        where: { id: requestId },
        include: listInclude,
      });

      // Log request history
      const history = await tx.requestHistory.create({
        data: {
          requestId,
          actorId,
          action: "STATUS_UPDATED",
          oldStatus: currentStatus,
          newStatus: targetStatus,
          remarks: effectiveRemarks,
        },
      });

      // Send notification to parishioner (staff-driven transition: no admin fan-out)
      await RequestNotificationService.notifyStatusChange(
        request.userId,
        request.parishId,
        request.id,
        request.trackingNumber,
        currentStatus,
        targetStatus,
        tx,
        false, // notifyAdmins: staff is performing this action, no admin fan-out
        history.id,
        correctionContext
      );

      // When entering READY_FOR_SIGNING: notify active primary parish priest
      if (targetStatus === "READY_FOR_SIGNING") {
        await NotificationDispatcher.notifyPriestReadyForSigning(
          {
            parishId: request.parishId,
            requestId: request.id,
            trackingNumber: request.trackingNumber,
            documentType: request.documentType,
          },
          tx
        );
      }

      await AuditLogService.log(
        actorId,
        "Document Request Status Updated",
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
    });
  }
  /**
   * Uploads a corrected issued document for an active return cycle.
   */
  async uploadCorrectedDocument({ requestId, staffId, staffRole, staffParishId, file }) {
    if (!["SECRETARY", "DIOCESE_COORDINATOR"].includes(staffRole)) {
      const error = new Error(
        staffRole === "PRIEST"
          ? "Priests have read-only access to document requests."
          : "Unauthorized role."
      );
      error.statusCode = 403;
      throw error;
    }

    if (!file) {
      const error = new Error("A corrected document file is required.");
      error.statusCode = 400;
      error.code = "CORRECTED_FILE_REQUIRED";
      throw error;
    }

    FileValidator.validateCorrectedDocument(file, "file");

    const request = await prisma.documentRequest.findUnique({
      where: { id: Number(requestId) },
    });

    if (!request) {
      const error = new Error("Document request not found.");
      error.statusCode = 404;
      throw error;
    }

    if (staffRole === "SECRETARY" && request.parishId !== staffParishId) {
      const error = new Error("Unauthorized: Request belongs to a different parish.");
      error.statusCode = 403;
      throw error;
    }

    if (request.status !== "RETURNED") {
      const error = new Error("Corrected documents can only be uploaded when request is in RETURNED status.");
      error.statusCode = 400;
      error.code = "INVALID_REQUEST_STATUS";
      throw error;
    }

    const activeReturn = await prisma.documentReturn.findFirst({
      where: { requestId: Number(requestId) },
      orderBy: { cycleNumber: "desc" },
    });

    if (!activeReturn) {
      const error = new Error("No active return cycle found for this request.");
      error.statusCode = 400;
      error.code = "NO_ACTIVE_RETURN_CYCLE";
      throw error;
    }

    const objectKey = DocumentReturnStorageService.createObjectKey(
      Number(requestId),
      activeReturn.cycleNumber,
      "corrected"
    );

    await DocumentReturnStorageService.upload(objectKey, file);

    try {
      return await prisma.$transaction(async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${Number(requestId)} FOR UPDATE`;
        }

        const freshRequest = await tx.documentRequest.findUnique({
          where: { id: Number(requestId) },
        });

        if (!freshRequest || freshRequest.status !== "RETURNED") {
          const err = new Error("Request is no longer in RETURNED status.");
          err.statusCode = 409;
          err.code = "CONCURRENT_STATUS_CONFLICT";
          throw err;
        }

        const currentActiveReturn = await tx.documentReturn.findFirst({
          where: { requestId: Number(requestId) },
          orderBy: { cycleNumber: "desc" },
        });

        if (!currentActiveReturn || currentActiveReturn.id !== activeReturn.id) {
          const err = new Error("Active return cycle conflict. A newer cycle exists.");
          err.statusCode = 409;
          err.code = "CONCURRENT_CYCLE_CONFLICT";
          throw err;
        }

        if (currentActiveReturn.correctedObjectKey) {
          const err = new Error("A corrected document has already been committed for this return cycle. Reload to view the current file.");
          err.statusCode = 409;
          err.code = "CORRECTED_DOCUMENT_ALREADY_UPLOADED";
          throw err;
        }

        const correctionClaim = await tx.documentReturn.updateMany({
          where: {
            id: activeReturn.id,
            correctedObjectKey: null,
            correctedRevision: 0,
          },
          data: {
            correctedObjectKey: objectKey,
            correctedFileName: file.originalname || "corrected_document",
            correctedFileType: file.mimetype || "application/octet-stream",
            correctedFileSize: file.size || null,
            correctedAt: new Date(),
            correctedByStaffId: Number(staffId),
            correctedRevision: { increment: 1 },
          },
        });

        if (correctionClaim.count !== 1) {
          const err = new Error("A corrected document has already been committed for this return cycle. Reload to view the current file.");
          err.statusCode = 409;
          err.code = "CORRECTED_DOCUMENT_ALREADY_UPLOADED";
          throw err;
        }

        const updatedReturn = await tx.documentReturn.findUnique({
          where: { id: activeReturn.id },
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
            correctedRevision: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.requestHistory.create({
          data: {
            requestId: Number(requestId),
            actorId: Number(staffId),
            action: "CORRECTED_DOCUMENT_UPLOADED",
            remarks: `Corrected document uploaded for Return Cycle ${activeReturn.cycleNumber} (${file.originalname}).`,
          },
        });

        await AuditLogService.log(
          staffId,
          "Corrected Document Uploaded",
          tx,
          false,
          {
            affectedTable: "document_returns",
            affectedRecordId: updatedReturn.id,
            parishId: freshRequest.parishId,
            metadata: {
              requestId: Number(requestId),
              cycleNumber: activeReturn.cycleNumber,
              fileName: file.originalname,
            },
          }
        );

        return updatedReturn;
      }, { maxWait: 10000, timeout: 20000 });
    } catch (dbErr) {
      try {
        await DocumentReturnStorageService.delete(objectKey);
      } catch (cleanupErr) {
        logger.error(
          { cleanupErr, objectKey, requestId },
          "Failed to delete uploaded corrected document after database error."
        );
      }
      throw dbErr;
    }
  }

  /**
   * Retrieves return cycles for staff review.
   */
  async getReturnHistory(requestId, staffRole, staffParishId) {
    if (!["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"].includes(staffRole)) {
      const error = new Error("Unauthorized role.");
      error.statusCode = 403;
      throw error;
    }

    const request = await prisma.documentRequest.findUnique({
      where: { id: Number(requestId) },
    });

    if (!request) {
      const error = new Error("Document request not found.");
      error.statusCode = 404;
      throw error;
    }

    if (["SECRETARY", "PRIEST"].includes(staffRole) && request.parishId !== staffParishId) {
      const error = new Error("Unauthorized: Request belongs to a different parish.");
      error.statusCode = 403;
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
   * Securely streams returned or corrected document files for authorized staff.
   */
  async getReturnFileStream(requestId, returnId, type, staffRole, staffParishId) {
    if (!["returned", "corrected"].includes(type)) {
      const error = new Error("Invalid file type requested.");
      error.statusCode = 400;
      throw error;
    }

    if (!["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"].includes(staffRole)) {
      const error = new Error("Unauthorized role.");
      error.statusCode = 403;
      throw error;
    }

    const request = await prisma.documentRequest.findUnique({
      where: { id: Number(requestId) },
    });

    if (!request) {
      const error = new Error("Document request not found.");
      error.statusCode = 404;
      throw error;
    }

    if (["SECRETARY", "PRIEST"].includes(staffRole) && request.parishId !== staffParishId) {
      const error = new Error("Unauthorized: Request belongs to a different parish.");
      error.statusCode = 403;
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
