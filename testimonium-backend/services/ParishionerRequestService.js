import { prisma } from "../config/db.js";
import { ParishionerRequestRepository } from "../repositories/ParishionerRequestRepository.js";
import { canTransition } from "./RequestStateMachine.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";
import { DocumentRequirementService } from "./DocumentRequirementService.js";
import { RecipientResolver } from "./RecipientResolver.js";


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

      // Check if there are attachments uploaded (conditional on requirements)
      const reqConfig = await DocumentRequirementService.getRequirements(request.documentType, request.parishId);
      const requiredDocs = reqConfig?.requiredDocuments || [];

      if (requiredDocs.length > 0) {
        const attachmentCount = await tx.requestAttachment.count({
          where: { requestId },
        });

        if (attachmentCount === 0) {
          const error = new Error("Cannot submit request without supporting attachments.");
          error.statusCode = 400;
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

      // Parishioner-initiated submission: notify parishioner + admins
      await RequestNotificationService.notifyStatusChange(
        userId,
        submittedRequest.parishId,
        submittedRequest.id,
        submittedRequest.trackingNumber,
        "DRAFT",
        "PENDING",
        tx,
        true // notifyAdmins: new request visible to Secretary and Coordinator
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

      // Parishioner-initiated cancellation: notify parishioner + admins
      await RequestNotificationService.notifyStatusChange(
        userId,
        request.parishId,
        request.id,
        request.trackingNumber,
        currentStatus,
        targetStatus,
        tx,
        true // notifyAdmins: cancellation affects administrative workload
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

  /**
   * Resubmits corrected document requirements.
   */
  async resubmitCorrections(requestId, userId) {
    return prisma.$transaction(async (tx) => {
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

      // 3. Verify required replacements exist
      const attachments = await tx.requestAttachment.findMany({
        where: { requestId },
      });
      const attachmentCategories = attachments.map((a) => a.category);

      for (const reqId of request.correctionRequirementIds) {
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
        `Resubmitted corrected documents for request ${request.trackingNumber}`,
        tx
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
    });
  }
}
