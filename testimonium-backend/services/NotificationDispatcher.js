import { prisma } from "../config/db.js";
import { RecipientResolver } from "./RecipientResolver.js";
import { logger } from "../config/logger.js";
import { EmailOutboxService } from "./EmailOutboxService.js";

// ---------------------------------------------------------------------------
// Message Template Factories
// Each factory returns { title, message } for a given audience and event.
// Keeping templates here (rather than inline) makes them easy to iterate on
// and keeps the dispatch logic readable.
// ---------------------------------------------------------------------------

/**
 * Templates for document request status-change events.
 */
const DocumentRequestTemplates = {
  /**
   * Parishioner-facing message for a status transition.
   * @param {string} trackingNumber
   * @param {string} oldStatus
   * @param {string} newStatus
   * @returns {{ title: string, message: string }}
   */
  parishioner(trackingNumber, oldStatus, newStatus) {
    if (newStatus === "PAYMENT_NEEDS_CORRECTION") {
      return {
        title: "Payment Proof Requires Correction",
        message: `Your payment proof for request (Tracking #: ${trackingNumber}) requires correction.`,
      };
    }
    if (newStatus === "PENDING" && oldStatus === "DRAFT") {
      return {
        title: "Request Submitted Successfully",
        message: `Your sacramental document request (Tracking #: ${trackingNumber}) has been submitted and is pending review.`,
      };
    }
    if (newStatus === "PENDING") {
      return {
        title: "Request Submitted",
        message: `Your request (Tracking #: ${trackingNumber}) has been received and is pending.`,
      };
    }
    if (newStatus === "UNDER_REVIEW") {
      return {
        title: "Request Under Review",
        message: `Your request (Tracking #: ${trackingNumber}) is now being reviewed by the parish staff.`,
      };
    }
    if (newStatus === "PAYMENT_PENDING") {
      return {
        title: "Payment Required",
        message: `Your request (Tracking #: ${trackingNumber}) requires payment. Please upload your payment receipt to proceed.`,
      };
    }
    if (newStatus === "PAYMENT_VERIFIED") {
      return {
        title: "Payment Proof Verified",
        message: `Your payment receipt for request (Tracking #: ${trackingNumber}) has been verified successfully.`,
      };
    }
    if (newStatus === "PROCESSING" || newStatus === "READY_FOR_SIGNING") {
      return {
        title: "Processing Document",
        message: `Your sacramental certificate (Tracking #: ${trackingNumber}) is now being prepared.`,
      };
    }
    if (newStatus === "READY_FOR_PICKUP") {
      return {
        title: "Document Ready for Pickup",
        message: `Your requested document (Tracking #: ${trackingNumber}) is ready. Please pick it up from the parish office.`,
      };
    }
    if (newStatus === "COMPLETED") {
      return {
        title: "Request Completed",
        message: `Your request (Tracking #: ${trackingNumber}) has been fully processed and completed.`,
      };
    }
    if (newStatus === "REJECTED") {
      return {
        title: "Request Rejected",
        message: `Your request (Tracking #: ${trackingNumber}) was rejected by the parish. Please review the comments/rejection reasons.`,
      };
    }
    if (newStatus === "CANCELLED") {
      return {
        title: "Request Cancelled",
        message: `Your request (Tracking #: ${trackingNumber}) has been cancelled.`,
      };
    }
    return {
      title: "Document Request Update",
      message: `Your request ${trackingNumber} status has changed from ${oldStatus} to ${newStatus}.`,
    };
  },

  /**
   * Admin-facing message when a new request is submitted by a parishioner.
   * @param {string} trackingNumber
   * @returns {{ title: string, message: string }}
   */
  adminNewRequest(trackingNumber) {
    return {
      title: "New Document Request",
      message: `A new sacramental document request (Tracking #: ${trackingNumber}) has been submitted and is awaiting review.`,
    };
  },

  /**
   * Admin-facing message when a parishioner cancels their own request.
   * @param {string} trackingNumber
   * @returns {{ title: string, message: string }}
   */
  adminCancelled(trackingNumber) {
    return {
      title: "Document Request Cancelled",
      message: `Request (Tracking #: ${trackingNumber}) has been cancelled by the parishioner.`,
    };
  },
};

/**
 * Templates for payment receipt upload events.
 */
const ReceiptTemplates = {
  /**
   * Parishioner-facing message when proof is uploaded for manual review.
   * @param {string} trackingNumber
   * @returns {{ title: string, message: string }}
   */
  parishionerUploaded(trackingNumber) {
    return {
      title: "Payment Proof Submitted",
      message: `Your payment proof for request ${trackingNumber} has been uploaded and is undergoing verification.`,
    };
  },

  /**
   * Admin-facing message when a receipt requires manual verification.
   * @param {string} trackingNumber
   * @returns {{ title: string, message: string }}
   */
  adminManualReview(trackingNumber) {
    return {
      title: "Payment Proof Requires Verification",
      message: `Payment proof for request (Tracking #: ${trackingNumber}) has been uploaded and is awaiting manual verification.`,
    };
  },

  parishionerResubmitted(trackingNumber) {
    return {
      title: "Corrected Payment Submitted",
      message: `Your corrected payment proof for request (Tracking #: ${trackingNumber}) has been submitted for review.`,
    };
  },

  adminResubmitted(trackingNumber, parishionerName) {
    return {
      title: "Corrected Payment Proof Submitted",
      message: `${parishionerName} submitted a corrected payment proof for request (Tracking #: ${trackingNumber}).`,
    };
  },

  parishionerLowConfidence(trackingNumber) {
    return {
      title: "Payment Proof Unclear",
      message: `The payment proof image for request (Tracking #: ${trackingNumber}) is unclear or blurry. Please upload a clearer image.`,
    };
  },
};

/**
 * Templates for schedule request events.
 */
const ScheduleTemplates = {
  /**
   * Parishioner-facing message for a schedule status change.
   * @param {string} displayTitle
   * @param {string} newStatus
   * @returns {{ title: string, message: string }}
   */
  parishioner(displayTitle, newStatus) {
    if (newStatus === "PENDING" || newStatus === "REQUESTED") {
      return {
        title: "Appointment Submitted",
        message: `Your schedule request for "${displayTitle}" has been submitted successfully and is pending review.`,
      };
    }
    if (newStatus === "UNDER_REVIEW") {
      return {
        title: "Appointment Under Review",
        message: `Your schedule request for "${displayTitle}" is now being reviewed by the parish staff.`,
      };
    }
    if (newStatus === "PROPOSED_RESCHEDULE" || newStatus === "WAITING_PARISHIONER_RESPONSE") {
      return {
        title: "Alternative Date Proposed",
        message: `The parish has proposed an alternative schedule for your "${displayTitle}" request. Please review and respond.`,
      };
    }
    if (newStatus === "CONFIRMED") {
      return {
        title: "Appointment Confirmed",
        message: `Your schedule request for "${displayTitle}" has been confirmed by the parish.`,
      };
    }
    if (newStatus === "REJECTED" || newStatus === "DECLINED") {
      return {
        title: "Appointment Declined",
        message: `Your schedule request for "${displayTitle}" has been declined by the parish.`,
      };
    }
    if (newStatus === "CANCELLED") {
      return {
        title: "Appointment Cancelled",
        message: `Your schedule request for "${displayTitle}" has been cancelled.`,
      };
    }
    if (newStatus === "COMPLETED") {
      return {
        title: "Appointment Completed",
        message: `Your schedule request for "${displayTitle}" has been successfully completed.`,
      };
    }
    return {
      title: "Schedule Status Update",
      message: `Your schedule request for "${displayTitle}" status has been updated to ${newStatus}.`,
    };
  },

  /**
   * Admin-facing message when a new schedule booking is made.
   * @param {string} displayTitle
   * @returns {{ title: string, message: string }}
   */
  adminNewBooking(displayTitle) {
    return {
      title: "New Appointment Request",
      message: `A new appointment request for "${displayTitle}" has been submitted and is pending review.`,
    };
  },

  adminRescheduleResponse(displayTitle, accepted) {
    return {
      title: accepted ? "Reschedule Proposal Accepted" : "Reschedule Proposal Declined",
      message: `The parishioner has ${accepted ? "accepted" : "declined"} the alternative schedule proposed for "${displayTitle}".`,
    };
  },
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * NotificationDispatcher — the single orchestration entry point for all
 * notification creation in Testimonium.
 *
 * Responsibilities:
 *   1. Resolve recipients per event using RecipientResolver (role-aware).
 *   2. Deduplicate recipient IDs.
 *   3. Select the appropriate message template per audience.
 *   4. Write all notification rows atomically via the caller's tx client.
 *
 * Domain services must NOT write notifications directly. All notification
 * creation MUST pass through this dispatcher.
 */
export class NotificationDispatcher {
  // -------------------------------------------------------------------------
  // Document Request Events
  // -------------------------------------------------------------------------

  /**
   * Dispatches notifications for a document request status transition.
   *
   * Fan-out rules:
   *   - Parishioner: always notified with a user-facing status message.
   *   - Admins (Secretary + Coordinator): notified only for parishioner-initiated
   *     events. Staff-driven transitions (UNDER_REVIEW, PROCESSING, etc.) do NOT
   *     trigger a secondary admin notification.
   *
   * @param {object} event
   * @param {number}  event.parishionerId   - User ID of the submitting parishioner
   * @param {number}  event.parishId        - Parish the request belongs to
   * @param {number}  event.requestId       - DocumentRequest primary key
   * @param {string}  event.trackingNumber  - Human-readable tracking number
   * @param {string}  event.oldStatus       - Previous DocumentRequestStatus
   * @param {string}  event.newStatus       - New DocumentRequestStatus
   * @param {boolean} event.notifyAdmins    - Whether admins should also be notified
   * @param {object|null} tx               - Prisma transaction client
   */
  static async notifyDocumentStatusChange(
    { parishionerId, parishId, requestId, trackingNumber, oldStatus, newStatus, notifyAdmins = false, historyId = null },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner notification --
    const parishionerTemplate = DocumentRequestTemplates.parishioner(
      trackingNumber,
      oldStatus,
      newStatus
    );
    payloads.push({
      userId: parishionerId,
      title: parishionerTemplate.title,
      message: parishionerTemplate.message,
      type: "IN_APP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: requestId,
    });

    // -- Admin notifications (only for parishioner-initiated events) --
    if (notifyAdmins) {
      const adminTemplate =
        newStatus === "CANCELLED"
          ? DocumentRequestTemplates.adminCancelled(trackingNumber)
          : DocumentRequestTemplates.adminNewRequest(trackingNumber);

      const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

      for (const adminId of adminIds) {
        // Skip if admin happens to be the same user as the parishioner
        if (adminId === parishionerId) continue;

        payloads.push({
          userId: adminId,
          title: adminTemplate.title,
          message: adminTemplate.message,
          type: "IN_APP",
          referenceType: "DOCUMENT_REQUEST",
          referenceId: requestId,
        });
      }
    }

    await NotificationDispatcher._persist(payloads, client);
    await EmailOutboxService.enqueueDocumentTransition({ requestId, oldStatus, newStatus, historyId }, client);
  }

  /**
   * Dispatches an IN_APP notification to the active primary parish priest
   * when a document request transitions to READY_FOR_SIGNING.
   * Graceful no-op if no active primary priest is assigned.
   *
   * @param {object} event
   * @param {number} event.parishId
   * @param {number} event.requestId
   * @param {string} event.trackingNumber
   * @param {string} [event.documentType]
   * @param {object|null} tx
   */
  static async notifyPriestReadyForSigning(
    { parishId, requestId, trackingNumber, documentType },
    tx = null
  ) {
    const client = tx || prisma;
    const priestId = await RecipientResolver.getPrimaryPriest(parishId, client);
    if (!priestId) {
      logger.info(
        { parishId, requestId },
        "[NotificationDispatcher] No active primary priest found; skipping signing notification."
      );
      return;
    }

    const docTypeLabels = {
      BAPTISMAL_CERTIFICATE: "Baptismal Certificate",
      CONFIRMATION_CERTIFICATE: "Confirmation Certificate",
      MARRIAGE_CERTIFICATE: "Marriage Certificate",
      FIRST_COMMUNION_CERTIFICATE: "First Communion Certificate",
      MARRIAGE_BANNS: "Marriage Banns",
      PERMIT_TO_MARRY: "Permit to Marry",
      STATUS_OF_LIBERTY: "Status of Liberty Certificate",
    };
    const humanizedDoc = docTypeLabels[documentType] || (documentType ? documentType.replace(/_/g, " ") : "Document");
    const title = "Document Ready for Signing";
    const message = `Request #${trackingNumber} (${humanizedDoc}) is ready for your signature.`;

    const payload = {
      userId: priestId,
      title,
      message,
      type: "IN_APP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: requestId,
    };

    await NotificationDispatcher._persist([payload], client, { throwOnError: true });
  }

  // -------------------------------------------------------------------------
  // Payment Receipt Events
  // -------------------------------------------------------------------------

  /**
   * Dispatches notifications when a payment receipt is submitted for manual review.
   * Called only in the non-auto-verified path of ReceiptVerificationService.
   *
   * Fan-out rules:
   *   - Parishioner: "proof submitted, pending verification".
   *   - Admins (Secretary + Coordinator): "proof awaiting manual verification".
   *
   * @param {object} event
   * @param {number}  event.parishionerId   - User ID of the submitting parishioner
   * @param {number}  event.parishId        - Parish the request belongs to
   * @param {number}  event.requestId       - DocumentRequest primary key
   * @param {string}  event.trackingNumber  - Human-readable tracking number
   * @param {object|null} tx               - Prisma transaction client
   */
  static async notifyReceiptUploaded(
    { parishionerId, parishId, requestId, trackingNumber },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner --
    const p = ReceiptTemplates.parishionerUploaded(trackingNumber);
    payloads.push({
      userId: parishionerId,
      title: p.title,
      message: p.message,
      type: "IN_APP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: requestId,
    });

    // -- Admins --
    const adminTemplate = ReceiptTemplates.adminManualReview(trackingNumber);
    const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

    for (const adminId of adminIds) {
      if (adminId === parishionerId) continue;
      payloads.push({
        userId: adminId,
        title: adminTemplate.title,
        message: adminTemplate.message,
        type: "IN_APP",
        referenceType: "DOCUMENT_REQUEST",
        referenceId: requestId,
      });
    }

    await NotificationDispatcher._persist(payloads, client);
  }

  static async notifyReceiptResubmitted(
    { parishionerId, parishionerName, parishId, requestId, trackingNumber },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner --
    const p = ReceiptTemplates.parishionerResubmitted(trackingNumber);
    payloads.push({
      userId: parishionerId,
      title: p.title,
      message: p.message,
      type: "IN_APP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: requestId,
    });

    // -- Admins --
    const adminTemplate = ReceiptTemplates.adminResubmitted(trackingNumber, parishionerName);
    const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

    for (const adminId of adminIds) {
      if (adminId === parishionerId) continue;
      payloads.push({
        userId: adminId,
        title: adminTemplate.title,
        message: adminTemplate.message,
        type: "IN_APP",
        referenceType: "DOCUMENT_REQUEST",
        referenceId: requestId,
      });
    }

    await NotificationDispatcher._persist(payloads, client);
  }

  /**
   * Dispatches a notification when payment proof quality score is below threshold (< 75%).
   * Notifies the parishioner that a clearer re-upload is required.
   */
  static async notifyReceiptQualityFailed(
    { parishionerId, parishId, requestId, trackingNumber },
    tx = null
  ) {
    const client = tx || prisma;
    const template = ReceiptTemplates.parishionerLowConfidence(trackingNumber);
    const payloads = [{
      userId: parishionerId,
      title: template.title,
      message: template.message,
      type: "IN_APP",
      referenceType: "DOCUMENT_REQUEST",
      referenceId: requestId,
    }];

    await NotificationDispatcher._persist(payloads, client);
  }

  // -------------------------------------------------------------------------
  // Schedule Events
  // -------------------------------------------------------------------------

  /**
   * Dispatches notifications for a schedule request event.
   *
   * Fan-out rules:
   *   - Parishioner: always notified with a user-facing status message.
   *   - Admins: notified only when `notifyAdmins` is true (i.e., a new parishioner
   *     booking). Staff-driven status updates do NOT re-notify admins.
   *
   * @param {object} event
   * @param {number}  event.parishionerId   - User ID of the parishioner who booked
   * @param {number}  event.parishId        - Parish the schedule belongs to
   * @param {number}  event.scheduleId      - Schedule primary key
   * @param {string}  event.displayTitle    - Human-readable event label
   * @param {string}  event.newStatus       - New ScheduleStatus
   * @param {boolean} event.notifyAdmins    - Whether admins should also be notified
   * @param {object|null} tx               - Prisma transaction client
   */
  static async notifyScheduleChange(
    {
      parishionerId,
      parishId,
      scheduleId,
      displayTitle,
      oldStatus = null,
      newStatus,
      proposalVersion = 0,
      transitionVersion = "initial",
      notifyAdmins = false,
      schedule = null,
    },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner --
    const p = ScheduleTemplates.parishioner(displayTitle, newStatus);
    payloads.push({
      userId: parishionerId,
      title: p.title,
      message: p.message,
      type: "IN_APP",
      referenceType: "SCHEDULE_REQUEST",
      referenceId: scheduleId,
    });

    // -- Admins (new booking only) --
    if (notifyAdmins) {
      const adminTemplate = ScheduleTemplates.adminNewBooking(displayTitle);
      const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

      for (const adminId of adminIds) {
        if (adminId === parishionerId) continue;
        payloads.push({
          userId: adminId,
          title: adminTemplate.title,
          message: adminTemplate.message,
          type: "IN_APP",
          referenceType: "SCHEDULE_REQUEST",
          referenceId: scheduleId,
        });
      }
    }

    await NotificationDispatcher._persist(payloads, client);
    await EmailOutboxService.enqueueScheduleTransition(
      schedule || { id: scheduleId, status: newStatus, proposalVersion },
      oldStatus,
      transitionVersion,
      client
    );
  }

  static async notifyPriestAssigned(
    { parishionerId, parishId, scheduleId, displayTitle, priestId, priestName },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner notification --
    if (parishionerId) {
      payloads.push({
        userId: parishionerId,
        title: "Priest Assigned to Appointment",
        message: `${priestName} has been assigned to your "${displayTitle}" appointment.`,
        type: "IN_APP",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: scheduleId,
      });
    }

    // -- Priest notification --
    payloads.push({
      userId: priestId,
      title: "New Pastoral Assignment",
      message: `You have been assigned to lead the "${displayTitle}" event.`,
      type: "IN_APP",
      referenceType: "SCHEDULE_REQUEST",
      referenceId: scheduleId,
    });

    await NotificationDispatcher._persist(payloads, client);
  }

  static async notifyPriestResponse(
    { parishId, scheduleId, displayTitle, priestName, status, reason, referenceType = "SCHEDULE_REQUEST" },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    const action = status === "ACCEPTED" ? "accepted" : "declined";
    const reasonText = reason ? ` Reason: ${reason}` : "";
    const title = `Pastoral Assignment ${status === "ACCEPTED" ? "Accepted" : "Declined"}`;
    const message = `Father ${priestName} has ${action} the assignment for "${displayTitle}".${reasonText}`;

    const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

    for (const adminId of adminIds) {
      payloads.push({
        userId: adminId,
        title,
        message,
        type: "IN_APP",
        referenceType,
        referenceId: scheduleId,
      });
    }

    await NotificationDispatcher._persist(payloads, client);
  }

  /**
   * Dispatches notifications when an emergency reschedule is executed on a confirmed schedule.
   * Notifies both the parishioner and the assigned/retained priest post-commit.
   */
  static async notifyEmergencyReschedule(
    { parishionerId, parishId, scheduleId, displayTitle, newDate, newSlot, reason, priestId, priestName },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner notification --
    if (parishionerId) {
      payloads.push({
        userId: parishionerId,
        title: "Appointment Rescheduled",
        message: `Your appointment for "${displayTitle}" has been rescheduled to ${newDate} at ${newSlot}. Reason: ${reason}`,
        type: "IN_APP",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: scheduleId,
      });
    }

    // -- Retained Priest notification --
    if (priestId) {
      payloads.push({
        userId: priestId,
        title: "Assignment Schedule Updated",
        message: `Your pastoral assignment for "${displayTitle}" has been rescheduled to ${newDate} at ${newSlot}. Reason: ${reason}`,
        type: "IN_APP",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: scheduleId,
      });
    }

    await NotificationDispatcher._persist(payloads, client);
  }

  /**
   * Dispatches notifications to parish admins when a parishioner declines a proposed reschedule.
   */
  static async notifyProposalDeclined(
    { parishId, scheduleId, parishionerName, displayTitle },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    const adminTemplate = ScheduleTemplates.adminRescheduleResponse(displayTitle, false);
    const adminIds = await RecipientResolver.getAdminRecipients(parishId, tx);

    for (const adminId of adminIds) {
      payloads.push({
        userId: adminId,
        title: adminTemplate.title,
        message: adminTemplate.message,
        type: "IN_APP",
        referenceType: "SCHEDULE_REQUEST",
        referenceId: scheduleId,
      });
    }

    await NotificationDispatcher._persist(payloads, client);
  }

  /**
   * Notifies the owning parishioner when a priest rejects an assignment and
   * staff must assign a replacement.
   */
  static async notifyPriestReassignmentRequired(
    { parishionerId, scheduleId, displayTitle },
    tx = null
  ) {
    if (!parishionerId) return;
    const client = tx || prisma;
    await NotificationDispatcher._persist([{
      userId: parishionerId,
      title: "Priest Reassignment Required",
      message: `The priest assigned to "${displayTitle}" is unavailable. Parish staff will assign a replacement.`,
      type: "IN_APP",
      referenceType: "SCHEDULE_REQUEST",
      referenceId: scheduleId,
    }], client);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Persists an array of notification payloads using createMany.
   * Deduplicates by userId within the same batch before writing.
   * Errors are caught and logged without re-throwing so that a
   * notification failure never aborts the parent business transaction.
   *
   * @param {object[]} payloads - Array of Notification create data objects
   * @param {object} client     - Prisma client or transaction client
   * @param {{throwOnError?: boolean}} options
   */
  static async _persist(payloads, client, { throwOnError = false } = {}) {
    if (!payloads || payloads.length === 0) return;

    // Deduplicate by userId: keep the first payload per userId in this batch.
    // In practice duplicates should not occur, but this guards against accidental
    // double-resolution in edge cases.
    const seen = new Set();
    const unique = payloads.filter((p) => {
      const key = `${p.userId}:${p.referenceType}:${p.referenceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    try {
      await client.notification.createMany({ data: unique });
    } catch (err) {
      logger.error({ err }, "[NotificationDispatcher] Failed to persist notifications");
      if (throwOnError) throw err;
    }
  }
}
