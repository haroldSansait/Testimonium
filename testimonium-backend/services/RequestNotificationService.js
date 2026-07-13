import { prisma } from "../config/db.js";

export class RequestNotificationService {
  /**
   * Helper to write a notification record to the database.
   * Supports execution within a Prisma transaction block.
   * Backwards compatible signature support for (userId, title, message, type, tx)
   * as well as (userId, title, message, type, referenceType, referenceId, tx)
   */
  static async send(userId, title, message, type = "IN_APP", arg5, arg6, arg7) {
    let referenceType = null;
    let referenceId = null;
    let tx = null;

    if (arg5 && typeof arg5 === "object" && !Array.isArray(arg5)) {
      tx = arg5;
    } else {
      referenceType = arg5 || null;
      if (arg6 && typeof arg6 === "object" && !Array.isArray(arg6)) {
        tx = arg6;
      } else {
        referenceId = arg6 || null;
        tx = arg7 || null;
      }
    }

    const client = tx || prisma;
    try {
      await client.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          referenceType,
          referenceId,
        },
      });
    } catch (err) {
      console.error(
        `[TESTIMONIUM] Failed to create notification for user ${userId}:`,
        err.message
      );
    }
  }

  /**
   * Sends user notifications when a document request changes state.
   */
  static async notifyStatusChange(userId, requestId, trackingNumber, oldStatus, newStatus, tx) {
    let title = "Document Request Update";
    let message = `Your request ${trackingNumber} status has changed from ${oldStatus} to ${newStatus}.`;

    if (newStatus === "PENDING" && oldStatus === "DRAFT") {
      title = "Request Submitted Successfully";
      message = `Your sacramental document request (Tracking #: ${trackingNumber}) has been submitted and is pending review.`;
    } else if (newStatus === "PENDING") {
      title = "Request Submitted";
      message = `Your request (Tracking #: ${trackingNumber}) has been received and is pending.`;
    } else if (newStatus === "UNDER_REVIEW") {
      title = "Request Under Review";
      message = `Your request (Tracking #: ${trackingNumber}) is now being reviewed by the parish staff.`;
    } else if (newStatus === "PAYMENT_PENDING") {
      title = "Payment Required";
      message = `Your request (Tracking #: ${trackingNumber}) requires payment. Please upload your payment receipt to proceed.`;
    } else if (newStatus === "PAYMENT_VERIFIED") {
      title = "Payment Proof Verified";
      message = `Your payment receipt for request (Tracking #: ${trackingNumber}) has been verified successfully.`;
    } else if (newStatus === "PROCESSING") {
      title = "Processing Document";
      message = `Your sacramental certificate (Tracking #: ${trackingNumber}) is now being prepared.`;
    } else if (newStatus === "READY_FOR_PICKUP") {
      title = "Document Ready for Pickup";
      message = `Your requested document (Tracking #: ${trackingNumber}) is ready. Please pick it up from the parish office.`;
    } else if (newStatus === "COMPLETED") {
      title = "Request Completed";
      message = `Your request (Tracking #: ${trackingNumber}) has been fully processed and completed.`;
    } else if (newStatus === "REJECTED") {
      title = "Request Rejected";
      message = `Your request (Tracking #: ${trackingNumber}) was rejected by the parish. Please review the comments/rejection reasons.`;
    } else if (newStatus === "CANCELLED") {
      title = "Request Cancelled";
      message = `Your request (Tracking #: ${trackingNumber}) has been cancelled.`;
    }

    await this.send(userId, title, message, "IN_APP", "DOCUMENT_REQUEST", requestId, tx);
  }

  /**
   * Sends user notifications when a schedule request changes state.
   */
  static async notifyScheduleChange(userId, scheduleId, displayTitle, newStatus, tx) {
    let title = "Schedule Status Update";
    let message = `Your schedule request for ${displayTitle} has been updated to ${newStatus}.`;

    if (newStatus === "PENDING") {
      title = "Appointment Submitted";
      message = `Your schedule request for "${displayTitle}" has been submitted successfully and is pending review.`;
    } else if (newStatus === "CONFIRMED") {
      title = "Appointment Confirmed";
      message = `Your schedule request for "${displayTitle}" has been confirmed by the parish.`;
    } else if (newStatus === "REJECTED") {
      title = "Appointment Declined";
      message = `Your schedule request for "${displayTitle}" has been declined.`;
    } else if (newStatus === "CANCELLED") {
      title = "Appointment Cancelled";
      message = `Your schedule request for "${displayTitle}" has been cancelled.`;
    }

    await this.send(userId, title, message, "IN_APP", "SCHEDULE_REQUEST", scheduleId, tx);
  }
}
