import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";

export class ConflictHelper {
  static async checkPriestConflict(priestId, date, startDatetime, endDatetime, { excludeScheduleId, excludeEventId, actorId } = {}) {
    const parsedPriestId = parseInt(priestId, 10);
    if (isNaN(parsedPriestId)) return;

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // 1. Check PRIEST_LEAVE
    const leave = await prisma.parishAvailability.findFirst({
      where: {
        userId: parsedPriestId,
        type: "PRIEST_LEAVE",
        startDate: { lte: checkDate },
        endDate: { gte: checkDate }
      }
    });

    if (leave) {
      if (actorId) {
        await AuditLogService.log(actorId, `Priest assignment validation failed: Priest ${parsedPriestId} is on leave on ${checkDate.toLocaleDateString()}`, null, true, {
          priestId: parsedPriestId,
          date: checkDate,
          reason: "PRIEST_ON_LEAVE"
        });
      }
      const err = new Error(`Priest is on leave on this date: ${leave.title}.`);
      err.statusCode = 400;
      throw err;
    }

    if (!startDatetime || !endDatetime) {
      return;
    }

    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    // 2. Check overlap with confirmed Schedules
    const scheduleConflict = await prisma.schedule.findFirst({
      where: {
        assignedPriestId: parsedPriestId,
        status: "CONFIRMED",
        id: excludeScheduleId ? { not: parseInt(excludeScheduleId, 10) } : undefined,
        startDatetime: { lte: end },
        endDatetime: { gte: start }
      }
    });

    if (scheduleConflict) {
      if (actorId) {
        await AuditLogService.log(actorId, `Priest assignment validation failed: Priest ${parsedPriestId} has overlap with schedule #${scheduleConflict.id}`, null, true, {
          priestId: parsedPriestId,
          date: checkDate,
          reason: "OVERLAP_SCHEDULE",
          scheduleId: scheduleConflict.id
        });
      }
      const err = new Error(`Priest conflict: Already assigned to appointment "${scheduleConflict.displayTitle || scheduleConflict.eventType}" at this time.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Check overlap with active ParishEvents
    const targetEvents = await prisma.parishEvent.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
        eventDate: checkDate,
        id: excludeEventId ? { not: parseInt(excludeEventId, 10) } : undefined
      }
    });

    const combine = (d, timeStr) => {
      try {
        const temp = new Date(d);
        let [hourMin, period] = timeStr.split(" ");
        let [hours, minutes] = hourMin.split(":").map(Number);
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        temp.setHours(hours, minutes, 0, 0);
        return temp;
      } catch {
        return null;
      }
    };

    for (const ev of targetEvents) {
      if (ev.startTime && ev.endTime) {
        const evStart = combine(ev.eventDate, ev.startTime);
        const evEnd = combine(ev.eventDate, ev.endTime);
        if (evStart && evEnd && evStart <= end && evEnd >= start) {
          if (actorId) {
            await AuditLogService.log(actorId, `Priest assignment validation failed: Priest ${parsedPriestId} has overlap with event #${ev.id}`, null, true, {
              priestId: parsedPriestId,
              date: checkDate,
              reason: "OVERLAP_EVENT",
              eventId: ev.id
            });
          }
          const err = new Error(`Priest conflict: Already assigned to parish event "${ev.title}" at this time.`);
          err.statusCode = 400;
          throw err;
        }
      }
    }
  }
}
