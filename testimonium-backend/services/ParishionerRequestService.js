import { prisma } from "../config/db.js";
import { ParishionerRequestRepository } from "../repositories/ParishionerRequestRepository.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";

export class ParishionerRequestService {
  constructor(parishionerRequestRepository = new ParishionerRequestRepository()) {
    this.parishionerRequestRepository = parishionerRequestRepository;
  }

  /**
   * Creates a new request in Draft state.
   */
  async createDraft(userId, requestData) {
    return prisma.$transaction(async (tx) => {
      // Create request with isDraft: true
      const draft = await tx.documentRequest.create({
        data: {
          userId,
          parishId: requestData.parishId,
          documentType: requestData.documentType,
          applicantName: requestData.applicantName,
          relationship: requestData.relationship || "Self",
          purpose: requestData.purpose || "",
          isDraft: true,
          status: "PENDING",
        },
      });

      // Generate tracking number using SR-YYYY-000000 sequence
      const year = new Date().getFullYear();
      const trackingNumber = `SR-${year}-${String(draft.id).padStart(6, "0")}`;

      // Update draft with tracking number
      const updatedDraft = await tx.documentRequest.update({
        where: { id: draft.id },
        data: { trackingNumber },
      });

      // Create history entry
      await tx.requestHistory.create({
        data: {
          requestId: updatedDraft.id,
          actorId: userId,
          action: "DRAFT_CREATED",
          remarks: "Draft request initialized",
        },
      });

      await AuditLogService.log(userId, `Created request draft tracking number ${trackingNumber}`, tx);

      return updatedDraft;
    });
  }

  /**
   * Finalizes and submits a draft request.
   */
  async submitDraft(requestId, userId) {
    return prisma.$transaction(async (tx) => {
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

      // Check if there are attachments uploaded (Optional but recommended validation)
      const attachmentCount = await tx.requestAttachment.count({
        where: { requestId },
      });

      if (attachmentCount === 0) {
        const error = new Error("Cannot submit request without supporting attachments.");
        error.statusCode = 400;
        throw error;
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
      await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: "SUBMITTED",
          oldStatus: "PENDING", // status before submit (in draft)
          newStatus: "PENDING", // status after submit
          remarks: "Parishioner finalized and submitted the request",
        },
      });

      // Trigger notification
      await RequestNotificationService.notifyStatusChange(
        userId,
        submittedRequest.id,
        submittedRequest.trackingNumber,
        "DRAFT",
        "PENDING",
        tx
      );

      await AuditLogService.log(userId, `Submitted request ${submittedRequest.trackingNumber}`, tx);

      return submittedRequest;
    });
  }

  /**
   * Cancels a document request. Can be initiated by parishioner or staff.
   */
  async cancelRequest(requestId, userId, remarks = "Cancelled by requester") {
    return prisma.$transaction(async (tx) => {
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
      await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: "CANCELLED",
          oldStatus: currentStatus,
          newStatus: targetStatus,
          remarks,
        },
      });

      // Notify
      await RequestNotificationService.notifyStatusChange(
        userId,
        request.id,
        request.trackingNumber,
        currentStatus,
        targetStatus,
        tx
      );

      await AuditLogService.log(userId, `Cancelled request ${request.trackingNumber}`, tx);

      return updatedRequest;
    });
  }

  /**
   * Lists requests for a parishioner, paginated and filtered.
   */
  async listRequests(userId, filters) {
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
    const request = await this.parishionerRequestRepository.findByTrackingNumber(trackingNumber, userId);
    if (!request) {
      const error = new Error("Request tracking number not found.");
      error.statusCode = 404;
      throw error;
    }
    return request;
  }
}
