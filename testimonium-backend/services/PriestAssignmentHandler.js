import { prisma } from "../config/db.js";
import { lockPriestForScheduling, normalizePriestId } from "./SchedulingAvailability.js";
import { BLOCKING_SCHEDULE_STATUSES as ACTIVE_SCHEDULE_STATUSES } from "./ConflictHelper.js";

export class PriestAssignmentHandler {
  /**
   * Cleans up active future assignments when a priest leaves a parish.
   * Schedule prior state and version changes remain atomic with the cleanup.
   */
  static async cleanupPriestAssignmentsFromParish(
    priestId,
    oldParishId,
    tx = prisma,
    newParishName = null
  ) {
    const parsedPriestId = normalizePriestId(priestId);
    const parsedOldParishId = Number(oldParishId);
    if (!Number.isSafeInteger(parsedOldParishId) || parsedOldParishId <= 0) {
      const error = new Error("Invalid parish ID format.");
      error.statusCode = 400;
      error.code = "INVALID_PARISH_ID";
      throw error;
    }

    const runCleanup = async (client) => {
      await lockPriestForScheduling(client, parsedPriestId);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const schedules = await client.schedule.findMany({
        where: {
          parishId: parsedOldParishId,
          assignedPriestId: parsedPriestId,
          requestedDate: { gte: today },
          status: { in: ACTIVE_SCHEDULE_STATUSES },
        },
      });

      if (schedules.length) {
        await client.scheduleHistory.createMany({
          data: schedules.map((schedule) => ({
            scheduleId: schedule.id,
            version: schedule.version,
            requestedDate: schedule.requestedDate,
            startDatetime: schedule.startDatetime,
            endDatetime: schedule.endDatetime,
            remarks: schedule.remarks,
            status: schedule.status,
            assignedPriestId: schedule.assignedPriestId,
            priestResponseStatus: schedule.priestResponseStatus,
            reason: newParishName
              ? "Priest transferred to " + newParishName
              : "Priest removed from parish assignment",
            actorId: null,
            actorRole: "SYSTEM",
          })),
        });

        const confirmedIds = schedules
          .filter((schedule) => schedule.status === "CONFIRMED")
          .map((schedule) => schedule.id);
        const nonConfirmedIds = schedules
          .filter((schedule) => schedule.status !== "CONFIRMED")
          .map((schedule) => schedule.id);

        if (confirmedIds.length) {
          await client.schedule.updateMany({
            where: { id: { in: confirmedIds } },
            data: {
              status: "PENDING",
              assignedPriestId: null,
              priestResponseStatus: null,
              priestResponseReason: null,
              version: { increment: 1 },
            },
          });
        }

        if (nonConfirmedIds.length) {
          await client.schedule.updateMany({
            where: { id: { in: nonConfirmedIds } },
            data: {
              assignedPriestId: null,
              priestResponseStatus: null,
              priestResponseReason: null,
              version: { increment: 1 },
            },
          });
        }
      }

      await client.parishEvent.updateMany({
        where: {
          parishId: parsedOldParishId,
          assignedPriestId: parsedPriestId,
          eventDate: { gte: today },
        },
        data: {
          assignedPriestId: null,
          priestResponseStatus: null,
          priestResponseReason: null,
          version: { increment: 1 },
        },
      });

      await client.massScheduleTemplate.updateMany({
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
    };

    if (tx === prisma) {
      return prisma.$transaction(runCleanup, {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      });
    }
    return runCleanup(tx);
  }
}