import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper, parseManilaDateTime, parseManilaDateOnly, getManilaDateString, formatManilaTimeSlot } from "./ConflictHelper.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { PriestAssignmentHandler } from "./PriestAssignmentHandler.js";
import { IdempotencyService, computeSchedulePayloadHash } from "./IdempotencyService.js";
import {
  MAX_HORIZON_DAYS,
  validateDateHorizon,
  validateCanonicalEventType,
  validateParishAndOffice,
  validateParishAvailability,
  PARISH_BOOKING_BLOCK_TYPES,
  validateSlotAndCapacity,
  validatePriestConflict,
  getManilaHorizonMaxDate,
} from "./BookingValidator.js";
import { resolveEventMetadata } from "../shared/EventTypeCatalog.js";
import { getParishSchedulingConfiguration, requireEnabledSchedulingService } from "./SchedulingConfiguration.js";
import {
  evaluateSchedulingRules,
  loadSchedulingRules,
  lockParishSchedulingConfiguration,
} from "./SchedulingAvailability.js";

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED"];

function authorizeStaffScheduleMutation(actorRole, actorParishId, scheduleParishId, action) {
  if (actorRole === "DIOCESE_COORDINATOR") return;
  if (!["SECRETARY", "PRIEST"].includes(actorRole)) {
    const error = new Error(`You do not have permission to ${action} schedule requests.`);
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
  if (!actorParishId || Number(scheduleParishId) !== Number(actorParishId)) {
    const error = new Error(`You do not have permission to ${action} schedules from another parish.`);
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

/**
 * Enforcement invariant: a schedule MUST NOT reach CONFIRMED unless a priest
 * is assigned AND has explicitly accepted the assignment.
 *
 * The canonical accepted value is 'ACCEPTED' — matching priestResponseStatus
 * set by PriestAssignmentHandler and respondPriestAssignment().
 *
 * @param {object} schedule - Current schedule record from DB
 * @throws 422 domain error if the invariant is not satisfied
 */
function requirePriestAccepted(schedule) {
  if (!schedule.assignedPriestId) {
    const err = new Error(
      "A priest must be assigned to this schedule before it can be confirmed."
    );
    err.statusCode = 422;
    err.code = "PRIEST_ASSIGNMENT_REQUIRED";
    throw err;
  }
  if (schedule.priestResponseStatus !== "ACCEPTED") {
    const err = new Error(
      "The assigned priest has not yet accepted this assignment. " +
        "Confirmation is only allowed after the priest accepts."
    );
    err.statusCode = 422;
    err.code = "PRIEST_ASSIGNMENT_PENDING";
    throw err;
  }
}

/**
 * Checks whether a schedule occurrence has elapsed based on exact time in Asia/Manila.
 * Boundary: now >= occurrence end instant means the schedule is elapsed.
 * @param {object} schedule
 * @param {Date} now
 * @returns {boolean}
 */
export function isScheduleElapsed(schedule, now = new Date()) {
  if (TERMINAL_STATUSES.includes(schedule.status)) {
    return true;
  }

  if (schedule.endDatetime) {
    const end = new Date(schedule.endDatetime);
    if (!isNaN(end.getTime())) {
      return now.getTime() >= end.getTime();
    }
  }

  if (schedule.startDatetime) {
    const start = new Date(schedule.startDatetime);
    if (!isNaN(start.getTime())) {
      const endEstimate = new Date(start.getTime() + 60 * 60 * 1000);
      return now.getTime() >= endEstimate.getTime();
    }
  }

  if (schedule.remarks && schedule.requestedDate) {
    const match = schedule.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (match) {
      const dateStr = getManilaDateString(new Date(schedule.requestedDate));
      const dt = parseManilaDateTime(dateStr, match[1].trim());
      if (dt) {
        const slotEnd = new Date(dt.getTime() + 60 * 60 * 1000);
        return now.getTime() >= slotEnd.getTime();
      }
    }
  }

  if (schedule.requestedDate) {
    const dateStr = getManilaDateString(new Date(schedule.requestedDate));
    const parsed = parseManilaDateOnly(dateStr);
    if (parsed) {
      // End of Manila calendar day (23:59:59.999 UTC+8 is 15:59:59.999 UTC)
      const endOfDayUtc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 15, 59, 59, 999));
      return now.getTime() >= endOfDayUtc.getTime();
    }
  }

  return false;
}

export class ScheduleService {
  constructor(scheduleRepository = new ScheduleRepository()) {
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Returns a paginated list of schedule requests with optional filters and scope.
   */
  async list({ page = 1, limit = 10, search, status, parishId, userId, priestId, scope } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Scoped filtering for parishioner context
    if (userId && (scope === "upcoming" || scope === "history")) {
      const parsedUserId = parseInt(userId, 10);
      const now = new Date();

      let statusFilter;
      if (scope === "upcoming") {
        statusFilter = { in: ["PENDING", "REQUESTED", "PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE", "CONFIRMED"] };
      }

      const where = {
        userId: parsedUserId,
        ...(parishId ? { parishId: parseInt(parishId, 10) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search
          ? {
              OR: [
                { user: { fullName: { contains: search, mode: "insensitive" } } },
                { remarks: { contains: search, mode: "insensitive" } },
                { displayTitle: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const allUserSchedules = await prisma.schedule.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
          parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
          processedBy: { select: { id: true, fullName: true } },
          assignedPriest: { select: { id: true, fullName: true } },
        },
      });

      const filtered = allUserSchedules.filter((sched) => {
        const elapsed = isScheduleElapsed(sched, now);
        return scope === "upcoming" ? !elapsed : elapsed;
      });

      // Sort: upcoming ascending by date, history descending by date
      filtered.sort((a, b) => {
        const dateA = new Date(a.startDatetime || a.requestedDate).getTime();
        const dateB = new Date(b.startDatetime || b.requestedDate).getTime();
        return scope === "upcoming" ? dateA - dateB : dateB - dateA;
      });

      const paginated = filtered.slice(skip, skip + parsedLimit);
      return { data: paginated, total: filtered.length };
    }

    // Default standard listing (used by Web and Admin Portal)
    const where = {
      ...(parishId ? { parishId: parseInt(parishId, 10) } : {}),
      ...(userId ? { userId: parseInt(userId, 10) } : {}),
      ...(priestId ? { assignedPriestId: parseInt(priestId, 10) } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { remarks: { contains: search, mode: "insensitive" } },
              { displayTitle: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: { requestedDate: "desc" },
        include: {
          user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
          parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
          processedBy: { select: { id: true, fullName: true } },
          assignedPriest: { select: { id: true, fullName: true } },
        },
      }),
      prisma.schedule.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Retrieves a single schedule request with authorization check.
   */
  async getById(id, actorId, actorRole, actorParishId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        user: { select: { id: true, fullName: true, email: true, contactNumber: true, address: true } },
        parish: {
          select: {
            id: true,
            parishName: true,
            type: true,
            municipalityCity: true,
            province: true,
            contactNumber: true,
            email: true,
            address: true,
          },
        },
        processedBy: { select: { id: true, fullName: true, email: true } },
        assignedPriest: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    // Role-based access control
    if (actorRole === "PARISHIONER") {
      if (schedule.userId !== actorId) {
        const err = new Error("You do not have permission to view this schedule request.");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    } else if (["SECRETARY", "PRIEST", "STAFF"].includes(actorRole)) {
      if (actorParishId && schedule.parishId !== actorParishId) {
        const err = new Error("You do not have permission to view schedules from other parishes.");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        throw err;
      }
    }

    return schedule;
  }

  /**
   * Returns the parishioner-safe scheduling configuration used by every
   * booking read/mutation path. No client receives or derives a fallback.
   */
  async getSchedulingConfiguration(parishId) {
    const parsedParishId = parseInt(parishId, 10);
    if (isNaN(parsedParishId)) {
      const err = new Error("Invalid parishId.");
      err.statusCode = 400;
      err.code = "INVALID_PARISH_ID";
      throw err;
    }

    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
      select: {
        id: true,
        isActive: true,
        eventSettings: true,
        officeHours: true,
        venueCapacity: true,
        schedulingConfigVersion: true,
        updatedAt: true,
      },
    });

    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      err.code = "PARISH_NOT_FOUND";
      throw err;
    }

    const config = getParishSchedulingConfiguration(parish);
    const schedulingAvailable = Boolean(
      parish.isActive &&
      config.isConfigured &&
      config.enabledServices.length &&
      config.timeSlots.length
    );

    return {
      parishId: parish.id,
      schedulingAvailable,
      configurationUnavailable: !config.isConfigured,
      services: schedulingAvailable
        ? config.enabledServices.map((eventType) => ({
            eventType,
            label: resolveEventMetadata(eventType)?.title || eventType,
          }))
        : [],
      timeSlots: schedulingAvailable ? config.timeSlots : [],
      capacity: schedulingAvailable
        ? { dailyLimit: config.dailyCapacity, slotCapacity: config.slotCapacity }
        : null,
      venueCapacity: config.venueCapacity,
      horizonDays: MAX_HORIZON_DAYS,
      schedulingConfigVersion: parish.schedulingConfigVersion,
      configurationUpdatedAt: parish.updatedAt?.toISOString?.() || null,
    };
  }

  /**
   * Evaluates available dates over the 90-Manila-calendar-day horizon.
   * Batch loads parish-wide availability blocks and active bookings to eliminate N+1 queries.
   */
  async getAvailabilityDates(parishId, eventType) {
    const parsedParishId = parseInt(parishId, 10);
    if (isNaN(parsedParishId)) {
      const err = new Error("Invalid parishId.");
      err.statusCode = 400;
      err.code = "INVALID_PARISH_ID";
      throw err;
    }

    const canonicalEventType = validateCanonicalEventType(eventType);
    const now = new Date();
    const todayDateStr = getManilaDateString(now);
    const maxHorizonDateStr = getManilaHorizonMaxDate(now, MAX_HORIZON_DAYS);

    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
      include: {
        availabilities: {
          where: {
            type: { in: PARISH_BOOKING_BLOCK_TYPES },
          },
        },
        weekdayRules: true,
        serviceWeekdayRules: true,
        scheduleDateRules: {
          include: { serviceOverrides: true },
        },
      },
    });

    if (!parish || !parish.isActive) {
      return {
        eventType: canonicalEventType,
        serviceAvailable: false,
        dates: [],
      };
    }

    let schedulingConfig;
    try { schedulingConfig = requireEnabledSchedulingService(parish, canonicalEventType); } catch { return { eventType: canonicalEventType, serviceAvailable: false, dates: [] }; }
    if (!schedulingConfig.timeSlots.length) {
      return { eventType: canonicalEventType, serviceAvailable: false, dates: [] };
    }
    // Batch query all active bookings for this parish in the 90-day horizon window
    const todayParsed = parseManilaDateOnly(todayDateStr);
    const maxParsed = parseManilaDateOnly(maxHorizonDateStr);

    const startUtc = new Date(Date.UTC(todayParsed.year, todayParsed.month - 1, todayParsed.day, 0, 0, 0));
    const endUtc = new Date(Date.UTC(maxParsed.year, maxParsed.month - 1, maxParsed.day, 23, 59, 59, 999));

    const activeBookings = await prisma.schedule.findMany({
      where: {
        parishId: parsedParishId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        requestedDate: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      select: {
        id: true,
        requestedDate: true,
        remarks: true,
        status: true,
      },
    });

    // Group active bookings by Manila date string
    const bookingsByDate = new Map();
    for (const booking of activeBookings) {
      const bDateStr = getManilaDateString(new Date(booking.requestedDate));
      if (!bookingsByDate.has(bDateStr)) {
        bookingsByDate.set(bDateStr, []);
      }
      bookingsByDate.get(bDateStr).push(booking);
    }

    const availableDates = [];

    // Evaluate each day in the 0..90 days horizon (91 total Manila calendar days)
    for (let dayOffset = 0; dayOffset <= MAX_HORIZON_DAYS; dayOffset++) {
      const currUtc = new Date(Date.UTC(todayParsed.year, todayParsed.month - 1, todayParsed.day + dayOffset, 0, 0, 0));
      const currDateStr = getManilaDateString(currUtc);
      const currParsed = parseManilaDateOnly(currDateStr);

      // 1. Office hours check for weekday
      try {
        validateParishAndOffice(parish, currParsed.dayName);
      } catch {
        continue; // Closed day
      }

      // 2. Parish-wide availability check
      try {
        validateParishAvailability(parish.availabilities, currDateStr);
      } catch {
        continue; // Blocked
      }

      // 3. Persisted date and weekday rules. Date-specific rules override
      // weekly settings, but never bypass operational blocks above.
      try {
        evaluateSchedulingRules({
          eventType: canonicalEventType,
          dateInput: currDateStr,
          weekdayRules: parish.weekdayRules,
          serviceWeekdayRules: parish.serviceWeekdayRules,
          dateRule: parish.scheduleDateRules.find(
            (rule) => getManilaDateString(new Date(rule.exceptionDate)) === currDateStr
          ),
        });
      } catch {
        continue;
      }

      // 4. Check if at least one allowable slot has remaining capacity
      const bookingsOnDate = bookingsByDate.get(currDateStr) || [];
      if (bookingsOnDate.length >= schedulingConfig.dailyCapacity) {
        continue; // Daily capacity full
      }

      let hasOpenSlot = false;
      for (const slot of schedulingConfig.timeSlots) {
        // If today, check if slot has already passed
        if (currDateStr === todayDateStr) {
          const slotDt = parseManilaDateTime(currDateStr, slot);
          if (slotDt && slotDt.getTime() <= now.getTime()) {
            continue;
          }
        }

        const slotCount = bookingsOnDate.filter((s) => {
          if (s.remarks) {
            const match = s.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
            if (match && match[1].trim().toUpperCase() === slot.trim().toUpperCase()) {
              return true;
            }
          }
          return false;
        }).length;

        if (slotCount < schedulingConfig.slotCapacity) {
          hasOpenSlot = true;
          break;
        }
      }

      if (hasOpenSlot) {
        availableDates.push(currDateStr);
      }
    }

    return {
      eventType: canonicalEventType,
      serviceAvailable: true,
      dates: availableDates,
    };
  }

  /**
   * Retrieves available time slots for a specific parish, date, and event type.
   */
  async getAvailableSlots(parishId, date, eventType) {
    const parsedParishId = parseInt(parishId, 10);
    if (isNaN(parsedParishId)) {
      const err = new Error("Invalid parishId.");
      err.statusCode = 400;
      err.code = "INVALID_PARISH_ID";
      throw err;
    }

    const now = new Date();
    const horizon = validateDateHorizon(date, null, now);
    const canonicalEventType = validateCanonicalEventType(eventType);

    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
      include: {
        availabilities: {
          where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } },
        },
        weekdayRules: true,
        serviceWeekdayRules: true,
        scheduleDateRules: {
          where: { exceptionDate: new Date(Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day)) },
          include: { serviceOverrides: true },
        },
      },
    });

    if (!parish || !parish.isActive) {
      return [];
    }

    let schedulingConfig;
    try {
      schedulingConfig = requireEnabledSchedulingService(parish, canonicalEventType);
    } catch {
      return [];
    }
    // 1. Office hours check
    try {
      validateParishAndOffice(parish, horizon.dayName);
    } catch {
      return [];
    }

    // 2. Parish-wide availability check. ParishAvailability records are
    // parish-wide, so this applies to every enabled service.
    try {
      validateParishAvailability(parish.availabilities, horizon.dateStr);
    } catch {
      return [];
    }

    try {
      evaluateSchedulingRules({
        eventType: canonicalEventType,
        dateInput: horizon.dateStr,
        weekdayRules: parish.weekdayRules,
        serviceWeekdayRules: parish.serviceWeekdayRules,
        dateRule: parish.scheduleDateRules[0] || null,
      });
    } catch {
      return [];
    }

    // 3. Fetch active bookings on that date
    const startUtc = new Date(Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0));
    const endUtc = new Date(Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 23, 59, 59, 999));

    const activeBookings = await prisma.schedule.findMany({
      where: {
        parishId: parsedParishId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        requestedDate: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      select: {
        id: true,
        remarks: true,
      },
    });

    if (activeBookings.length >= schedulingConfig.dailyCapacity) {
      return [];
    }

    const openSlots = [];
    for (const slot of schedulingConfig.timeSlots) {
      // Same-day past-time check
      if (horizon.dateStr === horizon.todayStr) {
        const slotDt = parseManilaDateTime(horizon.dateStr, slot);
        if (slotDt && slotDt.getTime() <= now.getTime()) {
          continue;
        }
      }

      const slotCount = activeBookings.filter((s) => {
        if (s.remarks) {
          const match = s.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (match && match[1].trim().toUpperCase() === slot.trim().toUpperCase()) {
            return true;
          }
        }
        return false;
      }).length;

      if (slotCount < schedulingConfig.slotCapacity) {
        openSlots.push(slot);
      }
    }

    return openSlots;
  }

  /**
   * Creates a schedule request with transaction-aware booking validation and Idempotency.
   */
  async create(payload, idempotencyKey = null) {
    const { userId, parishId, eventType, displayTitle, requestedDate, timeSlot, remarks } = payload;
    const parsedUserId = parseInt(userId, 10);
    const parsedParishId = parseInt(parishId, 10);

    if (isNaN(parsedUserId) || isNaN(parsedParishId)) {
      const err = new Error("Invalid userId or parishId.");
      err.statusCode = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }

    const canonicalEventType = validateCanonicalEventType(eventType);
    const now = new Date();
    const horizon = validateDateHorizon(requestedDate, timeSlot, now);

    const canonicalPayload = {
      parishId: parsedParishId,
      eventType: canonicalEventType,
      requestedDate: horizon.dateStr,
      timeSlot,
      remarks,
    };
    const payloadHash = computeSchedulePayloadHash(canonicalPayload);

    // 1. Check existing idempotency key if provided
    if (idempotencyKey) {
      const existingKey = await IdempotencyService.findRecord(
        parsedUserId,
        idempotencyKey,
        "SCHEDULE_CREATE"
      );

      if (existingKey) {
        if (existingKey.payloadHash === payloadHash) {
          const existingSchedule = await prisma.schedule.findUnique({
            where: { id: existingKey.resourceId },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
            },
          });
          if (existingSchedule) {
            return { schedule: existingSchedule, isReplay: true };
          }
        } else {
          const err = new Error(
            "An idempotency key was reused with a different request payload. Please generate a new key."
          );
          err.statusCode = 409;
          err.code = "IDEMPOTENCY_PAYLOAD_MISMATCH";
          throw err;
        }
      }
    }

    // 2. Perform booking within a Serializable transaction to guarantee race protection
    const fullRemarks = [
      `Time Slot: ${timeSlot}.`,
      remarks ? `Notes: ${remarks.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const scheduleDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );
    const startDatetime = parseManilaDateTime(horizon.dateStr, timeSlot);
    const endDatetime = startDatetime ? new Date(startDatetime.getTime() + 60 * 60 * 1000) : null;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Booking and Admin configuration writes serialize on the same
          // authoritative parish row before configuration is read.
          await lockParishSchedulingConfiguration(tx, parsedParishId);
          // Revalidate parish within transaction
          const parish = await tx.parish.findUnique({
            where: { id: parsedParishId },
            include: {
              availabilities: {
                where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } },
              },
            },
          });
          const schedulingConfig = requireEnabledSchedulingService(parish, canonicalEventType);

          validateParishAndOffice(parish, horizon.dayName, timeSlot);
          validateParishAvailability(parish.availabilities, horizon.dateStr);
          const schedulingRules = await loadSchedulingRules(tx, parsedParishId, horizon.dateStr);
          evaluateSchedulingRules({
            eventType: canonicalEventType,
            dateInput: horizon.dateStr,
            ...schedulingRules,
          });

          // Count active bookings on that date
          const dateStartUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
          );
          const dateEndUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 23, 59, 59, 999)
          );

          const activeBookings = await tx.schedule.findMany({
            where: {
              parishId: parsedParishId,
              status: { notIn: ["CANCELLED", "REJECTED"] },
              requestedDate: {
                gte: dateStartUtc,
                lte: dateEndUtc,
              },
            },
            select: {
              id: true,
              remarks: true,
            },
          });

          validateSlotAndCapacity(
            schedulingConfig.timeSlots,
            activeBookings,
            timeSlot,
            schedulingConfig.dailyCapacity,
            schedulingConfig.slotCapacity
          );

          // Create the schedule record
          const created = await tx.schedule.create({
            data: {
              userId: parsedUserId,
              parishId: parsedParishId,
              eventType: canonicalEventType,
              displayTitle: displayTitle || canonicalEventType,
              requestedDate: scheduleDateUtc,
              startDatetime,
              endDatetime,
              status: "PENDING",
              conflictFlag: false,
              remarks: fullRemarks,
            },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
            },
          });

          // Atomically persist idempotency key
          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                userId: parsedUserId,
                resourceType: "SCHEDULE_CREATE",
                resourceId: created.id,
                payloadHash,
              },
            });
          }

          await NotificationDispatcher.notifyScheduleChange({
            parishionerId: created.userId,
            parishId: created.parishId,
            scheduleId: created.id,
            displayTitle: created.displayTitle || canonicalEventType,
            oldStatus: null,
            newStatus: created.status,
            proposalVersion: created.proposalVersion,
            transitionVersion: "submitted",
            notifyAdmins: true,
          }, tx);

          return created;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return { schedule: result, isReplay: false };
    } catch (err) {
      const isSerializationConflict =
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize");

      // Catch idempotency race or transaction serialization conflict
      if (idempotencyKey && (IdempotencyService.isUniqueConstraintError(err) || isSerializationConflict)) {
        let raceWinner = null;
        const lookupAttempts = isSerializationConflict ? 5 : 1;
        for (let attempt = 0; attempt < lookupAttempts; attempt += 1) {
          raceWinner = await IdempotencyService.findRecord(
            parsedUserId,
            idempotencyKey,
            "SCHEDULE_CREATE"
          );
          if (raceWinner) break;
          if (attempt + 1 < lookupAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
          }
        }
        if (raceWinner) {
          if (raceWinner.payloadHash !== payloadHash) {
            const conflictErr = new Error(
              "An idempotency key was reused with a different request payload. Please generate a new key."
            );
            conflictErr.statusCode = 409;
            conflictErr.code = "IDEMPOTENCY_PAYLOAD_MISMATCH";
            throw conflictErr;
          }
          const winnerSchedule = await prisma.schedule.findUnique({
            where: { id: raceWinner.resourceId },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
            },
          });
          if (winnerSchedule) {
            return { schedule: winnerSchedule, isReplay: true };
          }
        }
      }

      if (isSerializationConflict) {
        const conflictErr = new Error("Slot booking contention detected. Please retry your request.");
        conflictErr.statusCode = 409;
        conflictErr.code = "SCHEDULE_CONCURRENCY_CONFLICT";
        throw conflictErr;
      }

      throw err;
    }
  }

  /**
   * Allows the owning parishioner to accept or decline a staff-proposed reschedule.
   * On Accept: revalidates replacement date & slot using the shared BookingValidator inside a Serializable transaction.
   * On Failure: returns 409 without modifying the original schedule.
   */
  async respondReschedule(scheduleId, accept, actorId, actorRole) {
    const parsedId = parseInt(scheduleId, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    // Blocker 2 Fix: Strictly enforce that only the owning parishioner can respond to proposals
    if (actorRole !== "PARISHIONER") {
      const err = new Error("Only parishioners can respond to reschedule proposals on their schedule requests.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
      include: {
        parish: {
          include: {
            availabilities: { where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } } },
          },
        },
      },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    if (schedule.userId !== actorId) {
      const err = new Error("You do not have permission to respond to this schedule request.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    if (!["PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"].includes(schedule.status)) {
      const err = new Error("This schedule is not awaiting a parishioner reschedule response.");
      err.statusCode = 400;
      err.code = "INVALID_STATE";
      throw err;
    }

    if (!accept) {
      // Parishioner declined: cancel the request
      const updated = await prisma.schedule.update({
        where: { id: parsedId },
        data: {
          status: "CANCELLED",
          processedById: actorId,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          parish: { select: { id: true, parishName: true } },
        },
      });
      return updated;
    }

    // Parishioner accepted: revalidate target replacement slot within a Serializable transaction
    if (!schedule.proposedDate || !schedule.proposedStartDatetime) {
      const err = new Error("No proposed reschedule date or time is set on this request.");
      err.statusCode = 400;
      err.code = "MISSING_PROPOSAL_DATA";
      throw err;
    }

    const proposedDateStr = getManilaDateString(new Date(schedule.proposedDate));
    const now = new Date();
    const horizon = validateDateHorizon(proposedDateStr, null, now);

    // Extract proposed time slot from proposedStartDatetime
    const proposedSlot = formatManilaTimeSlot(schedule.proposedStartDatetime);
    if (!proposedSlot) {
      const err = new Error("The proposed reschedule time is invalid.");
      err.statusCode = 400;
      err.code = "INVALID_PROPOSAL_TIME";
      throw err;
    }

    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          await lockParishSchedulingConfiguration(tx, schedule.parishId);
          // 1. Re-read schedule state within transaction
          const current = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              parish: {
                include: {
                  availabilities: { where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } } },
                },
              },
            },
          });

          if (!["PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"].includes(current.status)) {
            const err = new Error("Schedule status was modified by another operation.");
            err.statusCode = 409;
            err.code = "SCHEDULE_STATUS_CONFLICT";
            throw err;
          }
          const schedulingConfig = requireEnabledSchedulingService(current.parish, current.eventType);

          // 2. Revalidate office hours and parish-wide availability using the shared validator
          validateParishAndOffice(current.parish, horizon.dayName, proposedSlot);
          validateParishAvailability(current.parish.availabilities, horizon.dateStr);
          const schedulingRules = await loadSchedulingRules(tx, current.parishId, horizon.dateStr);
          evaluateSchedulingRules({
            eventType: current.eventType,
            dateInput: horizon.dateStr,
            ...schedulingRules,
          });

          // 3. Count active bookings on the proposed replacement date (excluding this schedule itself)
          const dateStartUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
          );
          const dateEndUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 23, 59, 59, 999)
          );

          const activeBookings = await tx.schedule.findMany({
            where: {
              parishId: current.parishId,
              id: { not: parsedId },
              status: { notIn: ["CANCELLED", "REJECTED"] },
              requestedDate: {
                gte: dateStartUtc,
                lte: dateEndUtc,
              },
            },
            select: {
              id: true,
              remarks: true,
            },
          });

          validateSlotAndCapacity(
            schedulingConfig.timeSlots,
            activeBookings,
            proposedSlot,
            schedulingConfig.dailyCapacity,
            schedulingConfig.slotCapacity
          );

          // 4. Validate assigned priest conflict if priest is assigned
          if (current.assignedPriestId) {
            const priestSchedules = await tx.schedule.findMany({
              where: {
                assignedPriestId: current.assignedPriestId,
                id: { not: parsedId },
                status: { in: ["CONFIRMED", "PENDING", "REQUESTED"] },
                requestedDate: {
                  gte: dateStartUtc,
                  lte: dateEndUtc,
                },
              },
              select: { id: true, requestedDate: true, remarks: true, status: true },
            });
            validatePriestConflict(priestSchedules, [], horizon.dateStr, proposedSlot, parsedId);
          }

          // 5. Update schedule to accepted status and apply new proposed date/times
          const proposedDateUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
          );
          const newStartDatetime = schedule.proposedStartDatetime;
          const newEndDatetime = schedule.proposedEndDatetime || new Date(new Date(schedule.proposedStartDatetime).getTime() + 60 * 60 * 1000);

          const newRemarks = [
            `Time Slot: ${proposedSlot}.`,
            current.remarks ? current.remarks.replace(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)\.?/i, "").trim() : "",
            `[Rescheduled from ${getManilaDateString(new Date(current.requestedDate))}]`,
          ]
            .filter(Boolean)
            .join(" ");

          // Invariant: CONFIRMED requires an assigned priest who has ACCEPTED.
          requirePriestAccepted(current);

          const result = await tx.schedule.update({
            where: { id: parsedId },
            data: {
              status: "CONFIRMED",
              requestedDate: proposedDateUtc,
              startDatetime: newStartDatetime,
              endDatetime: newEndDatetime,
              proposedDate: null,
              proposedStartDatetime: null,
              proposedEndDatetime: null,
              rescheduleReason: null,
              remarks: newRemarks,
              conflictFlag: false,
              processedById: actorId,
            },
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });

          await NotificationDispatcher.notifyScheduleChange({
            parishionerId: result.userId,
            parishId: result.parishId,
            scheduleId: result.id,
            displayTitle: result.displayTitle || result.eventType,
            oldStatus: current.status,
            newStatus: result.status,
            proposalVersion: result.proposalVersion,
            transitionVersion: result.updatedAt.toISOString(),
            schedule: result,
          }, tx);

          return result;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return updated;
    } catch (err) {
      if (err?.code === "P2034" || err?.message?.includes("Serialization") || err?.message?.includes("could not serialize")) {
        const conflictErr = new Error("The proposed reschedule slot is no longer available due to a concurrent booking.");
        conflictErr.statusCode = 409;
        conflictErr.code = "RESCHEDULE_CONCURRENCY_CONFLICT";
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Updates schedule status (admin/staff workflow).
   */
  async updateStatus(id, status, processedById, actorRole, actorParishId) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "update");

    return prisma.$transaction(
      async (tx) => {
        const current = await tx.schedule.findUnique({ where: { id: parsedId } });
        if (!current) {
          const err = new Error("Schedule request not found.");
          err.statusCode = 404;
          err.code = "SCHEDULE_NOT_FOUND";
          throw err;
        }
        authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "update");
        if (current.status === status) {
          return tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });
        }
        // Invariant: CONFIRMED requires an assigned priest who has ACCEPTED.
        if (status === "CONFIRMED") {
          requirePriestAccepted(current);
        }
        const updated = await tx.schedule.update({
          where: { id: parsedId },
          data: { status, processedById: parseInt(processedById, 10) },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });
        await NotificationDispatcher.notifyScheduleChange({
          parishionerId: updated.userId,
          parishId: updated.parishId,
          scheduleId: updated.id,
          displayTitle: updated.displayTitle || updated.eventType,
          oldStatus: current.status,
          newStatus: updated.status,
          proposalVersion: updated.proposalVersion,
          transitionVersion: updated.updatedAt.toISOString(),
          schedule: updated,
        }, tx);
        return updated;
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Staff proposes an alternative reschedule date/slot to the parishioner.
   */
  async proposeReschedule(id, { proposedDate, proposedStartDatetime, proposedEndDatetime, reason, actorId, actorRole, actorParishId }) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "propose reschedules for");

    if (!proposedDate) {
      const err = new Error("proposedDate is required.");
      err.statusCode = 400;
      err.code = "PROPOSED_DATE_REQUIRED";
      throw err;
    }

    const now = new Date();
    const horizon = validateDateHorizon(proposedDate, null, now);
    const proposedDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );

    return prisma.$transaction(
      async (tx) => {
        const current = await tx.schedule.findUnique({ where: { id: parsedId } });
        if (!current) {
          const err = new Error("Schedule request not found.");
          err.statusCode = 404;
          err.code = "SCHEDULE_NOT_FOUND";
          throw err;
        }
        authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "propose reschedules for");
        const updated = await tx.schedule.update({
          where: { id: parsedId },
          data: {
            status: "PROPOSED_RESCHEDULE",
            proposedDate: proposedDateUtc,
            proposedStartDatetime: proposedStartDatetime ? new Date(proposedStartDatetime) : null,
            proposedEndDatetime: proposedEndDatetime ? new Date(proposedEndDatetime) : null,
            rescheduleReason: reason || null,
            processedById: parseInt(actorId, 10),
            proposalVersion: { increment: 1 },
          },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });
        await NotificationDispatcher.notifyScheduleChange({
          parishionerId: updated.userId,
          parishId: updated.parishId,
          scheduleId: updated.id,
          displayTitle: updated.displayTitle || updated.eventType,
          oldStatus: current.status,
          newStatus: updated.status,
          proposalVersion: updated.proposalVersion,
          transitionVersion: updated.updatedAt.toISOString(),
          schedule: updated,
        }, tx);
        return updated;
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Assigns a priest to a schedule request.
   */
  async assignPriest(id, priestId, actorId, actorRole, actorParishId) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = parseInt(priestId, 10);

    if (isNaN(parsedId) || isNaN(parsedPriestId)) {
      const err = new Error("Invalid schedule ID or priest ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "assign priests for");

    // Capture prior priest before update to detect genuine new assignments.
    const previousPriestId = schedule.assignedPriestId;

    const updated = await prisma.schedule.update({
      where: { id: parsedId },
      data: {
        assignedPriestId: parsedPriestId,
        // Reset priest response to null on new assignment so the prior priest's
        // ACCEPTED status cannot be inherited by a newly assigned priest.
        priestResponseStatus: previousPriestId !== parsedPriestId ? null : schedule.priestResponseStatus,
        priestResponseReason: previousPriestId !== parsedPriestId ? null : schedule.priestResponseReason,
        processedById: parseInt(actorId, 10),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } },
      },
    });

    // Notify priest of new assignment (skip no-op same-priest reassignments).
    if (previousPriestId !== parsedPriestId) {
      await NotificationDispatcher.notifyPriestAssigned({
        parishionerId: updated.userId,
        parishId: updated.parishId,
        scheduleId: updated.id,
        displayTitle: updated.displayTitle || updated.eventType,
        priestId: parsedPriestId,
        priestName: updated.assignedPriest?.fullName || "Assigned Priest",
      });
    }

    return updated;
  }

  /**
   * Priest responds to an assignment (ACCEPTED / REJECTED).
   */
  async respondPriestAssignment(id, priestId, status, reason) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = parseInt(priestId, 10);

    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    if (schedule.assignedPriestId !== parsedPriestId) {
      const err = new Error("You are not the assigned priest for this schedule request.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const updated = await prisma.schedule.update({
      where: { id: parsedId },
      data: {
        priestResponseStatus: status,
        priestResponseReason: reason || null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } },
      },
    });

    return updated;
  }
}
