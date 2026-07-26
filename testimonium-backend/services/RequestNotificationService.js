import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { prisma } from "../config/db.js";

/**
 * RequestNotificationService — Compatibility shim.
 *
 * This class preserves the original call signatures used by domain services
 * so that callers require only a minimal update (adding parishId) rather than
 * a full replacement. All logic is delegated to NotificationDispatcher.
 *
 * Future cleanup: once all callers have been verified against the dispatcher's
 * API, this shim can be removed and domain services updated to call
 * NotificationDispatcher directly.
 */
export class RequestNotificationService {
  /**
   * Low-level send — writes a single notification for one recipient.
   * Retained for edge-case single-recipient notifications that do not require
   * admin fan-out (e.g., auto-verified payment receipts).
   *
   * Backwards compatible signature:
   *   (userId, title, message, type, tx)
   *   (userId, title, message, type, referenceType, referenceId, tx)
   *
   * @param {number} userId
   * @param {string} title
   * @param {string} message
   * @param {string} type
   * @param {*} arg5
   * @param {*} arg6
   * @param {*} arg7
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
   * Notifies recipients when a document request changes state.
   *
   * Updated signature (adds parishId so the dispatcher can resolve admin
   * recipients). notifyAdmins controls whether admin fan-out occurs.
   *
   * @param {number} parishionerId    - User ID of the parishioner
   * @param {number} parishId         - Parish the request belongs to
   * @param {number} requestId        - DocumentRequest primary key
   * @param {string} trackingNumber
   * @param {string} oldStatus
   * @param {string} newStatus
   * @param {object|null} tx          - Prisma transaction client
   * @param {boolean} notifyAdmins    - Fan-out to admins? (default: false)
   */
  static async notifyStatusChange(
    parishionerId,
    parishId,
    requestId,
    trackingNumber,
    oldStatus,
    newStatus,
    tx = null,
    notifyAdmins = false
  ) {
    await NotificationDispatcher.notifyDocumentStatusChange(
      { parishionerId, parishId, requestId, trackingNumber, oldStatus, newStatus, notifyAdmins },
      tx
    );
  }

  /**
   * Notifies recipients when a schedule request changes state.
   *
   * Updated signature (adds parishId and notifyAdmins flag).
   *
   * @param {number} parishionerId    - User ID of the parishioner
   * @param {number} parishId         - Parish the schedule belongs to
   * @param {number} scheduleId       - Schedule primary key
   * @param {string} displayTitle
   * @param {string} newStatus
   * @param {object|null} tx          - Prisma transaction client
   * @param {boolean} notifyAdmins    - Fan-out to admins? (default: false)
   */
  static async notifyScheduleChange(
    parishionerId,
    parishId,
    scheduleId,
    displayTitle,
    newStatus,
    tx = null,
    notifyAdmins = false
  ) {
    await NotificationDispatcher.notifyScheduleChange(
      { parishionerId, parishId, scheduleId, displayTitle, newStatus, notifyAdmins },
      tx
    );
  }

  static async notifyPriestAssigned(
    parishionerId,
    parishId,
    scheduleId,
    displayTitle,
    priestId,
    priestName,
    tx = null
  ) {
    await NotificationDispatcher.notifyPriestAssigned(
      { parishionerId, parishId, scheduleId, displayTitle, priestId, priestName },
      tx
    );
  }
}
