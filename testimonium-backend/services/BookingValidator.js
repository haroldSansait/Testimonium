import { resolveEventType } from "../shared/EventTypeCatalog.js";
// Scheduling configuration is supplied by the parish, never by client defaults.
import {
  parseManilaDateTime,
  parseManilaDateOnly,
  getManilaDateString,
} from "./ConflictHelper.js";

export const CANONICAL_SCHEDULE_EVENT_TYPES = [
  "WEDDING",
  "MARRIAGE_SPECIAL",
  "BAPTISM",
  "CONFIRMATION",
  "FIRST_COMMUNION",
  "CONFESSION",
  "ANOINTING_OF_THE_SICK",
  "PRIVATE_MASS",
  "MASS_INTENTION",
  "WAKE_MASS",
  "FUNERAL",
  "MASS_OF_HOLY_SPIRIT",
  "FIESTA",
  "THANKSGIVING",
  "BLESSING",
  "DELIVERANCE",
];

export const MAX_HORIZON_DAYS = 90; // 0..90 days inclusive (91 total Manila calendar days)
export const SCHEDULE_SLOT_DURATION_MINUTES = 60;

// These are parish-wide booking blocks created from the Admin availability
// configuration. PRIEST_LEAVE remains person-specific and is evaluated when
// a priest is assigned, so it must not make the entire parish unavailable.
export const PARISH_BOOKING_BLOCK_TYPES = [
  "PARISH_CLOSED",
  "SECRETARY_LEAVE",
  "FULLY_BOOKED",
];

/**
 * Computes date string for today + N days in Manila timezone.
 */
export function getManilaHorizonMaxDate(now = new Date(), horizonDays = MAX_HORIZON_DAYS) {
  const todayStr = getManilaDateString(now);
  const parsed = parseManilaDateOnly(todayStr);
  const futureUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + horizonDays, 0, 0, 0));
  return getManilaDateString(futureUtc);
}

/**
 * Validates requested date and time slot against the 90-Manila-calendar-day horizon.
 * Throws 400 AppError with specific code if invalid.
 */
export function validateDateHorizon(dateInput, timeSlot = null, now = new Date()) {
  const parsed = parseManilaDateOnly(dateInput);
  if (!parsed) {
    const err = new Error("Invalid date format. Expected YYYY-MM-DD.");
    err.statusCode = 400;
    err.code = "INVALID_DATE_FORMAT";
    throw err;
  }

  const todayStr = getManilaDateString(now);
  const maxDateStr = getManilaHorizonMaxDate(now, MAX_HORIZON_DAYS);

  if (parsed.dateStr < todayStr) {
    const err = new Error("Requested date cannot be in the past.");
    err.statusCode = 400;
    err.code = "DATE_IN_PAST";
    throw err;
  }

  if (parsed.dateStr > maxDateStr) {
    const err = new Error(
      `Requested date exceeds the maximum 90-day booking horizon (latest allowed: ${maxDateStr}).`
    );
    err.statusCode = 400;
    err.code = "DATE_OUT_OF_HORIZON";
    throw err;
  }

  // Same-day past-time check
  if (parsed.dateStr === todayStr && timeSlot) {
    const dt = parseManilaDateTime(parsed.dateStr, timeSlot);
    if (dt && dt.getTime() <= now.getTime()) {
      const err = new Error("Requested time slot has already passed for today.");
      err.statusCode = 400;
      err.code = "TIME_IN_PAST";
      throw err;
    }
  }

  return {
    parsed,
    dateStr: parsed.dateStr,
    dayName: parsed.dayName,
    todayStr,
    maxDateStr,
  };
}

/**
 * Validates and resolves the event type against the 16 canonical types.
 * Throws 400 AppError if invalid.
 */
export function validateCanonicalEventType(eventType) {
  if (!eventType) {
    const err = new Error("eventType is required.");
    err.statusCode = 400;
    err.code = "EVENT_TYPE_REQUIRED";
    throw err;
  }

  const resolved = resolveEventType(eventType);
  if (!resolved || !CANONICAL_SCHEDULE_EVENT_TYPES.includes(resolved)) {
    const err = new Error(
      `Invalid event type: '${eventType}'. Must be one of the 16 canonical schedule event types.`
    );
    err.statusCode = 400;
    err.code = "INVALID_EVENT_TYPE";
    throw err;
  }

  return resolved;
}

/**
 * Validates parish active status and office hours for the requested day and slot.
 */
export function validateParishAndOffice(parish, dayName, timeSlot = null) {
  if (!parish) {
    const err = new Error("Parish not found.");
    err.statusCode = 404;
    err.code = "PARISH_NOT_FOUND";
    throw err;
  }

  if (!parish.isActive) {
    const err = new Error("This parish is currently inactive and not accepting schedule bookings.");
    err.statusCode = 400;
    err.code = "PARISH_INACTIVE";
    throw err;
  }

  let officeHours = parish.officeHours;
  if (typeof officeHours === "string") {
    try { officeHours = JSON.parse(officeHours); } catch { officeHours = null; }
  }

  // Check office hours if configured. A configured open/close interval is
  // authoritative too; accepting a listed slot outside that interval would
  // bypass the parish's Admin configuration.
  if (officeHours && typeof officeHours === "object") {
    const daySchedule = officeHours[dayName] || officeHours[dayName.charAt(0).toUpperCase() + dayName.slice(1)];
    if (daySchedule) {
      const isClosed =
        daySchedule.isClosed === true ||
        daySchedule.closed === true ||
        (typeof daySchedule === "string" && daySchedule.toLowerCase().includes("closed"));
      if (isClosed) {
        const err = new Error(`Parish office is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.`);
        err.statusCode = 400;
        err.code = "OFFICE_CLOSED";
        throw err;
      }

      if (timeSlot && typeof daySchedule === "object") {
        const open = parseTimeSlotMinutes(daySchedule.openTime || daySchedule.open);
        const close = parseTimeSlotMinutes(daySchedule.closeTime || daySchedule.close);
        const requested = parseTimeSlotMinutes(timeSlot);

        if (open !== null && close !== null && requested !== null) {
          const endsAt = requested + SCHEDULE_SLOT_DURATION_MINUTES;
          if (requested < open || endsAt > close) {
            const err = new Error("Requested time slot is outside this parish's office hours.");
            err.statusCode = 400;
            err.code = "OUTSIDE_OFFICE_HOURS";
            throw err;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Validates that the requested date is not covered by a parish-wide availability block.
 */
export function validateParishAvailability(availabilities, dateStr) {
  if (!Array.isArray(availabilities) || availabilities.length === 0) return true;

  for (const availability of availabilities) {
    const blockStartStr = getManilaDateString(new Date(availability.startDate));
    const blockEndStr = getManilaDateString(new Date(availability.endDate));

    if (dateStr >= blockStartStr && dateStr <= blockEndStr) {
      const err = new Error(
        availability.description || availability.title || `Scheduling is unavailable on ${dateStr}.`
      );
      err.statusCode = 409;
      // Retain the established scheduling conflict code while sourcing the
      // block from the canonical ParishAvailability model.
      err.code = "SERVICE_BLOCKED";
      throw err;
    }
  }

  return true;
}

/**
 * Validates that the requested slot is in allowable slots, and daily & slot capacities are not exceeded.
 */
export function validateSlotAndCapacity(
  allowableSlots,
  activeBookingsOnDate,
  timeSlot,
  customDailyLimit,
  customSlotLimit
) {
  const normSlot = timeSlot.trim().toUpperCase();
  const normalizedAllowable = (allowableSlots || []).map((s) => s.trim().toUpperCase());

  if (
    !Array.isArray(allowableSlots) ||
    !Number.isInteger(customDailyLimit) || customDailyLimit <= 0 ||
    !Number.isInteger(customSlotLimit) || customSlotLimit <= 0
  ) {
    const err = new Error("Scheduling configuration is incomplete for this parish.");
    err.statusCode = 409;
    err.code = "SCHEDULING_CONFIGURATION_INCOMPLETE";
    throw err;
  }

  if (!normalizedAllowable.includes(normSlot)) {
    const err = new Error(
      `Requested time slot '${timeSlot}' is not an allowable booking slot for this service.`
    );
    err.statusCode = 400;
    err.code = "INVALID_TIME_SLOT";
    throw err;
  }

  // Active bookings are non-cancelled, non-rejected schedules on that date
  const activeBookings = (activeBookingsOnDate || []).filter(
    (s) => !["CANCELLED", "REJECTED"].includes(s.status)
  );

  const dailyLimit = customDailyLimit;
  if (activeBookings.length >= dailyLimit) {
    const err = new Error("Daily booking capacity reached for the selected date.");
    err.statusCode = 409;
    err.code = "DAILY_CAPACITY_EXCEEDED";
    throw err;
  }

  // Count active bookings for this specific slot
  const slotCount = activeBookings.filter((s) => {
    if (s.remarks) {
      const match = s.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (match && match[1].trim().toUpperCase() === normSlot) {
        return true;
      }
    }
    return false;
  }).length;

  const slotLimit = customSlotLimit;
  if (slotCount >= slotLimit) {
    const err = new Error(`Time slot '${timeSlot}' is fully booked. Please choose another slot.`);
    err.statusCode = 409;
    err.code = "SLOT_CAPACITY_EXCEEDED";
    throw err;
  }

  return true;
}

export function parseTimeSlotMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  return ((hour % 12) + (period === "PM" ? 12 : 0)) * 60 + minute;
}

/**
 * Validates assigned priest availability against priest's schedules and parish events.
 */
export function validatePriestConflict(priestSchedules, parishEvents, requestedDateStr, timeSlot, ignoreScheduleId = null) {
  const normSlot = timeSlot.trim().toUpperCase();

  if (Array.isArray(priestSchedules)) {
    for (const sched of priestSchedules) {
      if (ignoreScheduleId && sched.id === ignoreScheduleId) continue;
      if (["CANCELLED", "REJECTED"].includes(sched.status)) continue;

      const schedDateStr = getManilaDateString(new Date(sched.requestedDate));
      if (schedDateStr === requestedDateStr) {
        if (sched.remarks) {
          const match = sched.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (match && match[1].trim().toUpperCase() === normSlot) {
            const err = new Error("The assigned priest has a conflicting appointment at this time.");
            err.statusCode = 409;
            err.code = "PRIEST_SCHEDULE_CONFLICT";
            throw err;
          }
        }
      }
    }
  }

  return true;
}
