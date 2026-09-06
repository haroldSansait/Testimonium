import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";

const MANILA_TIME_ZONE = "Asia/Manila";
const MASS_CONFLICT_DURATION_MS = 60 * 60 * 1000;
export const BLOCKING_SCHEDULE_STATUSES = [
  "PENDING",
  "REQUESTED",
  "PROPOSED_RESCHEDULE",
  "WAITING_PARISHIONER_RESPONSE",
  "CONFIRMED",
];

function createConflictError(ownerMessage, isPriestOwner) {
  const error = new Error(
    isPriestOwner ? ownerMessage : "Priest is unavailable at this time."
  );
  error.statusCode = 409;
  error.code = "PRIEST_CONFLICT";
  return error;
}

async function auditConflict(actorId, metadata) {
  if (!actorId) return;
  await AuditLogService.log(actorId, "Priest Conflict Validation Failed", null, true, {
    metadata,
  });
}

export function getManilaDateString(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseManilaDateOnly(dateInput) {
  if (!dateInput) return null;
  let year;
  let month;
  let day;

  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(dateInput.trim())) {
    [year, month, day] = dateInput.trim().slice(0, 10).split("-").map(Number);
  } else {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    [year, month, day] = getManilaDateString(date).split("-").map(Number);
  }

  const dateStr = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateObj = new Date(`${dateStr}T00:00:00.000+08:00`);
  const databaseDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dateObj.getTime()) || Number.isNaN(databaseDate.getTime())) return null;

  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    weekday: "long",
  }).format(dateObj).toLowerCase();

  return { year, month, day, dateObj, databaseDate, dateStr, dayName };
}

export function parseManilaDateTime(dateInput, timeStr = "08:00 AM") {
  const parsed = parseManilaDateOnly(dateInput);
  const match = typeof timeStr === "string"
    ? timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    : null;
  if (!parsed || !match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return new Date(
    `${parsed.dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000+08:00`
  );
}

export function formatManilaTimeSlot(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  return hour && minute && dayPeriod
    ? `${hour.padStart(2, "0")}:${minute} ${dayPeriod.toUpperCase()}`
    : null;
}

export function massTemplateAppliesOnDate(dayType, dateInput) {
  const parsed = parseManilaDateOnly(dateInput);
  if (!parsed) return false;
  const dayName = parsed.dayName.toUpperCase();
  return dayType === dayName
    || (dayType === "WEEKDAY" && ["WEDNESDAY", "FRIDAY"].includes(dayName));
}

function getCoveredManilaDates(dateInput, start, end) {
  if (!start) {
    const parsed = parseManilaDateOnly(dateInput);
    return parsed ? [parsed] : [];
  }

  const first = parseManilaDateOnly(start || dateInput);
  const endInstant = end instanceof Date ? end : new Date(end);
  const last = parseManilaDateOnly(
    !Number.isNaN(endInstant.getTime())
      ? new Date(Math.max(endInstant.getTime() - 1, (start instanceof Date ? start : new Date(start)).getTime()))
      : start || dateInput
  );
  if (!first || !last) return [];

  const dates = [];
  for (
    let cursor = Date.UTC(first.year, first.month - 1, first.day);
    cursor <= Date.UTC(last.year, last.month - 1, last.day);
    cursor += 24 * 60 * 60 * 1000
  ) {
    dates.push(parseManilaDateOnly(new Date(cursor).toISOString().slice(0, 10)));
  }
  return dates.filter(Boolean);
}

import { normalizePriestId } from "./SchedulingAvailability.js";

/**
 * Canonical helper for Schedule conflict intervals.
 *
 * Priority:
 * A. Explicit authoritative startDatetime + endDatetime -> use them.
 * B. startDatetime exists, endDatetime missing -> operational fallback policy (1 hour), mark non-authoritative for ongoing
 * C. startDatetime missing but legacy requestedDate + existing configured slot representation
 *    can be deterministically recovered from canonical source (timeSlot or remarks) -> resolve operational interval safely, mark estimated/non-authoritative
 * D. interval genuinely cannot be resolved -> FAIL CLOSED for operations that would otherwise double-book a priest
 *
 * @param {object} schedule
 * @param {object} [options]
 * @param {boolean} [options.allowUnresolved=false]
 * @returns {object} { start, end, source, isEstimated, isOngoingEligible, unresolved }
 */
export function resolveScheduleConflictInterval(schedule, { allowUnresolved = false } = {}) {
  if (!schedule) {
    if (allowUnresolved) {
      return { unresolved: true, start: null, end: null, isEstimated: true, isOngoingEligible: false, source: "UNRESOLVED" };
    }
    const err = new Error("Schedule record is required to resolve conflict interval.");
    err.statusCode = 400;
    err.code = "INVALID_SCHEDULE";
    throw err;
  }

  // Priority A: Explicit authoritative startDatetime + endDatetime
  if (schedule.startDatetime && schedule.endDatetime) {
    const start = schedule.startDatetime instanceof Date ? schedule.startDatetime : new Date(schedule.startDatetime);
    const end = schedule.endDatetime instanceof Date ? schedule.endDatetime : new Date(schedule.endDatetime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      return {
        start,
        end,
        source: "AUTHORITATIVE",
        isEstimated: false,
        isOngoingEligible: true,
        unresolved: false,
      };
    }
  }

  // Priority B: startDatetime exists, endDatetime missing -> operational fallback policy (1 hour)
  if (schedule.startDatetime) {
    const start = schedule.startDatetime instanceof Date ? schedule.startDatetime : new Date(schedule.startDatetime);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + MASS_CONFLICT_DURATION_MS);
      return {
        start,
        end,
        source: "FALLBACK_DURATION",
        isEstimated: true,
        isOngoingEligible: false,
        unresolved: false,
      };
    }
  }

  // Priority C: startDatetime missing but legacy requestedDate + existing configured slot representation
  // can be deterministically recovered from canonical source (timeSlot or remarks)
  let timeSlot = schedule.timeSlot || null;
  if (!timeSlot && schedule.remarks) {
    const match = schedule.remarks.match(/Time Slot:\s*([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM))/i);
    if (match) {
      timeSlot = match[1];
    }
  }

  if (timeSlot && schedule.requestedDate) {
    const dateStr = getManilaDateString(schedule.requestedDate);
    const start = parseManilaDateTime(dateStr, timeSlot);
    if (start && !Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + MASS_CONFLICT_DURATION_MS);
      return {
        start,
        end,
        source: "RECOVERED_SLOT",
        isEstimated: true,
        isOngoingEligible: false,
        unresolved: false,
      };
    }
  }

  // Priority D: interval genuinely cannot be resolved -> FAIL CLOSED
  if (allowUnresolved) {
    return {
      start: null,
      end: null,
      source: "UNRESOLVED",
      isEstimated: true,
      isOngoingEligible: false,
      unresolved: true,
    };
  }

  const err = new Error("An existing assigned schedule lacks sufficient time details and requires review before new commitments can be booked.");
  err.statusCode = 409;
  err.code = "PRIEST_AVAILABILITY_UNDETERMINED";
  throw err;
}

export class ConflictHelper {
  static async checkPriestConflict(
    priestId,
    date,
    startDatetime,
    endDatetime,
    {
      excludeScheduleId,
      excludeEventId,
      excludePersonalId,
      excludeMassTemplateId,
      tx = null,
      actorId = null,
      isPriestOwner = false,
      actorRole = null,
      schedule = null,
      timeSlot = null,
      remarks = null,
    } = {}
  ) {
    const client = tx || prisma;
    const parsedPriestId = normalizePriestId(priestId);

    // Resolve candidate interval using canonical interval resolution helper
    let candidateStart = null;
    let candidateEnd = null;

    if (startDatetime) {
      const startCandidate = startDatetime instanceof Date ? startDatetime : new Date(startDatetime);
      const endCandidate = endDatetime
        ? (endDatetime instanceof Date ? endDatetime : new Date(endDatetime))
        : new Date(startCandidate.getTime() + MASS_CONFLICT_DURATION_MS);

      if (Number.isNaN(startCandidate.getTime()) || Number.isNaN(endCandidate.getTime()) || endCandidate <= startCandidate) {
        const error = new Error("Invalid priest conflict interval.");
        error.statusCode = 400;
        error.code = "INVALID_INTERVAL";
        throw error;
      }
      candidateStart = startCandidate;
      candidateEnd = endCandidate;
    } else {
      // startDatetime missing: attempt to resolve candidate interval via canonical resolution
      const scheduleCandidate = schedule || {
        requestedDate: date,
        startDatetime: null,
        endDatetime: null,
        timeSlot,
        remarks,
      };
      const resolvedCandidate = resolveScheduleConflictInterval(scheduleCandidate, { allowUnresolved: true });
      if (resolvedCandidate.unresolved || !resolvedCandidate.start || !resolvedCandidate.end) {
        // Interval genuinely cannot be resolved: fail closed!
        const isStaffUser = ["SECRETARY", "DIOCESE_COORDINATOR"].includes(actorRole);
        const error = new Error(
          isPriestOwner || isStaffUser
            ? "The schedule request lacks sufficient time details and requires review before a priest can be assigned or confirmed."
            : "Priest is unavailable at this time."
        );
        error.statusCode = 409;
        error.code = "PRIEST_AVAILABILITY_UNDETERMINED";
        throw error;
      }
      candidateStart = resolvedCandidate.start;
      candidateEnd = resolvedCandidate.end;
    }

    const start = candidateStart;
    const end = candidateEnd;

    const coveredDates = getCoveredManilaDates(date, candidateStart, candidateEnd);
    const fallbackDate = parseManilaDateOnly(date);
    if (!coveredDates.length && fallbackDate) coveredDates.push(fallbackDate);
    const databaseDates = coveredDates.map((item) => item.databaseDate);
    const dateStrings = coveredDates.map((item) => item.dateStr);

    // 1. PRIEST_LEAVE check
    const leave = databaseDates.length
      ? await client.parishAvailability.findFirst({
          where: {
            userId: parsedPriestId,
            type: "PRIEST_LEAVE",
            startDate: { lte: databaseDates[databaseDates.length - 1] },
            endDate: { gte: databaseDates[0] },
          },
          select: { id: true, title: true },
        })
      : null;
    if (leave) {
      await auditConflict(actorId, {
        priestId: parsedPriestId,
        dates: dateStrings,
        reason: "PRIEST_ON_LEAVE",
        availabilityId: leave.id,
      });
      throw createConflictError(
        `Priest is on leave during this interval: ${leave.title}.`,
        isPriestOwner
      );
    }

    // 2. Existing Assigned Schedules check (FAIL-CLOSED for unresolvable schedules, overlap check for resolvable)
    let existingSchedules = [];
    if (typeof client.schedule?.findMany === "function") {
      existingSchedules = await client.schedule.findMany({
        where: {
          assignedPriestId: parsedPriestId,
          status: { in: BLOCKING_SCHEDULE_STATUSES },
          id: excludeScheduleId ? { not: Number(excludeScheduleId) } : undefined,
          OR: [
            ...(databaseDates.length ? [{ requestedDate: { in: databaseDates } }] : []),
            {
              startDatetime: { lt: candidateEnd },
              endDatetime: { gt: candidateStart },
            },
          ],
        },
        select: {
          id: true,
          displayTitle: true,
          eventType: true,
          requestedDate: true,
          startDatetime: true,
          endDatetime: true,
          remarks: true,
          status: true,
          assignedPriestId: true,
        },
      });
    } else if (typeof client.schedule?.findFirst === "function") {
      const single = await client.schedule.findFirst({
        where: {
          assignedPriestId: parsedPriestId,
          status: { in: BLOCKING_SCHEDULE_STATUSES },
          id: excludeScheduleId ? { not: Number(excludeScheduleId) } : undefined,
        },
        select: {
          id: true,
          displayTitle: true,
          eventType: true,
          requestedDate: true,
          startDatetime: true,
          endDatetime: true,
          remarks: true,
          status: true,
          assignedPriestId: true,
        },
      });
      if (single) existingSchedules = [single];
    }

    for (const existing of existingSchedules) {
      if (excludeScheduleId && Number(existing.id) === Number(excludeScheduleId)) continue;
      if (existing.assignedPriestId !== undefined && (existing.assignedPriestId === null || Number(existing.assignedPriestId) !== parsedPriestId)) continue;
      if (existing.status && !BLOCKING_SCHEDULE_STATUSES.includes(existing.status)) continue;

      const resolved = resolveScheduleConflictInterval(existing, { allowUnresolved: true });
      if (resolved.unresolved || !resolved.start || !resolved.end) {
        // Genuinely unresolvable existing assigned schedule: FAIL CLOSED!
        await auditConflict(actorId, {
          priestId: parsedPriestId,
          dates: dateStrings,
          reason: "UNRESOLVED_SCHEDULE_INTERVAL",
          scheduleId: existing.id,
        });
        const isStaffUser = ["SECRETARY", "DIOCESE_COORDINATOR"].includes(actorRole);
        const error = new Error(
          isPriestOwner || isStaffUser
            ? `Existing assigned schedule #${existing.id} lacks sufficient time information and requires review before new commitments can be booked.`
            : "Priest is unavailable at this time."
        );
        error.statusCode = 409;
        error.code = "PRIEST_AVAILABILITY_UNDETERMINED";
        throw error;
      }

      // Check operational/authoritative overlap
      if (resolved.start < candidateEnd && resolved.end > candidateStart) {
        await auditConflict(actorId, {
          priestId: parsedPriestId,
          dates: dateStrings,
          reason: "OVERLAP_SCHEDULE",
          scheduleId: existing.id,
        });
        throw createConflictError(
          `Already assigned to appointment "${existing.displayTitle || existing.eventType}" at this time.`,
          isPriestOwner
        );
      }
    }

    // 3. Existing ParishEvents check
    const targetEvents = databaseDates.length
      ? await client.parishEvent.findMany({
          where: {
            assignedPriestId: parsedPriestId,
            isActive: true,
            eventDate: { in: databaseDates },
            id: excludeEventId ? { not: Number(excludeEventId) } : undefined,
          },
          select: { id: true, title: true, eventDate: true, startTime: true, endTime: true },
        })
      : [];
    for (const event of targetEvents) {
      if (!event.startTime) continue;
      const eventStart = parseManilaDateTime(event.eventDate, event.startTime);
      const eventEnd = event.endTime
        ? parseManilaDateTime(event.eventDate, event.endTime)
        : eventStart
          ? new Date(eventStart.getTime() + MASS_CONFLICT_DURATION_MS)
          : null;
      if (eventStart && eventEnd && eventStart < end && eventEnd > start) {
        await auditConflict(actorId, {
          priestId: parsedPriestId,
          dates: dateStrings,
          reason: "OVERLAP_EVENT",
          eventId: event.id,
        });
        throw createConflictError(
          `Already assigned to parish event "${event.title}" at this time.`,
          isPriestOwner
        );
      }
    }

    const applicableTypes = new Set();
    for (const item of coveredDates) {
      const dayName = item.dayName.toUpperCase();
      applicableTypes.add(dayName);
      if (["WEDNESDAY", "FRIDAY"].includes(dayName)) applicableTypes.add("WEEKDAY");
    }
    const templates = applicableTypes.size
      ? await client.massScheduleTemplate.findMany({
          where: {
            assignedPriestId: parsedPriestId,
            isActive: true,
            dayType: { in: [...applicableTypes] },
            id: excludeMassTemplateId ? { not: parseInt(excludeMassTemplateId, 10) } : undefined,
          },
          select: { id: true, label: true, timeSlot: true, dayType: true },
        })
      : [];
    for (const template of templates) {
      for (const item of coveredDates) {
        if (!massTemplateAppliesOnDate(template.dayType, item.dateStr)) continue;
        const massStart = parseManilaDateTime(item.dateStr, template.timeSlot);
        const massEnd = massStart ? new Date(massStart.getTime() + MASS_CONFLICT_DURATION_MS) : null;
        if (massStart && massEnd && massStart < end && massEnd > start) {
          await auditConflict(actorId, {
            priestId: parsedPriestId,
            dates: dateStrings,
            reason: "OVERLAP_MASS_TEMPLATE",
            templateId: template.id,
          });
          throw createConflictError(
            `Already assigned to recurring Mass "${template.label || template.timeSlot}" at this time.`,
            isPriestOwner
          );
        }
      }
    }

    const personalConflict = await client.priestPersonalSchedule.findFirst({
      where: {
        priestId: parsedPriestId,
        id: excludePersonalId ? { not: parseInt(excludePersonalId, 10) } : undefined,
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: { id: true, title: true },
    });
    if (personalConflict) {
      await auditConflict(actorId, {
        priestId: parsedPriestId,
        dates: dateStrings,
        reason: "OVERLAP_PERSONAL_SCHEDULE",
        personalScheduleId: personalConflict.id,
      });
      throw createConflictError(
        `Personal schedule conflict: Already scheduled "${personalConflict.title}" at this time.`,
        isPriestOwner
      );
    }
  }
}
