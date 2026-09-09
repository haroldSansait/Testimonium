import { prisma } from "../config/db.js";
import {
  parseManilaDateOnly,
  parseStrictManilaDateOnly,
  isValidStrictManilaDate,
  getManilaDateString,
  parseManilaDateTime,
  computeOperationalEndDatetime,
  evaluatePriestConflictFromSnapshot,
  BLOCKING_SCHEDULE_STATUSES,
} from "./ConflictHelper.js";
import {
  MAX_HORIZON_DAYS,
  PARISH_BOOKING_BLOCK_TYPES,
  getManilaHorizonMaxDate,
  validateParishAndOffice,
  validateParishAvailability,
  validateCanonicalEventType,
  extractScheduleTimeSlot,
  normalizeTimeSlotString,
} from "./BookingValidator.js";
import {
  requireEnabledSchedulingService,
} from "./SchedulingConfiguration.js";
import {
  evaluateSchedulingRules,
  normalizePriestId,
  normalizeParishId,
} from "./SchedulingAvailability.js";

export { extractScheduleTimeSlot, normalizeTimeSlotString, normalizeParishId };

export const MAX_RECOMMENDATIONS = 6;

export const GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE =
  "The selected preferred priest is not available for this request.";

/**
 * Single strict requested-priest eligibility helper.
 * Rules:
 * - valid positive safe integer ID
 * - role === PRIEST
 * - status === ACTIVE
 * - parishId === selected parishId
 *
 * All failures return code INVALID_REQUESTED_PRIEST and generic message.
 */
export async function validateRequestedPriestEligibility(priestId, parishId, client = prisma) {
  let parsedPriestId;
  try {
    parsedPriestId = normalizePriestId(priestId);
  } catch {
    const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
    err.statusCode = 400;
    err.code = "INVALID_REQUESTED_PRIEST";
    throw err;
  }

  const parsedParishId = normalizeParishId(parishId);

  const targetPriest = await client.user.findUnique({
    where: { id: parsedPriestId },
    include: { role: true },
  });

  if (!targetPriest) {
    const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
    err.statusCode = 400;
    err.code = "INVALID_REQUESTED_PRIEST";
    throw err;
  }

  if (targetPriest.role?.roleName !== "PRIEST") {
    const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
    err.statusCode = 400;
    err.code = "INVALID_REQUESTED_PRIEST";
    throw err;
  }

  if (targetPriest.status !== "ACTIVE") {
    const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
    err.statusCode = 400;
    err.code = "INVALID_REQUESTED_PRIEST";
    throw err;
  }

  if (Number(targetPriest.parishId) !== parsedParishId) {
    const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
    err.statusCode = 400;
    err.code = "INVALID_REQUESTED_PRIEST";
    throw err;
  }

  return {
    id: targetPriest.id,
    name: targetPriest.fullName || targetPriest.name || null,
    isAssistant: Boolean(targetPriest.isAssistant),
  };
}

/**
 * Returns safe public identity of eligible priests for a parish.
 */
export async function getEligiblePriestsForParish(parishId, actor = null, client = prisma) {
  const parsedParishId = normalizeParishId(parishId);

  // Tenancy isolation check for staff: fail closed on missing/null context
  if (actor && ["SECRETARY", "PRIEST", "STAFF"].includes(actor.role)) {
    const staffParishId = actor.parish?.id || actor.parishId;
    if (!staffParishId || Number(staffParishId) !== parsedParishId) {
      const err = new Error("Staff members may only query priests for their assigned parish.");
      err.statusCode = 403;
      err.code = "FORBIDDEN_PARISH_ACCESS";
      throw err;
    }
  }

  const parish = await client.parish.findUnique({
    where: { id: parsedParishId },
    select: { id: true, isActive: true },
  });

  if (!parish) {
    const err = new Error("Parish not found.");
    err.statusCode = 404;
    err.code = "PARISH_NOT_FOUND";
    throw err;
  }

  if (!parish.isActive) {
    const err = new Error("Parish is currently inactive.");
    err.statusCode = 400;
    err.code = "PARISH_INACTIVE";
    throw err;
  }

  const priests = await client.user.findMany({
    where: {
      parishId: parsedParishId,
      status: "ACTIVE",
      role: { roleName: "PRIEST" },
    },
    select: {
      id: true,
      fullName: true,
      isAssistant: true,
    },
    orderBy: [
      { isAssistant: "asc" },
      { fullName: "asc" },
    ],
  });

  return priests.map((p) => ({
    id: p.id,
    name: p.fullName || p.name,
    isAssistant: Boolean(p.isAssistant),
  }));
}

/**
 * Batch-loads parish configuration, rules, availability blocks, and schedules for a bounded range.
 */
export async function loadParishAvailabilitySnapshot(parishId, fromDateStr, toDateStr, eventType, client = prisma) {
  const parsedParishId = normalizeParishId(parishId);
  const fromParsed = parseStrictManilaDateOnly(fromDateStr);
  const toParsed = parseStrictManilaDateOnly(toDateStr);

  if (!fromParsed || !toParsed) {
    throw new Error("Invalid search window dates. Expected YYYY-MM-DD.");
  }

  const rangeStartInstant = fromParsed.dateObj;
  const rangeEndExclusiveInstant = new Date(toParsed.dateObj.getTime() + 24 * 60 * 60 * 1000);

  const parish = await client.parish.findUnique({
    where: { id: parsedParishId },
    include: {
      availabilities: {
        where: {
          type: { in: PARISH_BOOKING_BLOCK_TYPES },
          startDate: { lt: rangeEndExclusiveInstant },
          endDate: { gte: rangeStartInstant },
        },
      },
      weekdayRules: true,
      serviceWeekdayRules: true,
      scheduleDateRules: {
        where: { exceptionDate: { gte: fromParsed.databaseDate, lte: toParsed.databaseDate } },
        include: { serviceOverrides: true },
      },
    },
  });

  if (!parish) {
    const err = new Error("Parish not found.");
    err.statusCode = 404;
    err.code = "PARISH_NOT_FOUND";
    throw err;
  }

  if (!parish.isActive) {
    const err = new Error("Parish is currently inactive.");
    err.statusCode = 400;
    err.code = "PARISH_INACTIVE";
    throw err;
  }

  const schedulingConfig = requireEnabledSchedulingService(parish, eventType);

  const schedules = await client.schedule.findMany({
    where: {
      parishId: parsedParishId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      OR: [
        { requestedDate: { gte: fromParsed.databaseDate, lte: toParsed.databaseDate } },
        { startDatetime: { gte: rangeStartInstant, lt: rangeEndExclusiveInstant } },
      ],
    },
    select: {
      id: true,
      requestedDate: true,
      startDatetime: true,
      endDatetime: true,
      remarks: true,
      status: true,
    },
  });

  // Group schedules by Manila date string
  const schedulesByDate = new Map();
  for (const s of schedules) {
    let dateStr = null;
    if (s.requestedDate) {
      dateStr = getManilaDateString(s.requestedDate);
    } else if (s.startDatetime) {
      dateStr = getManilaDateString(s.startDatetime);
    }
    if (dateStr) {
      if (!schedulesByDate.has(dateStr)) {
        schedulesByDate.set(dateStr, []);
      }
      schedulesByDate.get(dateStr).push(s);
    }
  }

  return {
    parish,
    schedulingConfig,
    availabilities: parish.availabilities || [],
    weekdayRules: parish.weekdayRules || [],
    serviceWeekdayRules: parish.serviceWeekdayRules || [],
    scheduleDateRules: parish.scheduleDateRules || [],
    schedulesByDate,
  };
}

/**
 * Batch-loads priest conflict data across all 5 canonical sources for a bounded date range.
 * Supports cross-boundary commitments and operational fallback intervals.
 */
export async function loadPriestConflictSnapshot(priestId, fromDateStr, toDateStr, client = prisma) {
  const parsedPriestId = normalizePriestId(priestId);
  const fromParsed = parseStrictManilaDateOnly(fromDateStr);
  const toParsed = parseStrictManilaDateOnly(toDateStr);

  if (!fromParsed || !toParsed) {
    throw new Error("Invalid search window dates. Expected YYYY-MM-DD.");
  }

  const prevDayDbDate = new Date(fromParsed.databaseDate.getTime() - 24 * 60 * 60 * 1000);
  const nextDayDbDate = new Date(toParsed.databaseDate.getTime() + 24 * 60 * 60 * 1000);

  const rangeStartInstant = fromParsed.dateObj;
  const rangeEndExclusiveInstant = new Date(toParsed.dateObj.getTime() + 24 * 60 * 60 * 1000);
  const candidateMaxInstant = new Date(rangeEndExclusiveInstant.getTime() + 60 * 60 * 1000);
  const fallbackMinInstant = new Date(rangeStartInstant.getTime() - 60 * 60 * 1000);

  const [leaves, schedules, events, massTemplates, personalSchedules] = await Promise.all([
    // 1. PRIEST_LEAVE
    client.parishAvailability.findMany({
      where: {
        userId: parsedPriestId,
        type: "PRIEST_LEAVE",
        startDate: { lt: candidateMaxInstant },
        endDate: { gte: rangeStartInstant },
      },
      select: { id: true, startDate: true, endDate: true, title: true },
    }),
    // 2. Assigned blocking schedules (cross-boundary & fallback interval safe, NO timeSlot select)
    client.schedule.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        status: { in: BLOCKING_SCHEDULE_STATUSES },
        OR: [
          {
            startDatetime: { lt: candidateMaxInstant },
            endDatetime: { gt: rangeStartInstant },
          },
          {
            startDatetime: { gte: fallbackMinInstant, lt: candidateMaxInstant },
            endDatetime: null,
          },
          {
            requestedDate: { gte: prevDayDbDate, lte: nextDayDbDate },
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
    }),
    // 3. Parish events (boundary safe)
    client.parishEvent.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
        eventDate: { gte: prevDayDbDate, lte: nextDayDbDate },
      },
      select: { id: true, title: true, eventDate: true, startTime: true, endTime: true },
    }),
    // 4. Recurring mass templates
    client.massScheduleTemplate.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
      },
      select: { id: true, label: true, timeSlot: true, dayType: true },
    }),
    // 5. Personal schedules (half-open overlap: startAt < candidateMax && endAt > rangeStart)
    client.priestPersonalSchedule.findMany({
      where: {
        priestId: parsedPriestId,
        startAt: { lt: candidateMaxInstant },
        endAt: { gt: rangeStartInstant },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
    }),
  ]);

  return {
    priestId: parsedPriestId,
    leaves,
    schedules,
    events,
    massTemplates,
    personalSchedules,
  };
}

/**
 * Evaluates candidate slot availability against parish configuration, rules, and capacity.
 * Expected domain conditions return false; system errors propagate.
 */
export function evaluateCandidateSlot(parishSnapshot, dateStr, timeSlot, eventType, now = new Date()) {
  const parsed = parseManilaDateOnly(dateStr);
  if (!parsed) return false;

  const todayStr = getManilaDateString(now);

  // Past dates or same-day past times are unavailable
  if (dateStr < todayStr) return false;
  if (dateStr === todayStr) {
    const slotDt = parseManilaDateTime(dateStr, timeSlot);
    if (slotDt && slotDt.getTime() <= now.getTime()) {
      return false;
    }
  }

  // 1. Office hours check
  try {
    validateParishAndOffice(parishSnapshot.parish, parsed.dayName, timeSlot);
  } catch (err) {
    if (["OFFICE_CLOSED", "OUTSIDE_OFFICE_HOURS"].includes(err.code)) {
      return false;
    }
    throw err;
  }

  // 2. Parish availability blocks (e.g. PARISH_CLOSED, FULLY_BOOKED, SECRETARY_LEAVE)
  try {
    validateParishAvailability(parishSnapshot.availabilities, dateStr);
  } catch (err) {
    if (["PARISH_CLOSED", "FULLY_BOOKED"].includes(err.code)) {
      return false;
    }
    throw err;
  }

  // 3. Weekday and date-specific rules
  try {
    evaluateSchedulingRules({
      eventType,
      dateInput: dateStr,
      weekdayRules: parishSnapshot.weekdayRules,
      serviceWeekdayRules: parishSnapshot.serviceWeekdayRules,
      dateRule: parishSnapshot.scheduleDateRules.find(
        (rule) => getManilaDateString(new Date(rule.exceptionDate)) === dateStr
      ) || null,
    });
  } catch (err) {
    if (["SERVICE_UNAVAILABLE_ON_DAY", "DATE_UNAVAILABLE"].includes(err.code)) {
      return false;
    }
    throw err;
  }

  // 4. Capacity checks
  const schedulesOnDate = parishSnapshot.schedulesByDate.get(dateStr) || [];
  if (schedulesOnDate.length >= parishSnapshot.schedulingConfig.dailyCapacity) {
    return false;
  }

  const normTargetSlot = normalizeTimeSlotString(timeSlot);
  const slotCount = schedulesOnDate.filter((s) => {
    const sSlot = extractScheduleTimeSlot(s);
    return sSlot && sSlot === normTargetSlot;
  }).length;

  if (slotCount >= parishSnapshot.schedulingConfig.slotCapacity) {
    return false;
  }

  return true;
}

/**
 * Main Schedule Recommendation Orchestrator.
 * READ-ONLY. Deterministic ranking.
 */
export async function getScheduleRecommendations(
  {
    parishId,
    eventType,
    preferredDate,
    dateFrom,
    dateTo,
    preferredTimeSlot,
    requestedPriestId,
  },
  actor = null,
  client = prisma,
  now = new Date()
) {
  const parsedParishId = normalizeParishId(parishId);
  const canonicalEventType = validateCanonicalEventType(eventType);

  // Tenancy isolation check for staff: fail closed on missing/null context
  if (actor && ["SECRETARY", "PRIEST", "STAFF"].includes(actor.role)) {
    const staffParishId = actor.parish?.id || actor.parishId;
    if (!staffParishId || Number(staffParishId) !== parsedParishId) {
      const err = new Error("Staff members may only view recommendations for their assigned parish.");
      err.statusCode = 403;
      err.code = "FORBIDDEN_PARISH_ACCESS";
      throw err;
    }
  }

  // Authoritative scheduling horizon: Manila today -> Manila today + 90 days inclusive
  const todayStr = getManilaDateString(now);
  const maxDateStr = getManilaHorizonMaxDate(now, MAX_HORIZON_DAYS);

  // Preferred date validation (required ranking anchor)
  if (!preferredDate) {
    const err = new Error("preferredDate is required.");
    err.statusCode = 400;
    err.code = "PREFERRED_DATE_REQUIRED";
    throw err;
  }
  const preferredParsed = parseStrictManilaDateOnly(preferredDate);
  if (!preferredParsed) {
    const err = new Error("Invalid preferredDate format. Expected YYYY-MM-DD.");
    err.statusCode = 400;
    err.code = "INVALID_DATE_FORMAT";
    throw err;
  }
  if (preferredParsed.dateStr < todayStr || preferredParsed.dateStr > maxDateStr) {
    const err = new Error(`preferredDate must be within the booking horizon (${todayStr} to ${maxDateStr}).`);
    err.statusCode = 400;
    err.code = "PREFERRED_DATE_OUT_OF_HORIZON";
    throw err;
  }

  // Window range: BOTH OR NEITHER policy
  let effectiveFrom = todayStr;
  let effectiveTo = maxDateStr;

  const hasFrom = dateFrom !== undefined && dateFrom !== null && String(dateFrom).trim() !== "";
  const hasTo = dateTo !== undefined && dateTo !== null && String(dateTo).trim() !== "";

  if (hasFrom !== hasTo) {
    const err = new Error("dateFrom and dateTo must both be provided or both omitted.");
    err.statusCode = 400;
    err.code = "INVALID_SEARCH_WINDOW";
    throw err;
  }

  if (hasFrom && hasTo) {
    const fromP = parseStrictManilaDateOnly(dateFrom);
    const toP = parseStrictManilaDateOnly(dateTo);
    if (!fromP || !toP) {
      const err = new Error("Invalid dateFrom or dateTo format. Expected YYYY-MM-DD.");
      err.statusCode = 400;
      err.code = "INVALID_DATE_FORMAT";
      throw err;
    }
    if (fromP.dateStr > toP.dateStr) {
      const err = new Error("dateFrom cannot be later than dateTo.");
      err.statusCode = 400;
      err.code = "INVALID_SEARCH_WINDOW";
      throw err;
    }
    if (fromP.dateStr < todayStr || toP.dateStr > maxDateStr) {
      const err = new Error(`Search window must be within the booking horizon (${todayStr} to ${maxDateStr}).`);
      err.statusCode = 400;
      err.code = "SEARCH_WINDOW_OUT_OF_HORIZON";
      throw err;
    }
    effectiveFrom = fromP.dateStr;
    effectiveTo = toP.dateStr;
  }

  // Preferred time slot syntax validation
  let normalizedPreferredSlot = null;
  if (preferredTimeSlot) {
    normalizedPreferredSlot = normalizeTimeSlotString(preferredTimeSlot);
    if (!normalizedPreferredSlot) {
      const err = new Error("Invalid preferredTimeSlot format. Expected 'HH:MM AM/PM'.");
      err.statusCode = 400;
      err.code = "INVALID_PREFERRED_TIME_SLOT";
      throw err;
    }
  }

  // Requested priest eligibility validation (if provided)
  let eligiblePriest = null;
  if (requestedPriestId !== undefined && requestedPriestId !== null && requestedPriestId !== "") {
    eligiblePriest = await validateRequestedPriestEligibility(requestedPriestId, parsedParishId, client);
  }

  // Batch load parish snapshot
  const parishSnapshot = await loadParishAvailabilitySnapshot(
    parsedParishId,
    effectiveFrom,
    effectiveTo,
    canonicalEventType,
    client
  );

  // Preferred time slot configuration check
  if (normalizedPreferredSlot) {
    const configuredNormalized = (parishSnapshot.schedulingConfig.timeSlots || []).map(normalizeTimeSlotString);
    if (!configuredNormalized.includes(normalizedPreferredSlot)) {
      const err = new Error(
        `Preferred time slot '${preferredTimeSlot}' is not configured for this parish and service.`
      );
      err.statusCode = 400;
      err.code = "INVALID_PREFERRED_TIME_SLOT";
      throw err;
    }
  }

  // Batch load priest snapshot if requested priest provided
  let priestSnapshot = null;
  if (eligiblePriest) {
    priestSnapshot = await loadPriestConflictSnapshot(
      eligiblePriest.id,
      effectiveFrom,
      effectiveTo,
      client
    );
  }

  // Candidate generation
  const candidates = [];
  const fromP = parseManilaDateOnly(effectiveFrom);
  const toP = parseManilaDateOnly(effectiveTo);

  const startUtc = Date.UTC(fromP.year, fromP.month - 1, fromP.day);
  const endUtc = Date.UTC(toP.year, toP.month - 1, toP.day);

  for (let cursor = startUtc; cursor <= endUtc; cursor += 24 * 60 * 60 * 1000) {
    const currDateStr = getManilaDateString(new Date(cursor));

    for (const slot of parishSnapshot.schedulingConfig.timeSlots) {
      const isAvailable = evaluateCandidateSlot(
        parishSnapshot,
        currDateStr,
        slot,
        canonicalEventType,
        now
      );

      if (!isAvailable) continue;

      const candidateStart = parseManilaDateTime(currDateStr, slot);
      if (!candidateStart) continue;
      const candidateEnd = computeOperationalEndDatetime(candidateStart);

      let preferredPriestAvailable;
      if (priestSnapshot) {
        const conflict = evaluatePriestConflictFromSnapshot(priestSnapshot, candidateStart, candidateEnd);
        preferredPriestAvailable = conflict.available;
      }

      // Format ISO startAt with explicit Asia/Manila (+08:00)
      const parts = parseManilaDateOnly(currDateStr);
      const slotMatch = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      let h = Number(slotMatch[1]);
      const m = slotMatch[2];
      const p = slotMatch[3].toUpperCase();
      if (p === "PM" && h < 12) h += 12;
      if (p === "AM" && h === 12) h = 0;
      const startAt = `${parts.dateStr}T${String(h).padStart(2, "0")}:${m}:00.000+08:00`;

      candidates.push({
        date: currDateStr,
        timeSlot: slot,
        startAt,
        preferredPriestAvailable,
        dayOffset: Math.round(Math.abs(cursor - Date.UTC(preferredParsed.year, preferredParsed.month - 1, preferredParsed.day)) / (24 * 60 * 60 * 1000)),
      });
    }
  }

  // Deterministic Ranking (Section 20):
  // 1. absolute date distance from preferredDate
  // 2. if requested priest exists: requested priest available first
  // 3. exact preferredTimeSlot match if supplied
  // 4. earlier calendar date
  // 5. parish configured slot order
  // 6. stable deterministic tie-breaker
  const configuredSlots = parishSnapshot.schedulingConfig.timeSlots || [];

  candidates.sort((a, b) => {
    // 1. Absolute date distance from preferredDate
    if (a.dayOffset !== b.dayOffset) {
      return a.dayOffset - b.dayOffset;
    }

    // 2. Requested priest available first (if preference supplied)
    if (eligiblePriest) {
      const aPriest = a.preferredPriestAvailable ? 1 : 0;
      const bPriest = b.preferredPriestAvailable ? 1 : 0;
      if (aPriest !== bPriest) {
        return bPriest - aPriest;
      }
    }

    // 3. Exact preferredTimeSlot match if supplied
    if (normalizedPreferredSlot) {
      const aTimeMatch = normalizeTimeSlotString(a.timeSlot) === normalizedPreferredSlot ? 1 : 0;
      const bTimeMatch = normalizeTimeSlotString(b.timeSlot) === normalizedPreferredSlot ? 1 : 0;
      if (aTimeMatch !== bTimeMatch) {
        return bTimeMatch - aTimeMatch;
      }
    }

    // 4. Earlier calendar date
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    // 5. Parish configured slot order
    const aSlotIdx = configuredSlots.indexOf(a.timeSlot);
    const bSlotIdx = configuredSlots.indexOf(b.timeSlot);
    if (aSlotIdx !== bSlotIdx) {
      return aSlotIdx - bSlotIdx;
    }

    // 6. Stable deterministic tie-breaker
    return `${a.date}_${a.timeSlot}`.localeCompare(`${b.date}_${b.timeSlot}`);
  });

  // Top MAX_RECOMMENDATIONS
  const topRecommendations = candidates.slice(0, MAX_RECOMMENDATIONS);

  // Map to public recommendation DTO
  const recommendations = topRecommendations.map((item) => {
    const reasons = [];

    if (item.date === preferredParsed.dateStr) {
      reasons.push("PREFERRED_DATE");
    }

    if (eligiblePriest) {
      if (item.preferredPriestAvailable) {
        reasons.push("PREFERRED_PRIEST_AVAILABLE");
      } else {
        reasons.push("PREFERRED_PRIEST_UNAVAILABLE");
      }
    }

    if (normalizedPreferredSlot && normalizeTimeSlotString(item.timeSlot) === normalizedPreferredSlot) {
      reasons.push("PREFERRED_TIME");
    }

    const dto = {
      date: item.date,
      timeSlot: item.timeSlot,
      startAt: item.startAt,
      reasons,
    };

    if (eligiblePriest) {
      dto.preferredPriestAvailable = item.preferredPriestAvailable;
    }

    return dto;
  });

  return {
    success: true,
    ...(recommendations.length === 0 ? { code: "NO_SCHEDULE_RECOMMENDATIONS" } : {}),
    parishId: parsedParishId,
    eventType: canonicalEventType,
    preferredDate: preferredParsed.dateStr,
    window: {
      from: effectiveFrom,
      to: effectiveTo,
    },
    generatedAt: now.toISOString(),
    recommendations,
  };
}
