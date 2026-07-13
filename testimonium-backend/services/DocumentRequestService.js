import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";
import { prisma } from "../config/db.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";

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
  async updateStatus(requestId, targetStatus, remarks = "", actorId) {
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

      // Verify status change legality
      if (!canTransition(currentStatus, targetStatus)) {
        const error = new Error(`Cannot transition document request status from ${currentStatus} to ${targetStatus}`);
        error.statusCode = 400;
        throw error;
      }

      // Handle side-effects on Payment Transactions and Request paymentStatus
      let updatePayload = {
        status: targetStatus,
        remarks: remarks || request.remarks,
      };

      if (targetStatus === "PAYMENT_VERIFIED") {
        const pendingTx = await tx.paymentTransaction.findFirst({
          where: { requestId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (pendingTx) {
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

      // Send Notification to user
      await RequestNotificationService.notifyStatusChange(
        request.userId,
        request.id,
        request.trackingNumber,
        currentStatus,
        targetStatus,
        tx
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

