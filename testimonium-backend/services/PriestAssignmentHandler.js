import { prisma } from "../config/db.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";

export const PriestResponseStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  TENTATIVE: "TENTATIVE", // Supported future state
  RESCHEDULED: "RESCHEDULED", // Supported future state
};

// Map of entity type metadata
const ENTITY_CONFIGS = {
  MASS: {
    model: "massScheduleTemplate",
    notFoundMessage: "Mass schedule template not found.",
    notAssignedMessage: "You are not the priest assigned to this Mass schedule.",
    idOffset: 200000,
    tableName: "MassScheduleTemplate",
    getDisplayTitle: (item) => `${item.label || "Holy Mass"} (${item.dayType} at ${item.timeSlot})`,
  },
  EVENT: {
    model: "parishEvent",
    notFoundMessage: "Parish event not found.",
    notAssignedMessage: "You are not the priest assigned to this event.",
    idOffset: 100000,
    tableName: "ParishEvent",
    getDisplayTitle: (item) => item.title,
  },
  SCHEDULE: {
    model: "schedule",
    notFoundMessage: "Schedule request not found.",
    notAssignedMessage: "You are not the priest assigned to this schedule request.",
    idOffset: 0,
    tableName: "Schedule",
    getDisplayTitle: (item) => item.displayTitle || item.eventType,
  },
};

export class PriestAssignmentHandler {
  /**
   * Unified response handler for priest assignment accept/decline.
   * @param {string|number} id - The entity ID
   * @param {string|number} priestId - The priest's user ID
   * @param {string} status - The response status (ACCEPTED / REJECTED etc.)
   * @param {string|undefined} reason - Optional note/reason text
   * @param {string} entityType - The entity type ('MASS', 'EVENT', 'SCHEDULE')
   */
  static async handleResponse(id, priestId, status, reason, entityType) {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new Error(`Unsupported entity type for priest assignment response: ${entityType}`);
    }

    const parsedId = parseInt(id, 10);
    const parsedPriestId = parseInt(priestId, 10);

    // 1. Retrieve the record
    const item = await prisma[config.model].findUnique({
      where: { id: parsedId },
    });

    if (!item) {
      const err = new Error(config.notFoundMessage);
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate priest assignment
    if (item.assignedPriestId !== parsedPriestId) {
      const err = new Error(config.notAssignedMessage);
      err.statusCode = 403;
      throw err;
    }

    // 3. Determine if assignment should be cleared
    // Rejection or any state that clears assignment should set assignedPriestId to null
    const clearAssignment = status === PriestResponseStatus.REJECTED;

    // 4. Build standard update payload
    const updateData = {
      priestResponseStatus: status,
      priestResponseReason: reason || null,
      assignedPriestId: clearAssignment ? null : item.assignedPriestId,
    };

    // 5. Build query includes
    const includes = {
      parish: { select: { id: true, parishName: true } },
    };
    if (entityType === "SCHEDULE") {
      includes.user = { select: { id: true, fullName: true, email: true } };
    }
    // We include assignedPriest if not cleared, or lookup separately for the logs
    includes.assignedPriest = { select: { id: true, fullName: true } };

    // 6. Perform the update
    const updated = await prisma[config.model].update({
      where: { id: parsedId },
      data: updateData,
      include: includes,
    });

    // 7. Resolve priest name
    let priestName = "Priest";
    if (clearAssignment) {
      const priest = await prisma.user.findUnique({
        where: { id: parsedPriestId },
        select: { fullName: true },
      });
      priestName = priest?.fullName || "Priest";
    } else {
      priestName = updated.assignedPriest?.fullName || "Priest";
    }

    const displayTitle = config.getDisplayTitle(updated);

    // 8. Send notification to secretary/admins
    await NotificationDispatcher.notifyPriestResponse({
      parishId: updated.parishId,
      scheduleId: updated.id + config.idOffset,
      displayTitle,
      priestName,
      status,
      reason,
      referenceType: "SCHEDULE_REQUEST",
    });

    // 9. Entity-specific actions
    if (entityType === "SCHEDULE") {
      await RequestNotificationService.notifyScheduleChange(
        updated.userId,
        updated.parishId,
        updated.id,
        `${displayTitle} (Priest ${status === PriestResponseStatus.ACCEPTED ? "Accepted" : "Rejected"})`,
        updated.status,
        null,
        true
      );
    }

    // 10. Write Audit Log
    await AuditLogService.log(
      parsedPriestId,
      "Priest Assignment Response Updated",
      null,
      false,
      {
        affectedTable: entityType === "MASS" ? "mass_schedule_templates" : entityType === "EVENT" ? "parish_events" : "schedules",
        affectedRecordId: parsedId,
        parishId: updated.parishId,
        newValues: {
          priestResponseStatus: status,
          priestResponseReason: reason || null,
        },
        metadata: {
          entityType,
          entityId: parsedId,
        },
      }
    );

    return updated;
  }

  /**
   * Cleans up all pending and future assignments for a priest at a specified parish.
   * Called when a priest is transferred to another parish, unassigned, or disabled.
   * @param {number|string} priestId
   * @param {number|string} oldParishId
   * @param {object} [tx=prisma] - Optional Prisma transaction client
   * @param {string|null} [newParishName] - Optional new parish name for logging
   */
  static async cleanupPriestAssignmentsFromParish(priestId, oldParishId, tx = prisma, newParishName = null) {
    if (!priestId || !oldParishId) return;
    const parsedPriestId = parseInt(priestId, 10);
    const parsedOldParishId = parseInt(oldParishId, 10);
    if (isNaN(parsedPriestId) || isNaN(parsedOldParishId)) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Clear future & pending schedules in the old parish
    await tx.schedule.updateMany({
      where: {
        parishId: parsedOldParishId,
        assignedPriestId: parsedPriestId,
        requestedDate: { gte: today },
      },
      data: {
        assignedPriestId: null,
        priestResponseStatus: null,
        priestResponseReason: null,
      },
    });

    // 2. Clear future & active parish events in the old parish
    await tx.parishEvent.updateMany({
      where: {
        parishId: parsedOldParishId,
        assignedPriestId: parsedPriestId,
        eventDate: { gte: today },
      },
      data: {
        assignedPriestId: null,
        priestResponseStatus: null,
        priestResponseReason: null,
      },
    });

    // 3. Clear mass schedule templates in the old parish
    await tx.massScheduleTemplate.updateMany({
      where: {
        parishId: parsedOldParishId,
        assignedPriestId: parsedPriestId,
      },
      data: {
        assignedPriestId: null,
        priestResponseStatus: null,
        priestResponseReason: null,
      },
    });
  }
}
