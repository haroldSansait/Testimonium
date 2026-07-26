import { prisma } from "../config/db.js";
import { RecipientResolver } from "./RecipientResolver.js";

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
    if (newStatus === "PROCESSING") {
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
    { parishionerId, parishId, requestId, trackingNumber, oldStatus, newStatus, notifyAdmins = false },
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
    { parishionerId, parishId, scheduleId, displayTitle, newStatus, notifyAdmins = false },
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
  }

  static async notifyPriestAssigned(
    { parishionerId, parishId, scheduleId, displayTitle, priestId, priestName },
    tx = null
  ) {
    const client = tx || prisma;
    const payloads = [];

    // -- Parishioner notification --
    payloads.push({
      userId: parishionerId,
      title: "Priest Assigned to Appointment",
      message: `${priestName} has been assigned to your "${displayTitle}" appointment.`,
      type: "IN_APP",
      referenceType: "SCHEDULE_REQUEST",
      referenceId: scheduleId,
    });

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
   */
  static async _persist(payloads, client) {
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
      console.error("[NotificationDispatcher] Failed to persist notifications:", err.message);
    }
  }
}
