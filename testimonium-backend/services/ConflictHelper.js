import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";

/**
 * Returns a YYYY-MM-DD string in Asia/Manila (UTC+8) timezone.
 *
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function getManilaDateString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Parses date-only inputs safely in Asia/Manila timezone.
 *
 * @param {Date|string} dateInput
 * @returns {{ year: number, month: number, day: number, dateObj: Date, dateStr: string, dayName: string } | null}
 */
export function parseManilaDateOnly(dateInput) {
  if (!dateInput) return null;
  let year = 0;
  let month = 0;
  let day = 0;

  if (typeof dateInput === "string") {
    const cleanStr = dateInput.split("T")[0].trim();
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  }

  if (!year || !month || !day) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const manilaStr = getManilaDateString(d);
    if (!manilaStr) return null;
    const parts = manilaStr.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }

  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
  const dateObj = new Date(`${dateStr}T00:00:00.000+08:00`);
  if (isNaN(dateObj.getTime())) return null;

  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
  });
  const dayName = weekdayFormatter.format(dateObj).toLowerCase();

  return { year, month, day, dateObj, dateStr, dayName };
}

/**
 * Constructs an accurate Date object in Asia/Manila (UTC+8) timezone.
 *
 * @param {Date|string} dateInput
 * @param {string} timeStr - e.g. "08:00 AM" or "01:30 PM"
 * @returns {Date|null}
 */
export function parseManilaDateTime(dateInput, timeStr = "08:00 AM") {
  try {
    const parsed = parseManilaDateOnly(dateInput);
    if (!parsed) return null;

    let [hourMin, period] = (timeStr || "08:00 AM").trim().split(" ");
    let [hours, minutes] = (hourMin || "08:00").split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    const hStr = String(hours).padStart(2, "0");
    const mStr = String(minutes || 0).padStart(2, "0");

    return new Date(`${parsed.dateStr}T${hStr}:${mStr}:00.000+08:00`);
  } catch {
    return null;
  }
}

/** Formats an instant as the booking-slot representation in Asia/Manila. */
export function formatManilaTimeSlot(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  return hour && minute && dayPeriod ? `${hour.padStart(2, "0")}:${minute} ${dayPeriod.toUpperCase()}` : null;
}

export class ConflictHelper {
  /**
   * Evaluates scheduling conflicts for a priest across all commitments.
   * Enforces interval overlap invariant: (existingStart < requestedEnd) && (existingEnd > requestedStart).
   */
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

    // 2. Check overlap with confirmed Schedules using strict interval overlap:
    // (existingStart < requestedEnd) AND (existingEnd > requestedStart)
    const scheduleConflict = await prisma.schedule.findFirst({
      where: {
        assignedPriestId: parsedPriestId,
        status: { in: ["CONFIRMED", "PENDING", "REQUESTED", "PROPOSED_RESCHEDULE"] },
        id: excludeScheduleId ? { not: parseInt(excludeScheduleId, 10) } : undefined,
        startDatetime: { lt: end },
        endDatetime: { gt: start }
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

    for (const ev of targetEvents) {
      if (ev.startTime && ev.endTime) {
        const evStart = parseManilaDateTime(ev.eventDate, ev.startTime);
        const evEnd = parseManilaDateTime(ev.eventDate, ev.endTime);
        if (evStart && evEnd && evStart < end && evEnd > start) {
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

    // 4. Check overlap with recurring Mass Schedule Templates for the applicable day of the week
    const parsedCheckDate = parseManilaDateOnly(date);
    const isSunday = parsedCheckDate?.dayName === "sunday";
    const applicableDayTypes = isSunday ? ["SUNDAY"] : ["WEEKDAY"];

    const targetTemplates = await prisma.massScheduleTemplate.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
        dayType: { in: applicableDayTypes },
      }
    });

    for (const t of targetTemplates) {
      if (t.timeSlot) {
        const tStart = parseManilaDateTime(checkDate, t.timeSlot);
        if (tStart) {
          // Standard Mass duration: 60 minutes
          const tEnd = new Date(tStart.getTime() + 60 * 60 * 1000);
          if (tStart < end && tEnd > start) {
            if (actorId) {
              await AuditLogService.log(actorId, `Priest assignment validation failed: Priest ${parsedPriestId} has overlap with recurring Mass template #${t.id}`, null, true, {
                priestId: parsedPriestId,
                date: checkDate,
                reason: "OVERLAP_MASS_TEMPLATE",
                templateId: t.id
              });
            }
            const err = new Error(`Priest conflict: Already assigned to recurring Mass "${t.label || t.timeSlot}" at this time.`);
            err.statusCode = 400;
            throw err;
          }
        }
      }
    }
  }
}
