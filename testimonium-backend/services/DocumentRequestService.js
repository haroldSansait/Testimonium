import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";
import { prisma } from "../config/db.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";
import { DocumentRequirementService } from "./DocumentRequirementService.js";

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
  async updateStatus(requestId, targetStatus, remarks = "", actorId, actorRole, actorParishId, correctionRequirementIds = []) {
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

      // Idempotency: if request is already in targetStatus, no-op
      if (currentStatus === targetStatus) {
        return request;
      }

      // Authorization & Ownership checks
      if (actorRole === "PARISHIONER") {
        if (targetStatus !== "CANCELLED" || request.userId !== actorId) {
          const error = new Error("Unauthorized to perform this status update.");
          error.statusCode = 403;
          throw error;
        }
      } else if (actorRole === "SECRETARY" || actorRole === "PRIEST") {
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

      // Verify status change legality
      if (!canTransition(currentStatus, targetStatus)) {
        const error = new Error(`Cannot transition document request status from ${currentStatus} to ${targetStatus}`);
        error.statusCode = 400;
        throw error;
      }

      // If Needs Correction, validate requirement IDs
      if (targetStatus === "NEEDS_CORRECTION") {
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

        // Fetch valid requirements for this document type
        const requirementsConfig = await DocumentRequirementService.getRequirements(request.documentType, request.parishId);
        const validRequirementIds = (requirementsConfig.requiredDocuments || []).map(r => r.id);

        for (const id of correctionRequirementIds) {
          if (!validRequirementIds.includes(id)) {
            const error = new Error(`Invalid requirement ID: "${id}" does not belong to document type "${request.documentType}".`);
            error.statusCode = 400;
            throw error;
          }
        }
      }

      // Handle side-effects on Payment Transactions and Request paymentStatus
      let updatePayload = {
        status: targetStatus,
        remarks: remarks || request.remarks,
      };

      if (targetStatus === "NEEDS_CORRECTION") {
        updatePayload.correctionNote = remarks;
        updatePayload.correctionRequirementIds = correctionRequirementIds;
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
          await tx.paymentTransaction.update({
            where: { id: pendingTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          });
        }
        updatePayload.paymentStatus = "UNPAID";
      }

      if (targetStatus === "PROCESSING" && currentStatus === "UNDER_REVIEW") {
        // Direct transition for Zero-Fee or Waived Document Requests
        updatePayload.paymentStatus = "CONFIRMED";
        updatePayload.status = "PROCESSING";
      }

      if (targetStatus === "PAYMENT_VERIFIED") {
        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          include: { receipts: { include: { ocrResult: true } } },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
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

            await AuditLogService.log(
              actorId,
              `DUPLICATE_PAYMENT_OVERRIDE: Verified transaction #${pendingTx.id} with duplicate warning (Conflicting Request: #${duplicateReceipt.ocrResult.duplicateRequestId || "Unknown"})`,
              tx,
              false,
              {
                affectedTable: "PaymentTransaction",
                affectedRecordId: pendingTx.id,
                parishId: request.parishId,
                metadata: JSON.stringify({
                  duplicateReason: duplicateReceipt.ocrResult.duplicateReason,
                  conflictingRequestId: duplicateReceipt.ocrResult.duplicateRequestId,
                }),
              }
            );
          }

          await tx.paymentTransaction.update({
            where: { id: pendingTx.id },
            data: {
              status: "VERIFIED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          });
        }
        updatePayload.paymentStatus = "CONFIRMED";
      } else if (targetStatus === "PAYMENT_PENDING" && currentStatus === "PAYMENT_VERIFIED") {
        // Rollback to pending payment if proof was marked bad
        const verifiedTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "VERIFIED" },
          orderBy: { createdAt: "desc" },
        });

        if (verifiedTx) {
          await tx.paymentTransaction.update({
            where: { id: verifiedTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          });
        }
        updatePayload.paymentStatus = "UNPAID";
        updatePayload.paymentProofObjectKey = null; // Clear proof
      } else if (targetStatus === "REJECTED" || targetStatus === "CANCELLED") {
        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
          await tx.paymentTransaction.update({
            where: { id: pendingTx.id },
            data: {
              status: "REJECTED",
              verifiedById: actorId,
              verifiedAt: new Date(),
            },
          });
        }
        updatePayload.paymentStatus = "UNPAID";
      }

      const updatedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: updatePayload,
      });

      // Log request history
      await tx.requestHistory.create({
        data: {
          requestId,
          actorId,
          action: "STATUS_UPDATED",
          oldStatus: currentStatus,
          newStatus: targetStatus,
          remarks: remarks || `Status updated from ${currentStatus} to ${targetStatus}`,
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
        false // notifyAdmins: staff is performing this action, no admin fan-out
      );

      await AuditLogService.log(
        actorId,
        `Updated document request ${request.trackingNumber} status from ${currentStatus} to ${targetStatus}`,
        tx
      );

      return updatedRequest;
    });
  }
}

