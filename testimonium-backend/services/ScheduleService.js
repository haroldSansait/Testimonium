import { createHash } from 'node:crypto';
import { getScheduleRequirements, validateScheduleRequirements } from './ScheduleRequirements.js';
import { ScheduleAttachmentService } from './ScheduleAttachmentService.js';
import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper, parseManilaDateTime, parseManilaDateOnly, getManilaDateString, formatManilaTimeSlot, computeOperationalEndDatetime } from "./ConflictHelper.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { IdempotencyService, computeSchedulePayloadHash } from "./IdempotencyService.js";
import {
  MAX_HORIZON_DAYS,
  validateDateHorizon,
  validateCanonicalEventType,
  validateParishAndOffice,
  validateParishAvailability,
  PARISH_BOOKING_BLOCK_TYPES,
  validateSlotAndCapacity,
  getManilaHorizonMaxDate,
  extractScheduleTimeSlot,
  normalizeTimeSlotString,
} from "./BookingValidator.js";
import { EventTypeCatalog, resolveEventMetadata, resolveEventType, resolveDisplayTitle } from "../shared/EventTypeCatalog.js";
import { isProfileIncomplete } from "../utils/profileCompleteness.js";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";
import {
  SCHEDULE_REJECTION_REASONS,
  DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS,
  getScheduleRejectionReasonLabel,
} from "../shared/ScheduleRejectionReasons.js";
import { getParishSchedulingConfiguration, requireEnabledSchedulingService } from "./SchedulingConfiguration.js";
import {
  evaluateSchedulingRules,
  loadSchedulingRules,
  lockParishSchedulingConfiguration,
  lockPriestForScheduling,
  lockPriestsForScheduling,
  normalizePriestId,
} from "./SchedulingAvailability.js";
import {
  evaluateCandidateSlot,
  loadParishAvailabilitySnapshot,
  validateRequestedPriestEligibility,
  GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE,
  classifyPriestAvailability,
  PriestAvailabilityClassification,
} from "./ScheduleAvailabilityDomainService.js";
import {
  ScheduleStatus,
  TERMINAL_SCHEDULE_STATUSES,
  canTransitionSchedule,
  validateScheduleTransition,
  requirePriestAccepted,
  mapIncomingScheduleStatus,
  assertScheduleMutable,
} from "./ScheduleStateMachine.js";
import {
  decorateScheduleForDisplay,
  isLayMinisterEligibleEvent,
  resolveScheduleDisplayTitle,
} from "../shared/LayMinisterPresentation.js";
import { isAlternativeProposalStale } from "../shared/ScheduleAlternativeProposalPolicy.js";

const VALID_SCHEDULE_STATUSES = new Set([
  "PENDING",
  "REQUESTED",
  "PROPOSED_RESCHEDULE",
  "WAITING_PARISHIONER_RESPONSE",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]);
const OTHER_CATEGORY_ENUMS = EventTypeCatalog.filter((e) => e.category === "Other").map((e) => e.enum);

const TERMINAL_STATUSES = TERMINAL_SCHEDULE_STATUSES;
const OPEN_ALTERNATIVE_PROPOSAL_STATUSES = ["SUBMITTED", "PRIEST_PENDING"];
const ALTERNATIVE_PROPOSAL_INCLUDE = {
  alternativeProposals: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      nominatedPriest: { select: { id: true, fullName: true } },
    },
  },
};

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

function authorizeLayMinisterMutation(actorRole, actorParishId, scheduleParishId) {
  if (!["SECRETARY", "DIOCESE_COORDINATOR"].includes(actorRole)) {
    const error = new Error("Only a secretary or diocese coordinator may assign a Lay Minister.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
  if (
    actorRole !== "DIOCESE_COORDINATOR"
    && (!actorParishId || Number(actorParishId) !== Number(scheduleParishId))
  ) {
    const error = new Error("You do not have permission to assign a Lay Minister in another parish.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

function requireExpectedVersion(value, action) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    const error = new Error(`expectedVersion is required to ${action}.`);
    error.statusCode = 400;
    error.code = "EXPECTED_VERSION_REQUIRED";
    throw error;
  }
  return version;
}

export function throwScheduleConcurrencyConflict() {
  const error = new Error("Schedule was modified by another operation. Please refresh and retry.");
  error.statusCode = 409;
  error.code = "SCHEDULE_CONCURRENCY_CONFLICT";
  throw error;
}

export async function updateScheduleAtVersion(tx, id, expectedVersion, data) {
  const result = await tx.schedule.updateMany({
    where: { id, version: expectedVersion },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) {
    throwScheduleConcurrencyConflict();
  }
}

export async function appendScheduleHistory(tx, schedule, { reason, actorId, actorRole }) {
  await tx.scheduleHistory.create({
    data: {
      scheduleId: schedule.id,
      version: schedule.version,
      requestedDate: schedule.requestedDate,
      startDatetime: schedule.startDatetime,
      endDatetime: schedule.endDatetime,
      remarks: schedule.remarks,
      status: schedule.status,
      assignedPriestId: schedule.assignedPriestId,
      priestResponseStatus: schedule.priestResponseStatus,
      priestVerbalApproval: Boolean(schedule.priestVerbalApproval),
      layMinisterAssigned: Boolean(schedule.layMinisterAssigned),
      reason,
      actorId: Number.isInteger(Number(actorId)) ? Number(actorId) : null,
      actorRole: String(actorRole || "SYSTEM"),
    },
  });
}

async function supersedeOpenAlternativeProposals(tx, scheduleId, actorId = null) {
  const proposals = await tx.scheduleAlternativeProposal.findMany({
    where: {
      scheduleId,
      status: { in: OPEN_ALTERNATIVE_PROPOSAL_STATUSES },
    },
    select: { id: true, status: true, nominationRevision: true },
  });
  if (!proposals.length) return;
  await tx.scheduleAlternativeProposal.updateMany({
    where: {
      scheduleId,
      status: { in: OPEN_ALTERNATIVE_PROPOSAL_STATUSES },
    },
    data: {
      status: "SUPERSEDED",
      resolvedById: Number.isSafeInteger(Number(actorId)) ? Number(actorId) : null,
      resolvedAt: new Date(),
      nominationRevision: { increment: 1 },
    },
  });
  const schedule = await tx.schedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      userId: true,
      parishId: true,
      eventType: true,
      displayTitle: true,
      layMinisterAssigned: true,
    },
  });
  for (const proposal of proposals) {
    await AuditLogService.log(
      actorId,
      "Alternative Date Proposal Superseded",
      tx,
      !actorId,
      {
        affectedTable: "schedule_alternative_proposals",
        affectedRecordId: proposal.id,
        parishId: schedule?.parishId,
        previousValues: { status: proposal.status, nominationRevision: proposal.nominationRevision },
        newValues: { status: "SUPERSEDED", nominationRevision: proposal.nominationRevision + 1 },
      }
    );
  }
  if (schedule) {
    await NotificationDispatcher.notifyAlternativeProposal({
      event: "SUPERSEDED",
      parishionerId: schedule.userId,
      parishId: schedule.parishId,
      scheduleId: schedule.id,
      displayTitle: resolveScheduleDisplayTitle(schedule),
    }, tx);
  }
}

/**
 * Reconstructs chronological schedule transitions from raw ScheduleHistory and current Schedule.
 * Evaluates date/start-time differences to filter reschedules and returns user-safe DTOs newest first.
 * Strips actorId, actorRole, version, remarks, and raw Prisma objects.
 */
export function deriveRescheduleHistory(schedule, rawHistory = []) {
  if (!rawHistory || rawHistory.length === 0) return [];

  // Sort ascending chronologically to reconstruct transitions
  const sorted = [...rawHistory].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || 0) - (b.id || 0);
  });

  const reschedules = [];

  for (let i = 0; i < sorted.length; i++) {
    const currentHist = sorted[i];
    const nextState = i + 1 < sorted.length ? sorted[i + 1] : schedule;

    const prevDateStr = currentHist.requestedDate
      ? new Date(currentHist.requestedDate).toISOString().split("T")[0]
      : null;
    const nextDateStr = nextState.requestedDate
      ? new Date(nextState.requestedDate).toISOString().split("T")[0]
      : null;

    const prevStartIso = currentHist.startDatetime
      ? new Date(currentHist.startDatetime).toISOString()
      : null;
    const nextStartIso = nextState.startDatetime
      ? new Date(nextState.startDatetime).toISOString()
      : null;

    // Check if date or start time changed
    const dateChanged = prevDateStr !== nextDateStr;
    const startChanged = prevStartIso !== nextStartIso;

    if (dateChanged || startChanged) {
      reschedules.push({
        previousDate: prevDateStr,
        previousStart: prevStartIso,
        newDate: nextDateStr,
        newStart: nextStartIso,
        reason: currentHist.reason || "Schedule updated by parish",
        changedAt: currentHist.createdAt
          ? new Date(currentHist.createdAt).toISOString()
          : new Date().toISOString(),
      });
    }
  }

  // Return newest first (reverse-chronological)
  return reschedules.reverse();
}

async function runVersionedScheduleTransaction(work, options) {
  try {
    return await prisma.$transaction(work, options);
  } catch (error) {
    if (
      error?.code === "P2034" ||
      error?.message?.includes("Serialization") ||
      error?.message?.includes("could not serialize")
    ) {
      throwScheduleConcurrencyConflict();
    }
    throw error;
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

export function sanitizeSchedulePriest(sched) {
  if (!sched) return sched;
  const result = { ...sched };
  if (Array.isArray(result.alternativeProposals)) {
    result.alternativeProposal = result.alternativeProposals[0] || null;
    delete result.alternativeProposals;
  }
  if (result.priestChangeRequestedPriest) {
    const requestedName =
      result.priestChangeRequestedPriest.fullName ?? result.priestChangeRequestedPriest.name ?? null;
    result.priestChangeRequestedPriest = {
      id: result.priestChangeRequestedPriest.id,
      name: requestedName,
      fullName: requestedName,
    };
  }
  if (result.priestVerbalApprovalBy) {
    result.priestVerbalApprovalBy = {
      id: result.priestVerbalApprovalBy.id,
      fullName:
        result.priestVerbalApprovalBy.fullName ?? result.priestVerbalApprovalBy.name ?? null,
    };
  }
  if (!result.requestedPriest) {
    return decorateScheduleForDisplay({
      ...result,
      requestedPriest: null,
    });
  }
  result.requestedPriest = {
    id: result.requestedPriest.id,
    name: result.requestedPriest.fullName ?? result.requestedPriest.name ?? null,
  };
  return decorateScheduleForDisplay(result);
}

function buildParishSecretaryDto(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName || null,
    contactNumber: user.contactNumber || null,
  };
}

function isValidParishSecretaryForParish(user, parishId) {
  if (!user || !parishId) return false;
  const roleName = user.role?.roleName;
  return (
    user.status === "ACTIVE"
    && roleName === "SECRETARY"
    && Number(user.parishId) === Number(parishId)
  );
}

export async function attachParishSecretaries(schedules, client = prisma) {
  if (!Array.isArray(schedules) || schedules.length === 0) return schedules;

  const resolvedByParish = new Map();
  const missingParishIds = new Set();

  for (const sched of schedules) {
    if (!sched) continue;
    if (isValidParishSecretaryForParish(sched.processedBy, sched.parishId)) {
      resolvedByParish.set(sched.id, buildParishSecretaryDto(sched.processedBy));
    } else if (sched.parishId) {
      missingParishIds.add(Number(sched.parishId));
    }
  }

  const fallbackByParish = new Map();
  if (missingParishIds.size > 0 && typeof client?.user?.findMany === "function") {
    const secretaries = await client.user.findMany({
      where: {
        parishId: { in: Array.from(missingParishIds) },
        status: "ACTIVE",
        role: { roleName: "SECRETARY" },
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        parishId: true,
        fullName: true,
        contactNumber: true,
      },
    });

    if (Array.isArray(secretaries)) {
      for (const sec of secretaries) {
        const key = Number(sec.parishId);
        if (!fallbackByParish.has(key)) {
          fallbackByParish.set(key, buildParishSecretaryDto(sec));
        }
      }
    }
  }

  return schedules.map((sched) => {
    if (!sched) return sched;
    const direct = resolvedByParish.get(sched.id);
    const fallback = sched.parishId ? fallbackByParish.get(Number(sched.parishId)) || null : null;
    const sanitizedProcessedBy = sched.processedBy
      ? {
          id: sched.processedBy.id,
          fullName: sched.processedBy.fullName,
          ...(sched.processedBy.email !== undefined ? { email: sched.processedBy.email } : {}),
        }
      : sched.processedBy;
    return {
      ...sched,
      processedBy: sanitizedProcessedBy,
      parishSecretary: direct || fallback || null,
    };
  });
}

async function expireStaleAlternativeProposal(schedule) {
  const proposal = schedule?.alternativeProposals?.[0];
  if (
    !proposal
    || !OPEN_ALTERNATIVE_PROPOSAL_STATUSES.includes(proposal.status)
    || !isAlternativeProposalStale(schedule, proposal)
  ) {
    return;
  }
  const result = await prisma.scheduleAlternativeProposal.updateMany({
    where: {
      id: proposal.id,
      status: { in: OPEN_ALTERNATIVE_PROPOSAL_STATUSES },
      nominationRevision: proposal.nominationRevision,
    },
    data: {
      status: "SUPERSEDED",
      resolvedAt: new Date(),
      nominatedPriestId: null,
      priestResponseStatus: null,
      nominationRevision: { increment: 1 },
    },
  });
  if (result.count !== 1) return;
  proposal.status = "SUPERSEDED";
  proposal.nominatedPriestId = null;
  proposal.priestResponseStatus = null;
  proposal.nominationRevision += 1;
  await AuditLogService.log(null, "Alternative Date Proposal Superseded", null, true, {
    affectedTable: "schedule_alternative_proposals",
    affectedRecordId: proposal.id,
    parishId: schedule.parishId,
    newValues: { status: "SUPERSEDED", nominationRevision: proposal.nominationRevision },
  });
  await NotificationDispatcher.notifyAlternativeProposal({
    event: "SUPERSEDED",
    parishionerId: schedule.userId,
    parishId: schedule.parishId,
    scheduleId: schedule.id,
    displayTitle: resolveScheduleDisplayTitle(schedule),
  });
}

export class ScheduleService {
  constructor(scheduleRepository = new ScheduleRepository()) {
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Returns a paginated list of schedule requests with optional filters and scope.
   */
  async list({ page = 1, limit = 10, search, status, eventType, parishId, userId, priestId, scope } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;
    const trimmedSearch = typeof search === "string" ? search.trim() : "";

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
        ...(trimmedSearch
          ? {
              OR: [
                { user: { fullName: { contains: trimmedSearch, mode: "insensitive" } } },
                { remarks: { contains: trimmedSearch, mode: "insensitive" } },
                { displayTitle: { contains: trimmedSearch, mode: "insensitive" } },
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
          requestedPriest: { select: { id: true, fullName: true } },
          ...ALTERNATIVE_PROPOSAL_INCLUDE,
        },
      });
      await Promise.all(allUserSchedules.map(expireStaleAlternativeProposal));

      const filtered = allUserSchedules.map(sanitizeSchedulePriest).filter((sched) => {
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
    const compoundFilters = [];
    if (priestId) {
      const parsedPriestId = parseInt(priestId, 10);
      compoundFilters.push({
        OR: [
          { assignedPriestId: parsedPriestId },
          {
            alternativeProposals: {
              some: {
                nominatedPriestId: parsedPriestId,
                status: "PRIEST_PENDING",
              },
            },
          },
        ],
      });
    }

    let statusWhere = {};
    const trimmedStatus = typeof status === "string" ? status.trim() : "";
    if (trimmedStatus && trimmedStatus.toLowerCase() !== "all") {
      const requestedStatuses = trimmedStatus
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const validStatuses = requestedStatuses.filter((s) => VALID_SCHEDULE_STATUSES.has(s));
      if (validStatuses.length === 0) {
        return { data: [], total: 0 };
      }
      statusWhere = validStatuses.length === 1 ? { status: validStatuses[0] } : { status: { in: validStatuses } };
    }

    const trimmedEventType = typeof eventType === "string" ? eventType.trim() : "";
    if (trimmedEventType && trimmedEventType.toLowerCase() !== "all") {
      if (trimmedEventType.toUpperCase() === "OTHER") {
        compoundFilters.push({
          eventType: { in: OTHER_CATEGORY_ENUMS },
        });
      } else {
        const resolved = resolveEventType(trimmedEventType);
        if (resolved) {
          compoundFilters.push({ eventType: resolved });
        } else {
          compoundFilters.push({
            OR: [
              { displayTitle: { contains: trimmedEventType, mode: "insensitive" } },
              { remarks: { contains: trimmedEventType, mode: "insensitive" } },
            ],
          });
        }
      }
    }

    if (trimmedSearch) {
      const searchOr = [
        { user: { fullName: { contains: trimmedSearch, mode: "insensitive" } } },
        { remarks: { contains: trimmedSearch, mode: "insensitive" } },
        { displayTitle: { contains: trimmedSearch, mode: "insensitive" } },
      ];

      const shouldMatchReferenceNo =
        /\d/.test(trimmedSearch) ||
        trimmedSearch.includes("-") ||
        trimmedSearch.toLowerCase().startsWith("req");

      if (shouldMatchReferenceNo) {
        const pattern = `%${trimmedSearch}%`;
        const matchingRefRows = await prisma.$queryRaw`
          SELECT "schedule_id" AS id
          FROM "schedules"
          WHERE (
            'REQ-' ||
            EXTRACT(YEAR FROM ("created_at" AT TIME ZONE 'Asia/Manila'))::int::text ||
            '-' ||
            CASE
              WHEN LENGTH("schedule_id"::text) < 4 THEN LPAD("schedule_id"::text, 4, '0')
              ELSE "schedule_id"::text
            END
          ) ILIKE ${pattern}
        `;
        const matchingRefIds = Array.isArray(matchingRefRows)
          ? matchingRefRows.map((row) => Number(row.id)).filter(Number.isInteger)
          : [];
        if (matchingRefIds.length > 0) {
          searchOr.push({ id: { in: matchingRefIds } });
        }
      }

      compoundFilters.push({ OR: searchOr });
    }

    const where = {
      ...(parishId ? { parishId: parseInt(parishId, 10) } : {}),
      ...(userId ? { userId: parseInt(userId, 10) } : {}),
      ...statusWhere,
      ...(compoundFilters.length ? { AND: compoundFilters } : {}),
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
          processedBy: {
            select: {
              id: true,
              fullName: true,
              contactNumber: true,
              status: true,
              parishId: true,
              role: { select: { roleName: true } },
            },
          },
          assignedPriest: { select: { id: true, fullName: true } },
          requestedPriest: { select: { id: true, fullName: true } },
          priestChangeRequestedPriest: { select: { id: true, fullName: true } },
          priestVerbalApprovalBy: { select: { id: true, fullName: true } },
          ...ALTERNATIVE_PROPOSAL_INCLUDE,
        },
      }),
      prisma.schedule.count({ where }),
    ]);
    await Promise.all(data.map(expireStaleAlternativeProposal));
    const enrichedData = await attachParishSecretaries(data);

    return { data: enrichedData.map(sanitizeSchedulePriest), total };
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
        processedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            contactNumber: true,
            status: true,
            parishId: true,
            role: { select: { roleName: true } },
          },
        },
        assignedPriest: { select: { id: true, fullName: true, email: true } },
        requestedPriest: { select: { id: true, fullName: true } },
        priestChangeRequestedPriest: { select: { id: true, fullName: true } },
        priestVerbalApprovalBy: { select: { id: true, fullName: true } },
        ...ALTERNATIVE_PROPOSAL_INCLUDE,
        history: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            requestedDate: true,
            startDatetime: true,
            endDatetime: true,
            reason: true,
            createdAt: true,
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
    await expireStaleAlternativeProposal(schedule);

    const rawHistory = schedule.history || [];
    delete schedule.history;
    schedule.rescheduleHistory = deriveRescheduleHistory(schedule, rawHistory);

    const [enriched] = await attachParishSecretaries([schedule]);
    return sanitizeSchedulePriest(enriched);
  }

  /**
   * Retrieves a single schedule request by tracking reference.
   * Enforces privacy: nonexistent or unowned references both return 404 NOT_FOUND.
   */
  async getByTrackingReference(reference, actorId, actorRole, actorParishId) {
    if (!reference || typeof reference !== "string") {
      const err = new Error("Schedule request reference not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    const trimmed = reference.trim();
    let scheduleId = null;

    // Supported actual formats:
    // 1. CONF-YYYY-XXXX (e.g. CONF-2026-0026, CONF-2026-26)
    const confMatch = trimmed.match(/^CONF-\d{4}-(\d+)$/i);
    if (confMatch) {
      scheduleId = parseInt(confMatch[1], 10);
    } else if (/^\d+$/.test(trimmed)) {
      // 2. Plain numeric schedule ID (as presented in URL /dashboard/schedule/:id and notifications)
      scheduleId = parseInt(trimmed, 10);
    }

    if (!scheduleId || isNaN(scheduleId)) {
      const err = new Error("Schedule request reference not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        parish: {
          select: {
            id: true,
            parishName: true,
            type: true,
            municipalityCity: true,
            province: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            fullName: true,
            contactNumber: true,
            status: true,
            parishId: true,
            role: { select: { roleName: true } },
          },
        },
        assignedPriest: { select: { id: true, fullName: true, email: true } },
        requestedPriest: { select: { id: true, fullName: true } },
        priestChangeRequestedPriest: { select: { id: true, fullName: true } },
        priestVerbalApprovalBy: { select: { id: true, fullName: true } },
        ...ALTERNATIVE_PROPOSAL_INCLUDE,
        history: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            requestedDate: true,
            startDatetime: true,
            endDatetime: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    // PRIVACY / IDOR: unowned and nonexistent references return IDENTICAL 404 NOT_FOUND
    if (!schedule) {
      const err = new Error("Schedule request reference not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    if (actorRole === "PARISHIONER") {
      if (schedule.userId !== actorId) {
        const err = new Error("Schedule request reference not found.");
        err.statusCode = 404;
        err.code = "SCHEDULE_NOT_FOUND";
        throw err;
      }
    } else if (["SECRETARY", "PRIEST", "STAFF"].includes(actorRole)) {
      if (actorParishId && schedule.parishId !== actorParishId) {
        const err = new Error("Schedule request reference not found.");
        err.statusCode = 404;
        err.code = "SCHEDULE_NOT_FOUND";
        throw err;
      }
    }
    await expireStaleAlternativeProposal(schedule);

    const rawHistory = schedule.history || [];
    delete schedule.history;
    schedule.rescheduleHistory = deriveRescheduleHistory(schedule, rawHistory);

    const [enriched] = await attachParishSecretaries([schedule]);
    return sanitizeSchedulePriest(enriched);
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
      // Existing requests still need their requirements when a service is disabled.
      requirementsByEventType: Object.fromEntries(EventTypeCatalog.map(({ enum: eventType }) => [
        eventType, getScheduleRequirements(parish, eventType),
      ])),
      services: schedulingAvailable
        ? config.enabledServices.map((eventType) => ({
            eventType,
            label: resolveEventMetadata(eventType)?.title || eventType,
            requirements: getScheduleRequirements(parish, eventType),
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

        const normSlot = normalizeTimeSlotString(slot);
        const slotCount = bookingsOnDate.filter((s) => {
          const sSlot = extractScheduleTimeSlot(s);
          return sSlot && sSlot === normSlot;
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
   * Retrieves a classified availability result for a specific parish, date,
   * and event type. This is the canonical implementation behind the public
   * string[] contract and Caloy's safe reason-specific responses.
   */
  async getAvailableSlotsDetailed(parishId, date, eventType) {
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
    const emptyResult = (reasonCode, overrides = {}) => ({
      parishId: parsedParishId,
      eventType: canonicalEventType,
      date: horizon.dateStr,
      serviceAvailable: !["EVENT_NOT_OFFERED", "SCHEDULING_CONFIGURATION_INCOMPLETE", "PARISH_INACTIVE", "PARISH_NOT_FOUND"].includes(reasonCode),
      reasonCode,
      candidateSlots: [],
      slots: [],
      exclusionCounts: {
        past: 0,
        outsideOfficeHours: 0,
        atCapacity: 0,
      },
      ...overrides,
    });

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
      return emptyResult("PARISH_INACTIVE");
    }

    let schedulingConfig;
    try {
      schedulingConfig = requireEnabledSchedulingService(parish, canonicalEventType);
    } catch (err) {
      return emptyResult(
        err?.code === "SERVICE_NOT_OFFERED" ? "EVENT_NOT_OFFERED" : "SCHEDULING_CONFIGURATION_INCOMPLETE"
      );
    }
    if (!schedulingConfig.timeSlots.length) {
      return emptyResult("NO_SCHEDULING_WINDOW", { serviceAvailable: true });
    }
    // 1. Office hours check
    try {
      validateParishAndOffice(parish, horizon.dayName);
    } catch (err) {
      return emptyResult(err?.code === "OFFICE_CLOSED" ? "PARISH_CLOSED" : "NO_SCHEDULING_WINDOW", {
        serviceAvailable: true,
        candidateSlots: [...schedulingConfig.timeSlots],
      });
    }

    // 2. Parish-wide availability check. ParishAvailability records are
    // parish-wide, so this applies to every enabled service.
    try {
      validateParishAvailability(parish.availabilities, horizon.dateStr);
    } catch (err) {
      return emptyResult(err?.code || "PARISH_CLOSED", {
        serviceAvailable: true,
        candidateSlots: [...schedulingConfig.timeSlots],
      });
    }

    try {
      evaluateSchedulingRules({
        eventType: canonicalEventType,
        dateInput: horizon.dateStr,
        weekdayRules: parish.weekdayRules,
        serviceWeekdayRules: parish.serviceWeekdayRules,
        dateRule: parish.scheduleDateRules[0] || null,
      });
    } catch (err) {
      return emptyResult(
        ["SERVICE_UNAVAILABLE_ON_DAY", "DATE_UNAVAILABLE"].includes(err?.code)
          ? "DATE_NOT_ALLOWED"
          : err?.code || "DATE_NOT_ALLOWED",
        {
          serviceAvailable: true,
          candidateSlots: [...schedulingConfig.timeSlots],
        }
      );
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
      return emptyResult("FULLY_BOOKED", {
        serviceAvailable: true,
        candidateSlots: [...schedulingConfig.timeSlots],
        exclusionCounts: {
          past: 0,
          outsideOfficeHours: 0,
          atCapacity: schedulingConfig.timeSlots.length,
        },
      });
    }

    const openSlots = [];
    const exclusionCounts = {
      past: 0,
      outsideOfficeHours: 0,
      atCapacity: 0,
    };
    for (const slot of schedulingConfig.timeSlots) {
      // Same-day past-time check
      if (horizon.dateStr === horizon.todayStr) {
        const slotDt = parseManilaDateTime(horizon.dateStr, slot);
        if (slotDt && slotDt.getTime() <= now.getTime()) {
          exclusionCounts.past += 1;
          continue;
        }
      }

      // A configured slot start must also fall inside the authoritative
      // office window. No event duration is inferred here.
      try {
        validateParishAndOffice(parish, horizon.dayName, slot);
      } catch (err) {
        if (["OFFICE_CLOSED", "OUTSIDE_OFFICE_HOURS"].includes(err?.code)) {
          exclusionCounts.outsideOfficeHours += 1;
          continue;
        }
        throw err;
      }

      const normSlot = normalizeTimeSlotString(slot);
      const slotCount = activeBookings.filter((s) => {
        const sSlot = extractScheduleTimeSlot(s);
        return sSlot && sSlot === normSlot;
      }).length;

      if (slotCount < schedulingConfig.slotCapacity) {
        openSlots.push(slot);
      } else {
        exclusionCounts.atCapacity += 1;
      }
    }

    let reasonCode = null;
    if (!openSlots.length) {
      const excludedCount = exclusionCounts.atCapacity + exclusionCounts.past + exclusionCounts.outsideOfficeHours;
      if (exclusionCounts.atCapacity > 0 && excludedCount === schedulingConfig.timeSlots.length) {
        reasonCode = "FULLY_BOOKED";
      } else if (exclusionCounts.outsideOfficeHours > 0 || exclusionCounts.past > 0) {
        reasonCode = "NO_ELIGIBLE_SLOTS";
      } else {
        reasonCode = "NO_AVAILABLE_SLOTS";
      }
    }

    return {
      parishId: parsedParishId,
      eventType: canonicalEventType,
      date: horizon.dateStr,
      serviceAvailable: true,
      reasonCode,
      candidateSlots: [...schedulingConfig.timeSlots],
      slots: openSlots,
      exclusionCounts,
    };
  }

  /**
   * Public and long-standing contract: arguments are
   * (parishId, date, eventType), return value is string[].
   */
  async getAvailableSlots(parishId, date, eventType) {
    const result = await this.getAvailableSlotsDetailed(parishId, date, eventType);
    return result.slots;
  }

  /**
   * Bounded upcoming-date search backed by the same batched domain snapshot
   * and candidate evaluator used for canonical schedule recommendations.
   */
  async getAvailableDatesInRange(parishId, eventType, startDate = null, rangeDays = 14) {
    const parsedParishId = parseInt(parishId, 10);
    if (isNaN(parsedParishId)) {
      const err = new Error("Invalid parishId.");
      err.statusCode = 400;
      err.code = "INVALID_PARISH_ID";
      throw err;
    }

    const canonicalEventType = validateCanonicalEventType(eventType);
    const boundedRangeDays = Number(rangeDays);
    if (!Number.isInteger(boundedRangeDays) || boundedRangeDays < 1 || boundedRangeDays > 31) {
      const err = new Error("rangeDays must be a whole number from 1 to 31.");
      err.statusCode = 400;
      err.code = "INVALID_AVAILABILITY_RANGE";
      throw err;
    }

    const now = new Date();
    const effectiveStart = startDate || getManilaDateString(now);
    const startHorizon = validateDateHorizon(effectiveStart, null, now);
    const startUtc = Date.UTC(startHorizon.parsed.year, startHorizon.parsed.month - 1, startHorizon.parsed.day);
    const requestedEnd = getManilaDateString(new Date(startUtc + (boundedRangeDays - 1) * 24 * 60 * 60 * 1000));
    const maxDate = getManilaHorizonMaxDate(now, MAX_HORIZON_DAYS);
    const effectiveEnd = requestedEnd > maxDate ? maxDate : requestedEnd;

    let snapshot;
    try {
      snapshot = await loadParishAvailabilitySnapshot(
        parsedParishId,
        startHorizon.dateStr,
        effectiveEnd,
        canonicalEventType,
        prisma
      );
    } catch (err) {
      if (["SERVICE_NOT_OFFERED", "SCHEDULING_CONFIGURATION_INCOMPLETE", "PARISH_INACTIVE", "PARISH_NOT_FOUND"].includes(err?.code)) {
        return {
          parishId: parsedParishId,
          eventType: canonicalEventType,
          serviceAvailable: false,
          reasonCode: err.code === "SERVICE_NOT_OFFERED" ? "EVENT_NOT_OFFERED" : err.code,
          startDate: startHorizon.dateStr,
          endDate: effectiveEnd,
          rangeDays: Math.floor((Date.parse(`${effectiveEnd}T00:00:00Z`) - startUtc) / (24 * 60 * 60 * 1000)) + 1,
          dates: [],
        };
      }
      throw err;
    }

    const availableDates = [];
    const endParsed = parseManilaDateOnly(effectiveEnd);
    const endUtc = Date.UTC(endParsed.year, endParsed.month - 1, endParsed.day);
    for (let cursor = startUtc; cursor <= endUtc; cursor += 24 * 60 * 60 * 1000) {
      const dateStr = getManilaDateString(new Date(cursor));
      const slots = snapshot.schedulingConfig.timeSlots.filter((slot) =>
        evaluateCandidateSlot(snapshot, dateStr, slot, canonicalEventType, now)
      );
      if (slots.length > 0) {
        availableDates.push({ date: dateStr, slots });
      }
    }

    return {
      parishId: parsedParishId,
      eventType: canonicalEventType,
      serviceAvailable: true,
      reasonCode: availableDates.length ? null : "NO_AVAILABLE_DATES",
      startDate: startHorizon.dateStr,
      endDate: effectiveEnd,
      rangeDays: Math.floor((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1,
      dates: availableDates,
    };
  }

  /**
   * Creates a schedule request with transaction-aware booking validation and Idempotency.
   */
  async create(payload, idempotencyKey = null, webAttachments = null) {
    const resourceType = webAttachments === null ? "SCHEDULE_CREATE" : "SCHEDULE_WEB_CREATE";
    const { userId, parishId, eventType, displayTitle, requestedDate, timeSlot, location, remarks, requestedPriestId } = payload;
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

    let parsedRequestedPriestId = null;
    if (requestedPriestId !== undefined && requestedPriestId !== null && requestedPriestId !== "") {
      try {
        parsedRequestedPriestId = normalizePriestId(requestedPriestId);
      } catch {
        const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
        err.statusCode = 400;
        err.code = "INVALID_REQUESTED_PRIEST";
        throw err;
      }
    }

    const canonicalPayload = {
      parishId: parsedParishId,
      eventType: canonicalEventType,
      requestedDate: horizon.dateStr,
      timeSlot,
      ...(typeof location === "string" && location.trim() ? { location: location.trim() } : {}),
      remarks,
      requestedPriestId: parsedRequestedPriestId,
    };
    const bookingHash = computeSchedulePayloadHash(canonicalPayload);
    const payloadHash = webAttachments === null ? bookingHash : createHash('sha256')
      .update(JSON.stringify([bookingHash, webAttachments.map(({ requirementId, contentHash }) => ({ requirementId, contentHash }))]))
      .digest('hex');

    // 1. Check existing idempotency key if provided
    if (idempotencyKey) {
      const existingKey = await IdempotencyService.findRecord(
        parsedUserId,
        idempotencyKey,
        resourceType
      );

      if (existingKey) {
        if (existingKey.payloadHash === payloadHash) {
          const existingSchedule = await prisma.schedule.findUnique({
            where: { id: existingKey.resourceId },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
              requestedPriest: { select: { id: true, fullName: true } },
            },
          });
          if (existingSchedule) {
            return { schedule: sanitizeSchedulePriest(existingSchedule), isReplay: true };
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

    // Only if this is a NEW create: validate requested priest currently eligible
    if (parsedRequestedPriestId !== null) {
      await validateRequestedPriestEligibility(parsedRequestedPriestId, parsedParishId, prisma);
    }

    // 2. Perform booking within a Serializable transaction to guarantee race protection
    const fullRemarks = [
      `Time Slot: ${timeSlot}. [Estimated End Time]`,
      remarks ? `Notes: ${remarks.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const scheduleDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );
    const startDatetime = parseManilaDateTime(horizon.dateStr, timeSlot);
    const endDatetime = startDatetime ? new Date(startDatetime.getTime() + 60 * 60 * 1000) : null;

    if (webAttachments !== null) {
      const parish = await prisma.parish.findUnique({ where: { id: parsedParishId } });
      requireEnabledSchedulingService(parish, canonicalEventType);
      validateScheduleRequirements(parish, canonicalEventType, webAttachments);
      await ScheduleAttachmentService.stage(webAttachments, parsedUserId, parsedParishId);
    }

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
          const requirements = webAttachments === null ? [] : validateScheduleRequirements(parish, canonicalEventType, webAttachments);

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

          const resolvedLocation = canonicalEventType === "WEDDING"
            ? parish.parishName
            : (typeof location === "string" && location.trim() ? location.trim().slice(0, 150) : null);

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
              location: resolvedLocation,
              status: "PENDING",
              conflictFlag: false,
              remarks: fullRemarks,
              requestedPriestId: parsedRequestedPriestId,
              ...(webAttachments?.length ? { attachments: { create: webAttachments.map((attachment) => ({
                requirementId: attachment.requirementId,
                requirementLabel: requirements.find((r) => r.id === attachment.requirementId).label,
                fileName: attachment.fileName, fileType: attachment.fileType, fileSize: attachment.fileSize,
                r2ObjectKey: attachment.r2ObjectKey,
              })) } } : {}),
            },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
              requestedPriest: { select: { id: true, fullName: true } },
            },
          });

          if (webAttachments?.length) {
            const recoveryJobs = await tx.privateObjectCleanupJob.updateMany({
              where: { objectKey: { in: webAttachments.map((a) => a.r2ObjectKey) }, status: 'PENDING' },
              data: { status: 'CANCELLED', completedAt: new Date() },
            });
            if (recoveryJobs.count !== webAttachments.length) {
              throw Object.assign(new Error('Upload expired. Please retry your booking.'), { statusCode: 409, code: 'SCHEDULE_UPLOAD_EXPIRED' });
            }
          }

          // Atomically persist idempotency key
          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                userId: parsedUserId,
                resourceType,
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

      return { schedule: sanitizeSchedulePriest(result), isReplay: false };
    } catch (err) {
      // Catch Prisma P2003 foreign key constraint violation specifically for requested_priest_id
      if (err?.code === "P2003") {
        const fieldOrTarget = String(
          err?.meta?.field_name ||
          err?.meta?.target ||
          err?.meta?.constraint ||
          err?.message ||
          ""
        );
        if (fieldOrTarget.includes("requested_priest_id") || fieldOrTarget.includes("schedules_requested_priest_id_fkey")) {
          const fkErr = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
          fkErr.statusCode = 400;
          fkErr.code = "INVALID_REQUESTED_PRIEST";
          throw fkErr;
        }
      }

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
            resourceType
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
              requestedPriest: { select: { id: true, fullName: true } },
            },
          });
          if (winnerSchedule) {
            return { schedule: sanitizeSchedulePriest(winnerSchedule), isReplay: true };
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
  async respondReschedule(scheduleId, accept, actorId, actorRole, expectedVersion) {
    const parsedId = parseInt(scheduleId, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }
    if (actorRole !== "PARISHIONER") {
      const err = new Error("Only parishioners can respond to reschedule proposals on their schedule requests.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "respond to a reschedule proposal");
    const schedule = await prisma.schedule.findUnique({
      where: { id: parsedId },
      include: {
        parish: {
          include: {
            availabilities: { where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } } },
          },
        },
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }
    if (schedule.userId !== Number(actorId)) {
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
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    let horizon = null;
    let proposedSlot = null;
    if (accept) {
      if (!schedule.proposedDate || !schedule.proposedStartDatetime) {
        const err = new Error("No proposed reschedule date or time is set on this request.");
        err.statusCode = 400;
        err.code = "MISSING_PROPOSAL_DATA";
        throw err;
      }
      const proposedDateStr = getManilaDateString(schedule.proposedDate);
      horizon = validateDateHorizon(proposedDateStr, null, new Date());
      proposedSlot = formatManilaTimeSlot(schedule.proposedStartDatetime);
      if (!proposedSlot) {
        const err = new Error("The proposed reschedule time is invalid.");
        err.statusCode = 400;
        err.code = "INVALID_PROPOSAL_TIME";
        throw err;
      }
    }

    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          if (accept) {
            await lockParishSchedulingConfiguration(tx, schedule.parishId);
            const priestsToLock = [schedule.assignedPriestId].filter((pId) => pId !== null && pId !== undefined);
            if (priestsToLock.length) {
              await lockPriestsForScheduling(tx, priestsToLock);
            }
          }

          const current = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              parish: {
                include: {
                  availabilities: { where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } } },
                },
              },
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });
          if (!current || current.userId !== Number(actorId)) {
            const err = new Error("You do not have permission to respond to this schedule request.");
            err.statusCode = 403;
            err.code = "FORBIDDEN";
            throw err;
          }
          if (!["PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"].includes(current.status)) {
            const err = new Error("Schedule status was modified by another operation.");
            err.statusCode = 409;
            err.code = "SCHEDULE_STATUS_CONFLICT";
            throw err;
          }
          if (current.version !== version) {
            throwScheduleConcurrencyConflict();
          }

          if (!accept) {
            await appendScheduleHistory(tx, current, {
              reason: "Parishioner declined reschedule proposal",
              actorId,
              actorRole,
            });
            await updateScheduleAtVersion(tx, parsedId, version, {
              status: ScheduleStatus.CANCELLED,
              processedById: Number(actorId),
            });
            const declined = await tx.schedule.findUnique({
              where: { id: parsedId },
              include: {
                user: { select: { id: true, fullName: true, email: true } },
                parish: { select: { id: true, parishName: true } },
              },
            });
            return {
              schedule: declined,
              postCommitNotification: {
                type: "PROPOSAL_DECLINED",
                parishId: declined.parishId,
                scheduleId: declined.id,
                parishionerName: declined.user?.fullName || "Parishioner",
                displayTitle: declined.displayTitle || "Schedule Request",
              },
            };
          }

          if (!current.proposedDate || !current.proposedStartDatetime) {
            const err = new Error("No proposed reschedule date or time is set on this request.");
            err.statusCode = 400;
            err.code = "MISSING_PROPOSAL_DATA";
            throw err;
          }

          const schedulingConfig = requireEnabledSchedulingService(current.parish, current.eventType);
          validateParishAndOffice(current.parish, horizon.dayName, proposedSlot);
          validateParishAvailability(current.parish.availabilities, horizon.dateStr);
          const schedulingRules = await loadSchedulingRules(tx, current.parishId, horizon.dateStr);
          evaluateSchedulingRules({
            eventType: current.eventType,
            dateInput: horizon.dateStr,
            ...schedulingRules,
          });

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
              requestedDate: { gte: dateStartUtc, lte: dateEndUtc },
            },
            select: { id: true, remarks: true },
          });
          validateSlotAndCapacity(
            schedulingConfig.timeSlots,
            activeBookings,
            proposedSlot,
            schedulingConfig.dailyCapacity,
            schedulingConfig.slotCapacity
          );

          const newStartDatetime = current.proposedStartDatetime;
          const newEndDatetime = current.proposedEndDatetime
            || new Date(newStartDatetime.getTime() + 60 * 60 * 1000);
          if (current.assignedPriestId) {
            await ConflictHelper.checkPriestConflict(
              current.assignedPriestId,
              horizon.dateStr,
              newStartDatetime,
              newEndDatetime,
              { excludeScheduleId: parsedId, tx, actorId }
            );
          }
          requirePriestAccepted(current);

          const existingRemarks = current.remarks
            ? current.remarks
                .replace(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)\.?/i, "")
                .replace(/\[Estimated End Time\]/gi, "")
                .trim()
            : "";
          const newRemarks = [
            `Time Slot: ${proposedSlot}.`,
            current.proposedEndDatetime ? "" : "[Estimated End Time]",
            existingRemarks,
            `[Rescheduled from ${getManilaDateString(current.requestedDate)}]`,
          ].filter(Boolean).join(" ");

          await appendScheduleHistory(tx, current, {
            reason: "Parishioner accepted reschedule proposal",
            actorId,
            actorRole,
          });
          await updateScheduleAtVersion(tx, parsedId, version, {
            status: ScheduleStatus.CONFIRMED,
            requestedDate: new Date(
              Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
            ),
            startDatetime: newStartDatetime,
            endDatetime: newEndDatetime,
            proposedDate: null,
            proposedStartDatetime: null,
            proposedEndDatetime: null,
            rescheduleReason: null,
            remarks: newRemarks,
            conflictFlag: false,
            processedById: Number(actorId),
          });

          const updated = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
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
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
      if (outcome?.postCommitNotification?.type === "PROPOSAL_DECLINED") {
        await NotificationDispatcher.notifyProposalDeclined(outcome.postCommitNotification);
        return outcome.schedule;
      }
      return outcome;
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        throwScheduleConcurrencyConflict();
      }
      throw err;
    }
  }

  /**
   * Updates schedule status (admin/staff workflow).
   */
  async updateStatus(id, status, processedById, actorRole, actorParishId, expectedVersion, rejectionDetails = {}) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "update a schedule");
    const targetStatus = mapIncomingScheduleStatus(status);
    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "update");
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    return runVersionedScheduleTransaction(
      async (tx) => {
        const current = await tx.schedule.findUnique({ where: { id: parsedId } });
        if (!current) {
          const err = new Error("Schedule request not found.");
          err.statusCode = 404;
          err.code = "SCHEDULE_NOT_FOUND";
          throw err;
        }

        authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "update");
        if (current.version !== version) {
          throwScheduleConcurrencyConflict();
        }

        if (current.status === targetStatus) {
          return tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });
        }

        validateScheduleTransition(current, targetStatus, { allowReversionToPending: false });

        let rejectionUpdateData = {};
        let historyReason = "Status changed to " + targetStatus;
        let rejectionContext = null;

        if (targetStatus === ScheduleStatus.REJECTED) {
          const {
            rejectionReasonCode = null,
            affectedRequirementIds = [],
            rejectionNote = null,
          } = rejectionDetails || {};

          if (!rejectionReasonCode || !SCHEDULE_REJECTION_REASONS[rejectionReasonCode]) {
            const err = new Error("A valid rejection reason is required.");
            err.statusCode = 400;
            err.code = "INVALID_REJECTION_REASON";
            throw err;
          }

          const [parish, existingAttachments] = await Promise.all([
            tx.parish.findUnique({
              where: { id: current.parishId },
              select: { id: true, eventSettings: true },
            }),
            tx.scheduleAttachment.findMany({
              where: { scheduleId: parsedId },
              select: { requirementId: true, requirementLabel: true },
            }),
          ]);

          const requirementMap = new Map();
          for (const req of getScheduleRequirements(parish, current.eventType)) {
            requirementMap.set(req.id, { id: req.id, label: req.label });
          }
          for (const att of existingAttachments) {
            if (att.requirementId && !requirementMap.has(att.requirementId)) {
              requirementMap.set(att.requirementId, {
                id: att.requirementId,
                label: att.requirementLabel || att.requirementId,
              });
            }
          }

          if (DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has(rejectionReasonCode) && requirementMap.size === 0) {
            const err = new Error("Document-related rejection reasons do not apply to schedules without document requirements.");
            err.statusCode = 400;
            err.code = "INVALID_REJECTION_REASON";
            throw err;
          }

          const uniqueIds = Array.isArray(affectedRequirementIds)
            ? [...new Set(affectedRequirementIds.map((item) => String(item).trim()).filter(Boolean))]
            : [];

          const invalidIds = uniqueIds.filter((reqId) => !requirementMap.has(reqId));
          if (invalidIds.length > 0) {
            const err = new Error("One or more selected affected requirements do not belong to this schedule.");
            err.statusCode = 400;
            err.code = "INVALID_AFFECTED_REQUIREMENTS";
            throw err;
          }

          const selectedAffected = uniqueIds.map((reqId) => requirementMap.get(reqId));
          if (
            DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has(rejectionReasonCode) &&
            requirementMap.size > 0 &&
            selectedAffected.length === 0
          ) {
            const err = new Error("Please select at least one affected requirement for this rejection reason.");
            err.statusCode = 400;
            err.code = "AFFECTED_REQUIREMENTS_REQUIRED";
            throw err;
          }

          const normalizedNote =
            typeof rejectionNote === "string" && rejectionNote.trim()
              ? rejectionNote.trim().slice(0, 1000)
              : null;

          const reasonLabel = getScheduleRejectionReasonLabel(rejectionReasonCode);
          rejectionUpdateData = {
            rejectionReasonCode,
            rejectionAffectedRequirements: selectedAffected.length > 0 ? selectedAffected : null,
            rejectionNote: normalizedNote,
          };

          const historyParts = [`Rejected: ${reasonLabel}`];
          if (selectedAffected.length > 0) {
            historyParts.push(`Affected: ${selectedAffected.map((r) => r.label).join(", ")}`);
          }
          if (normalizedNote) {
            historyParts.push(`Note: ${normalizedNote}`);
          }
          historyReason = historyParts.join(" | ");

          rejectionContext = {
            reasonLabel,
            affectedRequirements: selectedAffected.map((r) => r.label),
            note: normalizedNote,
          };
        }

        await appendScheduleHistory(tx, current, {
          reason: historyReason,
          actorId: processedById,
          actorRole,
        });
        await updateScheduleAtVersion(tx, parsedId, version, {
          status: targetStatus,
          processedById: parseInt(processedById, 10),
          ...rejectionUpdateData,
        });
        await supersedeOpenAlternativeProposals(tx, parsedId, processedById);

        const updated = await tx.schedule.findUnique({
          where: { id: parsedId },
          include: {
            user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
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
          rejectionContext,
        }, tx);

        return updated;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Staff proposes an alternative reschedule date/slot to the parishioner.
   */
  async proposeReschedule(id, {
    proposedDate,
    proposedStartDatetime,
    proposedEndDatetime,
    reason,
    actorId,
    actorRole,
    actorParishId,
    expectedVersion,
  }) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "propose a reschedule");
    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "propose reschedules for");
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    const horizon = validateDateHorizon(proposedDate, null, new Date());
    const proposedDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );
    const proposedStart = proposedStartDatetime ? new Date(proposedStartDatetime) : null;
    const proposedEnd = proposedEndDatetime ? new Date(proposedEndDatetime) : null;
    if (proposedStart && proposedEnd && proposedEnd <= proposedStart) {
      const err = new Error("proposedEndDatetime must be after proposedStartDatetime.");
      err.statusCode = 400;
      err.code = "INVALID_PROPOSAL_INTERVAL";
      throw err;
    }

    return runVersionedScheduleTransaction(
      async (tx) => {
        const current = await tx.schedule.findUnique({ where: { id: parsedId } });
        if (!current) {
          const err = new Error("Schedule request not found.");
          err.statusCode = 404;
          err.code = "SCHEDULE_NOT_FOUND";
          throw err;
        }

        authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "propose reschedules for");
        if (current.version !== version) {
          throwScheduleConcurrencyConflict();
        }
        validateScheduleTransition(current, ScheduleStatus.PROPOSED_RESCHEDULE);

        await appendScheduleHistory(tx, current, {
          reason: reason || "Reschedule proposed",
          actorId,
          actorRole,
        });
        await updateScheduleAtVersion(tx, parsedId, version, {
          status: ScheduleStatus.PROPOSED_RESCHEDULE,
          proposedDate: proposedDateUtc,
          proposedStartDatetime: proposedStart,
          proposedEndDatetime: proposedEnd,
          rescheduleReason: reason || null,
          processedById: parseInt(actorId, 10),
          proposalVersion: { increment: 1 },
        });
        await supersedeOpenAlternativeProposals(tx, parsedId, actorId);

        const updated = await tx.schedule.findUnique({
          where: { id: parsedId },
          include: {
            user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
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
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Explicitly assigns a Lay Minister to an eligible Funeral or Blessing only
   * after every active parish priest is authoritatively unavailable.
   */
  async assignLayMinister(id, {
    expectedVersion,
    reason,
    actorId,
    actorRole,
    actorParishId,
  }) {
    const parsedId = parseInt(id, 10);
    if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
      const error = new Error("Invalid schedule ID.");
      error.statusCode = 400;
      error.code = "INVALID_ID";
      throw error;
    }
    const version = requireExpectedVersion(expectedVersion, "assign a Lay Minister");
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    if (trimmedReason.length < 5 || trimmedReason.length > 1000) {
      const error = new Error("Assignment reason is required and must be between 5 and 1000 characters.");
      error.statusCode = 400;
      error.code = "INVALID_REASON";
      throw error;
    }

    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
    if (!schedule) {
      const error = new Error("Schedule request not found.");
      error.statusCode = 404;
      error.code = "SCHEDULE_NOT_FOUND";
      throw error;
    }
    authorizeLayMinisterMutation(actorRole, actorParishId, schedule.parishId);
    if (schedule.layMinisterAssigned) {
      return decorateScheduleForDisplay(schedule);
    }
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    return runVersionedScheduleTransaction(
      async (tx) => {
        await lockParishSchedulingConfiguration(tx, schedule.parishId);
        const priests = await tx.user.findMany({
          where: {
            parishId: schedule.parishId,
            role: { roleName: "PRIEST" },
            status: "ACTIVE",
          },
          select: { id: true },
          orderBy: { id: "asc" },
        });
        await lockPriestsForScheduling(tx, priests.map((priest) => priest.id));

        const current = await tx.schedule.findUnique({
          where: { id: parsedId },
          include: {
            user: { select: { id: true, fullName: true } },
            parish: { select: { id: true, parishName: true } },
          },
        });
        if (!current) {
          const error = new Error("Schedule request not found.");
          error.statusCode = 404;
          error.code = "SCHEDULE_NOT_FOUND";
          throw error;
        }
        authorizeLayMinisterMutation(actorRole, actorParishId, current.parishId);
        if (current.layMinisterAssigned) {
          return decorateScheduleForDisplay(current);
        }
        if (current.version !== version) {
          throwScheduleConcurrencyConflict();
        }
        assertScheduleMutable(current);
        if (!isLayMinisterEligibleEvent(current.eventType)) {
          const error = new Error("Lay Minister assignment is available only for Funeral and Blessing appointments.");
          error.statusCode = 422;
          error.code = "LAY_MINISTER_EVENT_NOT_ELIGIBLE";
          throw error;
        }

        let start = current.startDatetime ? new Date(current.startDatetime) : null;
        const timeSlot = extractScheduleTimeSlot(current);
        if ((!start || Number.isNaN(start.getTime())) && timeSlot) {
          start = parseManilaDateTime(getManilaDateString(current.requestedDate), timeSlot);
        }
        const end = current.endDatetime
          ? new Date(current.endDatetime)
          : (start ? computeOperationalEndDatetime(start) : null);
        if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime()) || end <= start) {
          const error = new Error("The appointment interval cannot be verified.");
          error.statusCode = 422;
          error.code = "SCHEDULE_INTERVAL_UNRESOLVED";
          throw error;
        }
        if (Date.now() >= start.getTime()) {
          const error = new Error("A Lay Minister cannot be assigned after the appointment has started.");
          error.statusCode = 409;
          error.code = "SCHEDULE_ALREADY_STARTED";
          throw error;
        }

        for (const priest of priests) {
          const classification = await classifyPriestAvailability({
            priestId: priest.id,
            date: current.requestedDate,
            startDatetime: start,
            endDatetime: end,
            excludeScheduleId: current.id,
            schedule: current,
            timeSlot,
            actorId,
            actorRole,
            tx,
          });
          if (classification === PriestAvailabilityClassification.AVAILABLE) {
            const error = new Error("A parish priest is available for this appointment.");
            error.statusCode = 409;
            error.code = "LAY_MINISTER_PRIEST_AVAILABLE";
            throw error;
          }
          if (classification === PriestAvailabilityClassification.UNKNOWN) {
            const error = new Error("Priest unavailability could not be verified.");
            error.statusCode = 409;
            error.code = "LAY_MINISTER_AVAILABILITY_UNVERIFIED";
            throw error;
          }
        }

        await appendScheduleHistory(tx, current, {
          reason: trimmedReason,
          actorId,
          actorRole,
        });
        await updateScheduleAtVersion(tx, parsedId, version, {
          assignedPriestId: null,
          priestResponseStatus: null,
          priestResponseReason: null,
          priestVerbalApproval: false,
          priestVerbalApprovalById: null,
          priestVerbalApprovalAt: null,
          ...(current.priestChangeStatus === "PENDING"
            ? {
                priestChangeStatus: "RESOLVED",
                priestChangeResolvedAt: new Date(),
              }
            : {}),
          layMinisterAssigned: true,
          processedById: Number(actorId),
        });

        const updated = await tx.schedule.findUnique({
          where: { id: parsedId },
          include: {
            user: { select: { id: true, fullName: true } },
            parish: { select: { id: true, parishName: true } },
          },
        });
        await AuditLogService.log(actorId, "Lay Minister Assigned", tx, false, {
          affectedTable: "schedules",
          affectedRecordId: parsedId,
          parishId: updated.parishId,
          previousValues: {
            assignedPriestId: current.assignedPriestId,
            layMinisterAssigned: current.layMinisterAssigned,
            status: current.status,
          },
          newValues: {
            assignedPriestId: null,
            layMinisterAssigned: true,
            status: updated.status,
          },
          metadata: { reason: trimmedReason, verifiedPriestCount: priests.length },
        });
        await NotificationDispatcher.notifyLayMinisterAssigned({
          parishionerId: updated.userId,
          scheduleId: updated.id,
          originalDisplayTitle: current.displayTitle || current.eventType,
          effectiveDisplayTitle: resolveScheduleDisplayTitle(updated),
          requestedDate: getManilaDateString(updated.requestedDate),
          timeSlot,
        }, tx);

        return decorateScheduleForDisplay(updated);
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Assigns a priest to a schedule request.
   */
  async assignPriest(id, priestId, actorId, actorRole, actorParishId, expectedVersion, options = {}) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = normalizePriestId(priestId);
    const verbalApproval = Boolean(options?.verbalApproval);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "assign a priest");
    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }
    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "assign priests for");
    if (
      verbalApproval
      && (actorRole !== "SECRETARY" || !actorParishId || Number(schedule.parishId) !== Number(actorParishId))
    ) {
      const err = new Error("Only an authorized parish secretary managing their own parish may record verbal priest approval.");
      err.statusCode = 403;
      err.code = "FORBIDDEN_VERBAL_APPROVAL";
      throw err;
    }
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockParishSchedulingConfiguration(tx, schedule.parishId);
          const priestsToLock = [schedule.assignedPriestId, parsedPriestId].filter((pId) => pId !== null && pId !== undefined);
          await lockPriestsForScheduling(tx, priestsToLock);

          const current = await tx.schedule.findUnique({ where: { id: parsedId } });
          if (!current) {
            const err = new Error("Schedule request not found.");
            err.statusCode = 404;
            err.code = "SCHEDULE_NOT_FOUND";
            throw err;
          }
          authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "assign priests for");
          if (
            verbalApproval
            && (actorRole !== "SECRETARY" || !actorParishId || Number(current.parishId) !== Number(actorParishId))
          ) {
            const err = new Error("Only an authorized parish secretary managing their own parish may record verbal priest approval.");
            err.statusCode = 403;
            err.code = "FORBIDDEN_VERBAL_APPROVAL";
            throw err;
          }
          if (current.version !== version) {
            throwScheduleConcurrencyConflict();
          }
          assertScheduleMutable(current);

          const targetPriest = await tx.user.findUnique({
            where: { id: parsedPriestId },
            include: { role: true },
          });
          if (!targetPriest) {
            const err = new Error("Target priest user not found.");
            err.statusCode = 404;
            err.code = "PRIEST_NOT_FOUND";
            throw err;
          }
          if (targetPriest.role?.roleName !== "PRIEST") {
            const err = new Error("Target user does not hold the PRIEST role.");
            err.statusCode = 400;
            err.code = "INVALID_PRIEST_ROLE";
            throw err;
          }
          if (targetPriest.status !== "ACTIVE") {
            const err = new Error("Target priest account is not active.");
            err.statusCode = 400;
            err.code = "PRIEST_INACTIVE";
            throw err;
          }
          if (Number(targetPriest.parishId) !== Number(current.parishId)) {
            const err = new Error("Target priest is not assigned to this parish.");
            err.statusCode = 403;
            err.code = "FORBIDDEN_PARISH_ASSIGNMENT";
            throw err;
          }

          if (
            current.assignedPriestId === parsedPriestId
            && !current.layMinisterAssigned
            && !(verbalApproval && current.priestResponseStatus !== "ACCEPTED")
            && current.priestChangeStatus !== "PENDING"
          ) {
            const existing = await tx.schedule.findUnique({
              where: { id: parsedId },
              include: {
                user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
                parish: { select: { id: true, parishName: true } },
                assignedPriest: { select: { id: true, fullName: true } },
                priestChangeRequestedPriest: { select: { id: true, fullName: true } },
                priestVerbalApprovalBy: { select: { id: true, fullName: true } },
              },
            });
            return sanitizeSchedulePriest(existing);
          }

          await ConflictHelper.checkPriestConflict(
            parsedPriestId,
            current.requestedDate,
            current.startDatetime,
            current.endDatetime,
            { excludeScheduleId: parsedId, tx, actorId }
          );

          const nextStatus = current.status === ScheduleStatus.CONFIRMED
            ? ScheduleStatus.PENDING
            : current.status;
          const now = new Date();
          const resolveChangeFields = current.priestChangeStatus === "PENDING"
            ? {
                priestChangeStatus: "RESOLVED",
                priestChangeResolvedAt: now,
              }
            : {};

          await appendScheduleHistory(tx, current, {
            reason: verbalApproval
              ? "Priest assigned with secretary-recorded verbal approval"
              : "Priest assignment changed",
            actorId,
            actorRole,
          });
          await updateScheduleAtVersion(tx, parsedId, version, {
            assignedPriestId: parsedPriestId,
            priestResponseStatus: verbalApproval ? "ACCEPTED" : "PENDING",
            priestResponseReason: null,
            priestVerbalApproval: verbalApproval,
            priestVerbalApprovalById: verbalApproval ? parseInt(actorId, 10) : null,
            priestVerbalApprovalAt: verbalApproval ? now : null,
            layMinisterAssigned: false,
            status: nextStatus,
            processedById: parseInt(actorId, 10),
            ...resolveChangeFields,
          });
          await supersedeOpenAlternativeProposals(tx, parsedId, actorId);

          const updated = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
              priestChangeRequestedPriest: { select: { id: true, fullName: true } },
              priestVerbalApprovalBy: { select: { id: true, fullName: true } },
            },
          });

          await AuditLogService.log(
            actorId,
            verbalApproval ? "Priest Assigned (Verbal Approval)" : "Priest Assigned",
            tx,
            false,
            {
              role: actorRole,
              affectedTable: "schedules",
              affectedRecordId: parsedId,
              parishId: updated.parishId,
              previousValues: {
                status: current.status,
                assignedPriestId: current.assignedPriestId,
                priestResponseStatus: current.priestResponseStatus,
                priestVerbalApproval: Boolean(current.priestVerbalApproval),
                priestChangeStatus: current.priestChangeStatus || null,
              },
              newValues: {
                status: updated.status,
                assignedPriestId: updated.assignedPriestId,
                priestResponseStatus: updated.priestResponseStatus,
                priestVerbalApproval: Boolean(updated.priestVerbalApproval),
                priestVerbalApprovalById: updated.priestVerbalApprovalById,
                priestChangeStatus: updated.priestChangeStatus || null,
              },
              metadata: {
                verbalApproval,
                recordedBySecretaryId: verbalApproval ? Number(actorId) : null,
                priestId: parsedPriestId,
              },
            }
          );

          await NotificationDispatcher.notifyPriestAssigned({
            parishionerId: updated.userId,
            parishId: updated.parishId,
            scheduleId: updated.id,
            displayTitle: resolveScheduleDisplayTitle(updated),
            priestId: parsedPriestId,
            priestName: updated.assignedPriest?.fullName || "Assigned Priest",
            verbalApproval,
          }, tx);

          return sanitizeSchedulePriest(updated);
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        throwScheduleConcurrencyConflict();
      }
      throw err;
    }
  }

  /**
   * Safe preflight check of parish priest availability for a given schedule request.
   * Returns a sanitized list of { priestId, available, reasonCode } objects.
   * Internal details, personal commitment titles, and private calendar notes are strictly excluded.
   */
  async getPriestAvailability(id, {
    actorRole,
    actorParishId,
    candidateDate,
    candidateTime,
    candidateStartDatetime,
  } = {}) {
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

    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "check priest availability for");

    const priests = await prisma.user.findMany({
      where: {
        parishId: schedule.parishId,
        role: { roleName: "PRIEST" },
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
      orderBy: { id: "asc" },
    });

    if (!priests.length) {
      return [];
    }

    let targetDate = schedule.requestedDate;
    let targetStart = schedule.startDatetime;
    let targetEnd = schedule.endDatetime;
    let targetTimeSlot = extractScheduleTimeSlot(schedule) || null;

    if (candidateStartDatetime) {
      targetStart = new Date(candidateStartDatetime);
      targetEnd = Number.isNaN(targetStart.getTime())
        ? null
        : computeOperationalEndDatetime(targetStart);
      targetTimeSlot = Number.isNaN(targetStart.getTime())
        ? null
        : formatManilaTimeSlot(targetStart);
      if (candidateDate) {
        const parsedDate = parseManilaDateOnly(candidateDate);
        if (parsedDate) {
          targetDate = parsedDate.databaseDate;
        }
      }
    } else if (candidateDate && candidateTime) {
      const parsedDate = parseManilaDateOnly(candidateDate);
      if (parsedDate) {
        targetDate = parsedDate.databaseDate;
        targetTimeSlot = candidateTime;
        targetStart = parseManilaDateTime(parsedDate.dateStr, candidateTime);
        targetEnd = targetStart ? new Date(targetStart.getTime() + 60 * 60 * 1000) : null;
      }
    }

    const results = [];
    for (const priest of priests) {
      try {
        await ConflictHelper.checkPriestConflict(
          priest.id,
          targetDate,
          targetStart,
          targetEnd,
          {
            excludeScheduleId: schedule.id,
            schedule: {
              ...schedule,
              requestedDate: targetDate,
              startDatetime: targetStart,
              endDatetime: targetEnd,
              timeSlot: targetTimeSlot,
            },
            timeSlot: targetTimeSlot,
            actorId: null,
            actorRole,
            isPriestOwner: false,
          }
        );
        results.push({
          priestId: priest.id,
          available: true,
          unavailabilityConfirmed: false,
        });
      } catch (conflictError) {
        const isExpectedConflict =
          conflictError.statusCode === 409
          && ["PRIEST_CONFLICT", "PRIEST_AVAILABILITY_UNDETERMINED"].includes(conflictError.code);
        if (isExpectedConflict) {
          results.push({
            priestId: priest.id,
            available: false,
            reasonCode: "PRIEST_UNAVAILABLE",
            unavailabilityConfirmed: conflictError.code === "PRIEST_CONFLICT",
          });
        } else {
          results.push({
            priestId: priest.id,
            available: null,
            reasonCode: "AVAILABILITY_CHECK_FAILED",
            unavailabilityConfirmed: false,
          });
        }
      }
    }

    return results;
  }

  /**
   * Priest responds to an assignment (ACCEPTED / REJECTED).
   */
  async respondPriestAssignment(id, priestId, status, reason, expectedVersion) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = normalizePriestId(priestId);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }
    if (!["ACCEPTED", "REJECTED"].includes(status)) {
      const err = new Error("Status must be ACCEPTED or REJECTED.");
      err.statusCode = 400;
      err.code = "INVALID_PRIEST_RESPONSE";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "respond to a priest assignment");
    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
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
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          await lockPriestForScheduling(tx, parsedPriestId);

          const current = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              parish: { select: { id: true, parishName: true } },
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });
          if (!current || current.assignedPriestId !== parsedPriestId) {
            const err = new Error("You are not the assigned priest for this schedule request.");
            err.statusCode = 403;
            err.code = "FORBIDDEN";
            throw err;
          }
          if (current.version !== version) {
            throwScheduleConcurrencyConflict();
          }
          assertScheduleMutable(current);
          if (status === "ACCEPTED" && current.priestResponseStatus === "ACCEPTED") {
            return current;
          }

          if (status === "ACCEPTED") {
            await ConflictHelper.checkPriestConflict(
              parsedPriestId,
              current.requestedDate,
              current.startDatetime,
              current.endDatetime,
              { excludeScheduleId: parsedId, tx, actorId: parsedPriestId, isPriestOwner: true }
            );
          }

          const nextStatus = status === "REJECTED" && current.status === ScheduleStatus.CONFIRMED
            ? ScheduleStatus.PENDING
            : current.status;

          await appendScheduleHistory(tx, current, {
            reason: status === "ACCEPTED"
              ? "Priest accepted assignment"
              : reason || "Priest rejected assignment",
            actorId: parsedPriestId,
            actorRole: "PRIEST",
          });
          await updateScheduleAtVersion(tx, parsedId, version, status === "ACCEPTED"
            ? {
                priestResponseStatus: "ACCEPTED",
                priestResponseReason: reason || null,
              }
            : {
                assignedPriestId: null,
                priestResponseStatus: "REJECTED",
                priestResponseReason: reason || null,
                priestVerbalApproval: false,
                priestVerbalApprovalById: null,
                priestVerbalApprovalAt: null,
                status: nextStatus,
              });

          const updated = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });
          const priestName = current.assignedPriest?.fullName || "Priest";


          await AuditLogService.log(
            parsedPriestId,
            status === "ACCEPTED" ? "Priest Assignment Accepted" : "Priest Assignment Declined",
            tx,
            false,
            {
              affectedTable: "schedules",
              affectedRecordId: parsedId,
              parishId: updated.parishId,
              previousValues: {
                status: current.status,
                assignedPriestId: current.assignedPriestId,
                priestResponseStatus: current.priestResponseStatus,
              },
              newValues: {
                status: updated.status,
                assignedPriestId: updated.assignedPriestId,
                priestResponseStatus: updated.priestResponseStatus,
              },
            }
          );

          return { updated, priestName, notificationRequired: true };
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );

      if (!outcome?.notificationRequired) {
        return outcome?.updated || outcome;
      }
      await NotificationDispatcher.notifyPriestResponse({
        parishId: outcome.updated.parishId,
        scheduleId: outcome.updated.id,
        displayTitle: outcome.updated.displayTitle || outcome.updated.eventType,
        priestName: outcome.priestName,
        status,
        reason,
        referenceType: "SCHEDULE_REQUEST",
      });
      if (status === "REJECTED") {
        await NotificationDispatcher.notifyPriestReassignmentRequired({
          parishionerId: outcome.updated.userId,
          scheduleId: outcome.updated.id,
          displayTitle: outcome.updated.displayTitle || outcome.updated.eventType,
        });
      }
      return outcome.updated;
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        throwScheduleConcurrencyConflict();
      }
      throw err;
    }
  }

  /**
   * Confirmed-only Emergency Reschedule.
   * Authoritatively reschedules a CONFIRMED schedule in an emergency.
   * Snapshots prior state into ScheduleHistory inside the same Serializable transaction.
   * Revalidates capacity and retained assigned priest conflicts.
   */
  async emergencyReschedule(id, {
    targetDate,
    timeSlot,
    reason,
    expectedVersion,
    actorId,
    actorRole,
    actorParishId,
  }) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }
    const version = requireExpectedVersion(expectedVersion, "emergency-reschedule a schedule");
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    if (trimmedReason.length < 5 || trimmedReason.length > 1000) {
      const err = new Error("Emergency reschedule reason is required and must be between 5 and 1000 characters.");
      err.statusCode = 400;
      err.code = "INVALID_REASON";
      throw err;
    }

    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }
    authorizeStaffScheduleMutation(actorRole, actorParishId, schedule.parishId, "emergency reschedule");
    if (schedule.status !== ScheduleStatus.CONFIRMED) {
      const err = new Error("Emergency reschedule is only permitted for CONFIRMED schedules.");
      err.statusCode = 400;
      err.code = "INVALID_STATUS";
      throw err;
    }
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    const horizon = validateDateHorizon(targetDate, timeSlot, new Date());
    const targetDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );
    const targetStart = parseManilaDateTime(horizon.dateStr, timeSlot);
    if (!targetStart) {
      const err = new Error("Invalid target time slot.");
      err.statusCode = 400;
      err.code = "INVALID_SLOT";
      throw err;
    }

    // Current Admin scheduling configuration defines slot starts only. Preserve
    // the legacy 60-minute conflict window without treating it as an actual end.
    const targetEnd = new Date(targetStart.getTime() + 60 * 60 * 1000);

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await lockParishSchedulingConfiguration(tx, schedule.parishId);
          const priestsToLock = [schedule.assignedPriestId].filter((pId) => pId !== null && pId !== undefined);
          if (priestsToLock.length) {
            await lockPriestsForScheduling(tx, priestsToLock);
          }

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
          if (!current) {
            const err = new Error("Schedule request not found.");
            err.statusCode = 404;
            err.code = "SCHEDULE_NOT_FOUND";
            throw err;
          }
          authorizeStaffScheduleMutation(actorRole, actorParishId, current.parishId, "emergency reschedule");
          if (current.status !== ScheduleStatus.CONFIRMED) {
            const err = new Error("Schedule is no longer in CONFIRMED status.");
            err.statusCode = 409;
            err.code = "SCHEDULE_STATUS_CONFLICT";
            throw err;
          }
          if (current.version !== version) {
            throwScheduleConcurrencyConflict();
          }

          const schedulingConfig = requireEnabledSchedulingService(current.parish, current.eventType);
          validateParishAndOffice(current.parish, horizon.dayName, timeSlot);
          validateParishAvailability(current.parish.availabilities, horizon.dateStr);
          const schedulingRules = await loadSchedulingRules(tx, current.parishId, horizon.dateStr);
          evaluateSchedulingRules({
            eventType: current.eventType,
            dateInput: horizon.dateStr,
            ...schedulingRules,
          });

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
              requestedDate: { gte: dateStartUtc, lte: dateEndUtc },
            },
            select: { id: true, remarks: true },
          });
          validateSlotAndCapacity(
            schedulingConfig.timeSlots,
            activeBookings,
            timeSlot,
            schedulingConfig.dailyCapacity,
            schedulingConfig.slotCapacity
          );

          if (current.assignedPriestId) {
            await ConflictHelper.checkPriestConflict(
              current.assignedPriestId,
              horizon.dateStr,
              targetStart,
              targetEnd,
              { excludeScheduleId: parsedId, tx, actorId }
            );
          }
          requirePriestAccepted(current);

          const oldDateStr = getManilaDateString(current.requestedDate);
          const existingRemarks = current.remarks
            ? current.remarks
                .replace(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)\.?/i, "")
                .replace(/\[Estimated End Time\]/gi, "")
                .trim()
            : "";
          const newRemarks = [
            `Time Slot: ${timeSlot}. [Estimated End Time]`,
            existingRemarks,
            `[Emergency Rescheduled from ${oldDateStr}: ${trimmedReason}]`,
          ].filter(Boolean).join(" ");

          await appendScheduleHistory(tx, current, {
            reason: trimmedReason,
            actorId,
            actorRole,
          });

          await updateScheduleAtVersion(tx, parsedId, version, {
            requestedDate: targetDateUtc,
            startDatetime: targetStart,
            endDatetime: targetEnd,
            remarks: newRemarks,
            processedById: parseInt(actorId, 10),
          });
          await supersedeOpenAlternativeProposals(tx, parsedId, actorId);

          return tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true, email: true } },
            },
          });
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );

      await NotificationDispatcher.notifyEmergencyReschedule({
        parishionerId: result.userId,
        parishId: result.parishId,
        scheduleId: result.id,
        displayTitle: result.displayTitle || result.eventType,
        newDate: horizon.dateStr,
        newSlot: timeSlot,
        reason: trimmedReason,
        priestId: result.assignedPriestId,
        priestName: result.assignedPriest?.fullName || "Assigned Priest",
      });

      return result;
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        throwScheduleConcurrencyConflict();
      }
      throw err;
    }
  }

  /**
   * Creates a persistent schedule draft for the authenticated parishioner.
   */
  async createDraft(userId, draftData = {}, idempotencyKey = null) {
    const parsedUserId = parseInt(userId, 10);
    const parsedParishId = parseInt(draftData.parishId, 10);
    if (isNaN(parsedUserId) || isNaN(parsedParishId) || parsedUserId <= 0 || parsedParishId <= 0) {
      const err = new Error("Valid userId and parishId are required.");
      err.statusCode = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }

    await assertParishionerDraftOwner(parsedUserId);

    const canonicalEventType = validateCanonicalEventType(draftData.eventType);
    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
    });
    if (!parish || !parish.isActive) {
      const err = new Error("Selected parish is not available for scheduling.");
      err.statusCode = 400;
      err.code = "PARISH_INACTIVE";
      throw err;
    }
    requireEnabledSchedulingService(parish, canonicalEventType);

    const resolvedDisplayTitle = resolveDisplayTitle(canonicalEventType, draftData.displayTitle) || canonicalEventType;
    const preferredDateParsed = parseOptionalDraftDate(draftData.preferredDate, "preferredDate");
    const rawRequestedDate = draftData.requestedDate !== undefined ? draftData.requestedDate : draftData.date;
    const requestedDateParsed = parseOptionalDraftDate(rawRequestedDate, "requestedDate");
    const normalizedSlot = parseOptionalDraftTimeSlot(draftData.timeSlot);

    let parsedRequestedPriestId = null;
    if (draftData.requestedPriestId !== undefined && draftData.requestedPriestId !== null && draftData.requestedPriestId !== "") {
      try {
        parsedRequestedPriestId = normalizePriestId(draftData.requestedPriestId);
      } catch {
        const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
        err.statusCode = 400;
        err.code = "INVALID_REQUESTED_PRIEST";
        throw err;
      }
      await validateRequestedPriestEligibility(parsedRequestedPriestId, parsedParishId, prisma);
    }

    const resolvedLocation = canonicalEventType === "WEDDING"
      ? parish.parishName
      : normalizeOptionalDraftLocation(draftData.location);
    const resolvedRemarks = normalizeOptionalDraftRemarks(draftData.remarks);

    const hasValidKey = IdempotencyService.isValidKey(idempotencyKey);

    const payloadHash = computeScheduleDraftPayloadHash({
      parishId: parsedParishId,
      eventType: canonicalEventType,
      displayTitle: resolvedDisplayTitle,
      preferredDate: preferredDateParsed?.dateStr || null,
      requestedDate: requestedDateParsed?.dateStr || null,
      timeSlot: normalizedSlot,
      requestedPriestId: parsedRequestedPriestId,
      location: resolvedLocation,
      remarks: resolvedRemarks,
    });

    if (hasValidKey) {
      const existingRecord = await IdempotencyService.findRecord(
        parsedUserId,
        idempotencyKey,
        "SCHEDULE_DRAFT_CREATE",
        prisma
      );
      if (existingRecord) {
        assertScheduleDraftNotDeleted(existingRecord);
        if (existingRecord.payloadHash === payloadHash) {
          const existingDraft = await prisma.scheduleDraft.findFirst({
            where: { id: existingRecord.resourceId, userId: parsedUserId },
            include: SCHEDULE_DRAFT_INCLUDE,
          });
          if (existingDraft) {
            return { draft: formatScheduleDraft(existingDraft), isReplay: true };
          }
        } else {
          const conflictErr = new Error(
            "An idempotency key was reused with a different schedule draft payload. Please generate a new key."
          );
          conflictErr.statusCode = 409;
          conflictErr.code = "IDEMPOTENCY_PAYLOAD_MISMATCH";
          throw conflictErr;
        }
      }
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        await assertParishionerDraftOwner(parsedUserId, tx);
        const draft = await tx.scheduleDraft.create({
          data: {
            userId: parsedUserId,
            parishId: parsedParishId,
            eventType: canonicalEventType,
            displayTitle: resolvedDisplayTitle,
            preferredDate: preferredDateParsed?.utcDate || null,
            requestedDate: requestedDateParsed?.utcDate || null,
            timeSlot: normalizedSlot,
            requestedPriestId: parsedRequestedPriestId,
            location: resolvedLocation,
            remarks: resolvedRemarks,
          },
          include: SCHEDULE_DRAFT_INCLUDE,
        });

        if (hasValidKey) {
          await IdempotencyService.recordKey(
            {
              userId: parsedUserId,
              key: idempotencyKey,
              resourceType: "SCHEDULE_DRAFT_CREATE",
              resourceId: draft.id,
              payloadHash,
            },
            tx
          );
        }

        await AuditLogService.log(
          parsedUserId,
          "Schedule Draft Created",
          tx,
          false,
          {
            affectedTable: "schedule_drafts",
            affectedRecordId: draft.id,
            parishId: draft.parishId,
            metadata: {
              eventType: draft.eventType,
            },
          }
        );

        return draft;
      }, { maxWait: 5000, timeout: 10000 });

      return { draft: formatScheduleDraft(created), isReplay: false };
    } catch (err) {
      if (hasValidKey && IdempotencyService.isUniqueConstraintError(err)) {
        const winningRecord = await IdempotencyService.findRecord(
          parsedUserId,
          idempotencyKey,
          "SCHEDULE_DRAFT_CREATE",
          prisma
        );
        if (winningRecord) {
          assertScheduleDraftNotDeleted(winningRecord);
          if (winningRecord.payloadHash === payloadHash) {
            const winningDraft = await prisma.scheduleDraft.findFirst({
              where: { id: winningRecord.resourceId, userId: parsedUserId },
              include: SCHEDULE_DRAFT_INCLUDE,
            });
            if (winningDraft) {
              return { draft: formatScheduleDraft(winningDraft), isReplay: true };
            }
          } else {
            const conflictErr = new Error(
              "An idempotency key was reused with a different schedule draft payload. Please generate a new key."
            );
            conflictErr.statusCode = 409;
            conflictErr.code = "IDEMPOTENCY_PAYLOAD_MISMATCH";
            throw conflictErr;
          }
        }
      }
      throw err;
    }
  }

  /**
   * Updates an existing owned schedule draft.
   */
  async updateDraft(draftId, userId, draftData = {}) {
    const parsedDraftId = parseInt(draftId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedDraftId) || isNaN(parsedUserId) || parsedDraftId <= 0 || parsedUserId <= 0) {
      const err = new Error("Invalid schedule draft ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      await assertParishionerDraftOwner(parsedUserId, tx);
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT "draft_id" FROM "schedule_drafts" WHERE "draft_id" = ${parsedDraftId} AND "user_id" = ${parsedUserId} FOR UPDATE`;
      }

      const existing = await tx.scheduleDraft.findFirst({
        where: { id: parsedDraftId, userId: parsedUserId },
        include: {
          ...SCHEDULE_DRAFT_INCLUDE,
          attachments: true,
        },
      });
      if (!existing) {
        const err = new Error("Schedule draft not found or does not belong to this user.");
        err.statusCode = 404;
        err.code = "SCHEDULE_DRAFT_NOT_FOUND";
        throw err;
      }

      const nextParishId = draftData.parishId !== undefined ? parseInt(draftData.parishId, 10) : existing.parishId;
      const nextEventType = draftData.eventType !== undefined
        ? validateCanonicalEventType(draftData.eventType)
        : existing.eventType;

      const parish = await tx.parish.findUnique({
        where: { id: nextParishId },
      });
      if (!parish || !parish.isActive) {
        const err = new Error("Selected parish is not available for scheduling.");
        err.statusCode = 400;
        err.code = "PARISH_INACTIVE";
        throw err;
      }
      requireEnabledSchedulingService(parish, nextEventType);

      const nextDisplayTitle = draftData.displayTitle !== undefined
        ? (resolveDisplayTitle(nextEventType, draftData.displayTitle) || nextEventType)
        : (draftData.eventType !== undefined ? (resolveDisplayTitle(nextEventType, null) || nextEventType) : existing.displayTitle);

      const nextPreferredDate = draftData.preferredDate !== undefined
        ? (parseOptionalDraftDate(draftData.preferredDate, "preferredDate")?.utcDate || null)
        : existing.preferredDate;

      const hasRequestedDateUpdate = draftData.requestedDate !== undefined || draftData.date !== undefined;
      const rawNextRequestedDate = draftData.requestedDate !== undefined ? draftData.requestedDate : draftData.date;
      const nextRequestedDate = hasRequestedDateUpdate
        ? (parseOptionalDraftDate(rawNextRequestedDate, "requestedDate")?.utcDate || null)
        : existing.requestedDate;

      const nextTimeSlot = draftData.timeSlot !== undefined
        ? parseOptionalDraftTimeSlot(draftData.timeSlot)
        : existing.timeSlot;

      let nextRequestedPriestId = existing.requestedPriestId;
      if (draftData.requestedPriestId !== undefined) {
        if (draftData.requestedPriestId === null || draftData.requestedPriestId === "") {
          nextRequestedPriestId = null;
        } else {
          try {
            nextRequestedPriestId = normalizePriestId(draftData.requestedPriestId);
          } catch {
            const err = new Error(GENERIC_INVALID_REQUESTED_PRIEST_MESSAGE);
            err.statusCode = 400;
            err.code = "INVALID_REQUESTED_PRIEST";
            throw err;
          }
          await validateRequestedPriestEligibility(nextRequestedPriestId, nextParishId, tx);
        }
      } else if (nextParishId !== existing.parishId && nextRequestedPriestId) {
        try {
          await validateRequestedPriestEligibility(nextRequestedPriestId, nextParishId, tx);
        } catch {
          nextRequestedPriestId = null;
        }
      }

      let nextLocation = existing.location;
      if (nextEventType === "WEDDING") {
        nextLocation = parish.parishName;
      } else if (draftData.location !== undefined) {
        nextLocation = normalizeOptionalDraftLocation(draftData.location);
      } else if (existing.eventType === "WEDDING" && existing.location === existing.parish?.parishName) {
        nextLocation = null;
      }

      const nextRemarks = draftData.remarks !== undefined
        ? normalizeOptionalDraftRemarks(draftData.remarks)
        : existing.remarks;

      const removedReqSet = new Set(
        Array.isArray(draftData.removedRequirementIds)
          ? draftData.removedRequirementIds.map((r) => String(r || "").trim()).filter(Boolean)
          : []
      );

      // If parish or service changed, or caller requested removal of specific requirementIds, remove matching draft attachments
      if (nextParishId !== existing.parishId || nextEventType !== existing.eventType || removedReqSet.size > 0) {
        const validReqIds = new Set(getScheduleRequirements(parish, nextEventType).map((r) => r.id));
        const obsoleteAttachments = (existing.attachments || []).filter(
          (att) => !validReqIds.has(att.requirementId) || removedReqSet.has(att.requirementId)
        );
        if (obsoleteAttachments.length > 0) {
          for (const obsolete of obsoleteAttachments) {
            if (obsolete.r2ObjectKey) {
              await tx.privateObjectCleanupJob.upsert({
                where: { objectKey: obsolete.r2ObjectKey },
                create: { objectKey: obsolete.r2ObjectKey, reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REMOVED" },
                update: {
                  status: "PENDING",
                  reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REMOVED",
                  attemptCount: 0,
                  nextAttemptAt: new Date(),
                  processingToken: null,
                  processingAt: null,
                  leaseExpiresAt: null,
                  completedAt: null,
                  lastErrorCode: null,
                },
              });
            }
          }
          await tx.scheduleDraftAttachment.deleteMany({
            where: { id: { in: obsoleteAttachments.map((a) => a.id) } },
          });
        }
      }

      const updated = await tx.scheduleDraft.update({
        where: { id: parsedDraftId },
        data: {
          parishId: nextParishId,
          eventType: nextEventType,
          displayTitle: nextDisplayTitle,
          preferredDate: nextPreferredDate,
          requestedDate: nextRequestedDate,
          timeSlot: nextTimeSlot,
          requestedPriestId: nextRequestedPriestId,
          location: nextLocation,
          remarks: nextRemarks,
        },
        include: SCHEDULE_DRAFT_INCLUDE,
      });

      await AuditLogService.log(
        parsedUserId,
        "Schedule Draft Updated",
        tx,
        false,
        {
          affectedTable: "schedule_drafts",
          affectedRecordId: updated.id,
          parishId: updated.parishId,
          metadata: {
            eventType: updated.eventType,
          },
        }
      );

      return formatScheduleDraft(updated);
    }, { maxWait: 5000, timeout: 10000 });
  }

  /**
   * Lists all saved schedule drafts owned by the parishioner.
   */
  async listDrafts(userId) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      const err = new Error("Invalid userId.");
      err.statusCode = 400;
      err.code = "INVALID_USER_ID";
      throw err;
    }

    await assertParishionerDraftOwner(parsedUserId);

    const drafts = await prisma.scheduleDraft.findMany({
      where: { userId: parsedUserId },
      include: SCHEDULE_DRAFT_INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return drafts.map(formatScheduleDraft);
  }

  /**
   * Retrieves a single owned schedule draft by ID.
   */
  async getDraftById(draftId, userId) {
    const parsedDraftId = parseInt(draftId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedDraftId) || isNaN(parsedUserId) || parsedDraftId <= 0 || parsedUserId <= 0) {
      const err = new Error("Invalid schedule draft ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    await assertParishionerDraftOwner(parsedUserId);

    const draft = await prisma.scheduleDraft.findFirst({
      where: { id: parsedDraftId, userId: parsedUserId },
      include: SCHEDULE_DRAFT_INCLUDE,
    });

    if (!draft) {
      const err = new Error("Schedule draft not found or does not belong to this user.");
      err.statusCode = 404;
      err.code = "SCHEDULE_DRAFT_NOT_FOUND";
      throw err;
    }

    return formatScheduleDraft(draft);
  }

  /**
   * Discards (deletes) an owned schedule draft and queues cleanup for any uploaded R2 attachments.
   */
  async deleteDraft(draftId, userId) {
    const parsedDraftId = parseInt(draftId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedDraftId) || isNaN(parsedUserId) || parsedDraftId <= 0 || parsedUserId <= 0) {
      const err = new Error("Invalid schedule draft ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      await assertParishionerDraftOwner(parsedUserId, tx);
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT "draft_id" FROM "schedule_drafts" WHERE "draft_id" = ${parsedDraftId} AND "user_id" = ${parsedUserId} FOR UPDATE`;
      }

      const draft = await tx.scheduleDraft.findFirst({
        where: { id: parsedDraftId, userId: parsedUserId },
        include: {
          attachments: { select: { r2ObjectKey: true } },
        },
      });

      if (!draft) {
        const err = new Error("Schedule draft not found or does not belong to this user.");
        err.statusCode = 404;
        err.code = "SCHEDULE_DRAFT_NOT_FOUND";
        throw err;
      }

      const objectKeys = new Set(
        (draft.attachments || []).map((a) => a.r2ObjectKey).filter(Boolean)
      );
      for (const objectKey of objectKeys) {
        await tx.privateObjectCleanupJob.upsert({
          where: { objectKey },
          create: { objectKey, reasonCode: "SCHEDULE_DRAFT_DELETED" },
          update: {
            status: "PENDING",
            reasonCode: "SCHEDULE_DRAFT_DELETED",
            attemptCount: 0,
            nextAttemptAt: new Date(),
            processingToken: null,
            processingAt: null,
            leaseExpiresAt: null,
            completedAt: null,
            lastErrorCode: null,
          },
        });
      }

      await tx.idempotencyKey.updateMany({
        where: {
          userId: parsedUserId,
          resourceType: "SCHEDULE_DRAFT_CREATE",
          resourceId: parsedDraftId,
        },
        data: { resourceId: DELETED_SCHEDULE_DRAFT_RESOURCE_ID },
      });

      await AuditLogService.log(
        parsedUserId,
        "Schedule Draft Deleted",
        tx,
        false,
        {
          affectedTable: "schedule_drafts",
          affectedRecordId: parsedDraftId,
          parishId: draft.parishId,
          metadata: {
            eventType: draft.eventType,
            cleanupObjectCount: objectKeys.size,
          },
        }
      );

      await tx.scheduleDraft.delete({ where: { id: parsedDraftId } });
      return { id: parsedDraftId, deleted: true, cleanupQueued: objectKeys.size > 0 };
    }, { maxWait: 5000, timeout: 10000 });
  }

  /**
   * Uploads or replaces a supporting document attachment on an owned schedule draft.
   */
  async uploadDraftAttachment(draftId, userId, requirementId, file) {
    const parsedDraftId = parseInt(draftId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedDraftId) || isNaN(parsedUserId) || parsedDraftId <= 0 || parsedUserId <= 0) {
      const err = new Error("Invalid schedule draft ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    await assertParishionerDraftOwner(parsedUserId);

    const draft = await prisma.scheduleDraft.findFirst({
      where: { id: parsedDraftId, userId: parsedUserId },
      include: { parish: true },
    });
    if (!draft) {
      const err = new Error("Schedule draft not found or does not belong to this user.");
      err.statusCode = 404;
      err.code = "SCHEDULE_DRAFT_NOT_FOUND";
      throw err;
    }

    const requirements = getScheduleRequirements(draft.parish, draft.eventType);
    const matchedReq = requirements.find((r) => r.id === String(requirementId || "").trim());
    if (!matchedReq) {
      const err = new Error("The selected document requirement does not apply to this service.");
      err.statusCode = 400;
      err.code = "INVALID_SCHEDULE_ATTACHMENTS";
      throw err;
    }

    const prepared = ScheduleAttachmentService.prepareSingle(file, matchedReq.id);
    await ScheduleAttachmentService.stage([prepared], parsedUserId, draft.parishId);

    try {
      return await prisma.$transaction(async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`SELECT "draft_id" FROM "schedule_drafts" WHERE "draft_id" = ${parsedDraftId} AND "user_id" = ${parsedUserId} FOR UPDATE`;
        }
        const lockedDraft = await tx.scheduleDraft.findFirst({
          where: { id: parsedDraftId, userId: parsedUserId },
        });
        if (!lockedDraft) {
          const err = new Error("Schedule draft not found or does not belong to this user.");
          err.statusCode = 404;
          err.code = "SCHEDULE_DRAFT_NOT_FOUND";
          throw err;
        }

        const existingAttachment = await tx.scheduleDraftAttachment.findUnique({
          where: {
            draftId_requirementId: {
              draftId: parsedDraftId,
              requirementId: matchedReq.id,
            },
          },
        });

        if (existingAttachment?.r2ObjectKey && existingAttachment.r2ObjectKey !== prepared.r2ObjectKey) {
          await tx.privateObjectCleanupJob.upsert({
            where: { objectKey: existingAttachment.r2ObjectKey },
            create: { objectKey: existingAttachment.r2ObjectKey, reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REPLACED" },
            update: {
              status: "PENDING",
              reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REPLACED",
              attemptCount: 0,
              nextAttemptAt: new Date(),
              processingToken: null,
              processingAt: null,
              leaseExpiresAt: null,
              completedAt: null,
              lastErrorCode: null,
            },
          });
        }

        await tx.scheduleDraftAttachment.upsert({
          where: {
            draftId_requirementId: {
              draftId: parsedDraftId,
              requirementId: matchedReq.id,
            },
          },
          create: {
            draftId: parsedDraftId,
            requirementId: matchedReq.id,
            requirementLabel: matchedReq.label,
            fileName: prepared.fileName,
            r2ObjectKey: prepared.r2ObjectKey,
            fileType: prepared.fileType,
            fileSize: prepared.fileSize,
          },
          update: {
            requirementLabel: matchedReq.label,
            fileName: prepared.fileName,
            r2ObjectKey: prepared.r2ObjectKey,
            fileType: prepared.fileType,
            fileSize: prepared.fileSize,
            uploadedAt: new Date(),
          },
        });

        const recoveryJobs = await tx.privateObjectCleanupJob.updateMany({
          where: { objectKey: prepared.r2ObjectKey, status: "PENDING" },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        if (recoveryJobs.count !== 1) {
          throw Object.assign(new Error("Upload expired. Please retry uploading the document."), {
            statusCode: 409,
            code: "SCHEDULE_UPLOAD_EXPIRED",
          });
        }

        await tx.scheduleDraft.update({
          where: { id: parsedDraftId },
          data: { updatedAt: new Date() },
        });

        return tx.scheduleDraftAttachment.findMany({
          where: { draftId: parsedDraftId },
          select: {
            id: true,
            requirementId: true,
            requirementLabel: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            uploadedAt: true,
          },
          orderBy: { id: "asc" },
        });
      }, { maxWait: 5000, timeout: 10000 });
    } catch (err) {
      if (prepared.r2ObjectKey) {
        await prisma.privateObjectCleanupJob.updateMany({
          where: { objectKey: prepared.r2ObjectKey, status: "PENDING" },
          data: { reasonCode: "SCHEDULE_ATTACHMENT_ROLLBACK", nextAttemptAt: new Date() },
        }).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Submits a saved schedule draft as an authoritative schedule request.
   * Revalidates all booking constraints inside a Serializable transaction.
   * Keeps the draft saved if validation or availability fails.
   */
  async submitDraft(draftId, userId, payloadOverrides = {}, idempotencyKey = null, uploadedAttachments = null) {
    const parsedDraftId = parseInt(draftId, 10);
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedDraftId) || isNaN(parsedUserId) || parsedDraftId <= 0 || parsedUserId <= 0) {
      const err = new Error("Invalid schedule draft ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const user = await assertParishionerDraftOwner(parsedUserId);
    if (isProfileIncomplete(user)) {
      const err = new Error(
        "Please complete your profile details (full name and contact number) before submitting schedule requests."
      );
      err.statusCode = 403;
      err.code = "PROFILE_INCOMPLETE";
      throw err;
    }
    if (!isEffectivelyVerified(user.governmentIdVerification)) {
      const err = new Error("Please verify your Government ID before submitting schedule requests.");
      err.statusCode = 403;
      err.code = "IDENTITY_NOT_VERIFIED";
      throw err;
    }

    const resourceType = "SCHEDULE_DRAFT_SUBMIT";
    const hasValidKey = IdempotencyService.isValidKey(idempotencyKey);
    if (hasValidKey) {
      const existingKey = await IdempotencyService.findRecord(parsedUserId, idempotencyKey, resourceType, prisma);
      if (existingKey) {
        const existingSchedule = await prisma.schedule.findUnique({
          where: { id: existingKey.resourceId },
          include: {
            user: { select: { id: true, fullName: true, email: true, contactNumber: true, emailNotificationsEnabled: true } },
            parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
            requestedPriest: { select: { id: true, fullName: true } },
          },
        });
        if (existingSchedule) {
          return { schedule: sanitizeSchedulePriest(existingSchedule), isReplay: true };
        }
      }
    }

    // If caller passed field overrides when submitting, persist them to the draft first
    // so the draft keeps the latest user input even if slot/document validation fails.
    const hasOverrides = payloadOverrides && Object.keys(payloadOverrides).some((k) => payloadOverrides[k] !== undefined);
    let draft;
    if (hasOverrides) {
      await this.updateDraft(parsedDraftId, parsedUserId, payloadOverrides);
    }
    draft = await prisma.scheduleDraft.findFirst({
      where: { id: parsedDraftId, userId: parsedUserId },
      include: {
        parish: true,
        attachments: { orderBy: { id: "asc" } },
      },
    });

    if (!draft) {
      const err = new Error("Schedule draft not found or has already been submitted.");
      err.statusCode = 404;
      err.code = "SCHEDULE_DRAFT_NOT_FOUND";
      throw err;
    }

    const effectiveParishId = draft.parishId;
    const canonicalEventType = validateCanonicalEventType(draft.eventType);
    const effectiveDisplayTitle = resolveDisplayTitle(canonicalEventType, draft.displayTitle) || canonicalEventType;
    const effectiveDateStr = draft.requestedDate ? getManilaDateString(new Date(draft.requestedDate)) : "";
    const effectiveTimeSlot = draft.timeSlot ? String(draft.timeSlot).trim() : "";

    if (!effectiveDateStr) {
      const err = new Error("Please select a booking date before submitting your schedule request.");
      err.statusCode = 400;
      err.code = "MISSING_BOOKING_DATE";
      throw err;
    }
    if (!effectiveTimeSlot) {
      const err = new Error("Please select an available time slot before submitting your schedule request.");
      err.statusCode = 400;
      err.code = "MISSING_TIME_SLOT";
      throw err;
    }

    const now = new Date();
    const horizon = validateDateHorizon(effectiveDateStr, effectiveTimeSlot, now);

    let parsedRequestedPriestId = null;
    if (draft.requestedPriestId !== undefined && draft.requestedPriestId !== null) {
      parsedRequestedPriestId = normalizePriestId(draft.requestedPriestId);
      await validateRequestedPriestEligibility(parsedRequestedPriestId, effectiveParishId, prisma);
    }

    requireEnabledSchedulingService(draft.parish, canonicalEventType);

    // Combine persisted draft attachments with any newly uploaded files from this submit call
    const newUploadsList = Array.isArray(uploadedAttachments) ? uploadedAttachments : [];
    const mergedByRequirementId = new Map();
    for (const existingAtt of draft.attachments || []) {
      mergedByRequirementId.set(existingAtt.requirementId, {
        requirementId: existingAtt.requirementId,
        requirementLabel: existingAtt.requirementLabel,
        fileName: existingAtt.fileName,
        fileType: existingAtt.fileType,
        fileSize: existingAtt.fileSize,
        r2ObjectKey: existingAtt.r2ObjectKey,
        isFromDraft: true,
      });
    }
    for (const newUpload of newUploadsList) {
      mergedByRequirementId.set(newUpload.requirementId, {
        ...newUpload,
        isFromDraft: false,
      });
    }

    const combinedAttachments = Array.from(mergedByRequirementId.values()).sort((a, b) =>
      a.requirementId.localeCompare(b.requirementId)
    );

    validateScheduleRequirements(draft.parish, canonicalEventType, combinedAttachments);

    if (newUploadsList.length > 0) {
      await ScheduleAttachmentService.stage(newUploadsList, parsedUserId, effectiveParishId);
      for (const staged of newUploadsList) {
        const merged = mergedByRequirementId.get(staged.requirementId);
        if (merged) {
          merged.r2ObjectKey = staged.r2ObjectKey;
        }
      }
    }

    const cleanRemarks = draft.remarks ? draft.remarks.trim() : "";
    const fullRemarks = [
      `Time Slot: ${effectiveTimeSlot}. [Estimated End Time]`,
      cleanRemarks ? `Notes: ${cleanRemarks}` : "Notes: Parishioner Portal Request",
    ]
      .filter(Boolean)
      .join(" ");

    const scheduleDateUtc = new Date(
      Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
    );
    const startDatetime = parseManilaDateTime(horizon.dateStr, effectiveTimeSlot);
    const endDatetime = startDatetime ? new Date(startDatetime.getTime() + 60 * 60 * 1000) : null;

    const canonicalPayload = {
      parishId: effectiveParishId,
      eventType: canonicalEventType,
      requestedDate: horizon.dateStr,
      timeSlot: effectiveTimeSlot,
      ...(typeof draft.location === "string" && draft.location.trim() ? { location: draft.location.trim() } : {}),
      remarks: cleanRemarks || "Parishioner Portal Request",
      requestedPriestId: parsedRequestedPriestId,
    };
    const payloadHash = computeSchedulePayloadHash(canonicalPayload);

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          if (typeof tx.$queryRaw === "function") {
            await tx.$queryRaw`SELECT "draft_id" FROM "schedule_drafts" WHERE "draft_id" = ${parsedDraftId} AND "user_id" = ${parsedUserId} FOR UPDATE`;
          }
          const lockedDraft = await tx.scheduleDraft.findFirst({
            where: { id: parsedDraftId, userId: parsedUserId },
            include: { attachments: true },
          });
          if (!lockedDraft) {
            const err = new Error("This schedule draft has already been submitted.");
            err.statusCode = 409;
            err.code = "DRAFT_ALREADY_SUBMITTED";
            throw err;
          }

          await lockParishSchedulingConfiguration(tx, effectiveParishId);
          const parish = await tx.parish.findUnique({
            where: { id: effectiveParishId },
            include: {
              availabilities: {
                where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } },
              },
            },
          });
          const schedulingConfig = requireEnabledSchedulingService(parish, canonicalEventType);
          const requirements = validateScheduleRequirements(parish, canonicalEventType, combinedAttachments);

          validateParishAndOffice(parish, horizon.dayName, effectiveTimeSlot);
          validateParishAvailability(parish.availabilities, horizon.dateStr);
          const schedulingRules = await loadSchedulingRules(tx, effectiveParishId, horizon.dateStr);
          evaluateSchedulingRules({
            eventType: canonicalEventType,
            dateInput: horizon.dateStr,
            ...schedulingRules,
          });

          const dateStartUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0)
          );
          const dateEndUtc = new Date(
            Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 23, 59, 59, 999)
          );

          const activeBookings = await tx.schedule.findMany({
            where: {
              parishId: effectiveParishId,
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
            effectiveTimeSlot,
            schedulingConfig.dailyCapacity,
            schedulingConfig.slotCapacity
          );

          const resolvedLocation = canonicalEventType === "WEDDING"
            ? parish.parishName
            : (typeof draft.location === "string" && draft.location.trim() ? draft.location.trim().slice(0, 150) : null);

          const transferredKeys = new Set(combinedAttachments.map((a) => a.r2ObjectKey));
          for (const oldAtt of lockedDraft.attachments || []) {
            if (oldAtt.r2ObjectKey && !transferredKeys.has(oldAtt.r2ObjectKey)) {
              await tx.privateObjectCleanupJob.upsert({
                where: { objectKey: oldAtt.r2ObjectKey },
                create: { objectKey: oldAtt.r2ObjectKey, reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REPLACED" },
                update: {
                  status: "PENDING",
                  reasonCode: "SCHEDULE_DRAFT_ATTACHMENT_REPLACED",
                  attemptCount: 0,
                  nextAttemptAt: new Date(),
                  processingToken: null,
                  processingAt: null,
                  leaseExpiresAt: null,
                  completedAt: null,
                  lastErrorCode: null,
                },
              });
            }
          }

          await tx.scheduleDraft.delete({ where: { id: parsedDraftId } });
          await tx.idempotencyKey.updateMany({
            where: {
              userId: parsedUserId,
              resourceType: "SCHEDULE_DRAFT_CREATE",
              resourceId: parsedDraftId,
            },
            data: { resourceId: DELETED_SCHEDULE_DRAFT_RESOURCE_ID },
          });

          const created = await tx.schedule.create({
            data: {
              userId: parsedUserId,
              parishId: effectiveParishId,
              eventType: canonicalEventType,
              displayTitle: effectiveDisplayTitle,
              requestedDate: scheduleDateUtc,
              startDatetime,
              endDatetime,
              location: resolvedLocation,
              status: "PENDING",
              conflictFlag: false,
              remarks: fullRemarks,
              requestedPriestId: parsedRequestedPriestId,
              ...(combinedAttachments.length
                ? {
                    attachments: {
                      create: combinedAttachments.map((attachment) => ({
                        requirementId: attachment.requirementId,
                        requirementLabel:
                          requirements.find((r) => r.id === attachment.requirementId)?.label ||
                          attachment.requirementLabel ||
                          attachment.requirementId,
                        fileName: attachment.fileName,
                        fileType: attachment.fileType,
                        fileSize: attachment.fileSize,
                        r2ObjectKey: attachment.r2ObjectKey,
                      })),
                    },
                  }
                : {}),
            },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
              requestedPriest: { select: { id: true, fullName: true } },
            },
          });

          if (newUploadsList.length > 0) {
            const recoveryJobs = await tx.privateObjectCleanupJob.updateMany({
              where: { objectKey: { in: newUploadsList.map((a) => a.r2ObjectKey) }, status: "PENDING" },
              data: { status: "CANCELLED", completedAt: new Date() },
            });
            if (recoveryJobs.count !== newUploadsList.length) {
              throw Object.assign(new Error("Upload expired. Please retry your booking."), {
                statusCode: 409,
                code: "SCHEDULE_UPLOAD_EXPIRED",
              });
            }
          }

          if (hasValidKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                userId: parsedUserId,
                resourceType,
                resourceId: created.id,
                payloadHash,
              },
            });
          }

          await NotificationDispatcher.notifyScheduleChange(
            {
              parishionerId: created.userId,
              parishId: created.parishId,
              scheduleId: created.id,
              displayTitle: created.displayTitle || canonicalEventType,
              oldStatus: null,
              newStatus: created.status,
              proposalVersion: created.proposalVersion,
              transitionVersion: "submitted",
              notifyAdmins: true,
            },
            tx
          );

          return created;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return { schedule: sanitizeSchedulePriest(result), isReplay: false };
    } catch (err) {
      if (newUploadsList.length > 0) {
        const stagedKeys = newUploadsList.map((a) => a.r2ObjectKey).filter(Boolean);
        if (stagedKeys.length > 0) {
          await prisma.privateObjectCleanupJob.updateMany({
            where: { objectKey: { in: stagedKeys }, status: "PENDING" },
            data: { reasonCode: "SCHEDULE_ATTACHMENT_ROLLBACK", nextAttemptAt: new Date() },
          }).catch(() => {});
        }
      }

      const isSerializationConflict =
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize");

      if (hasValidKey && (IdempotencyService.isUniqueConstraintError(err) || isSerializationConflict)) {
        const raceWinner = await IdempotencyService.findRecord(parsedUserId, idempotencyKey, resourceType, prisma);
        if (raceWinner) {
          const winnerSchedule = await prisma.schedule.findUnique({
            where: { id: raceWinner.resourceId },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true, emailNotificationsEnabled: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
              requestedPriest: { select: { id: true, fullName: true } },
            },
          });
          if (winnerSchedule) {
            return { schedule: sanitizeSchedulePriest(winnerSchedule), isReplay: true };
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
   * Parishioner requests a different assigned priest, resetting the current
   * assignment and returning the request to PENDING for secretary reassignment.
   */
  async requestPriestChange(id, { replacementPriestId, note, expectedVersion }, actorId, actorRole) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid schedule ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    if (actorRole !== "PARISHIONER") {
      const err = new Error("Only the owning parishioner can request a priest change.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    let parsedReplacementId;
    try {
      parsedReplacementId = normalizePriestId(replacementPriestId);
    } catch {
      const err = new Error("Please select a valid replacement priest.");
      err.statusCode = 400;
      err.code = "INVALID_REQUESTED_PRIEST";
      throw err;
    }

    const version = requireExpectedVersion(expectedVersion, "request a priest change");
    const trimmedNote = typeof note === "string" && note.trim().length > 0 ? note.trim() : null;

    const schedule = await prisma.schedule.findUnique({ where: { id: parsedId } });
    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      err.code = "SCHEDULE_NOT_FOUND";
      throw err;
    }
    if (Number(schedule.userId) !== Number(actorId)) {
      const err = new Error("You do not have permission to modify this schedule request.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    if (schedule.version !== version) {
      throwScheduleConcurrencyConflict();
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const priestsToLock = [schedule.assignedPriestId, parsedReplacementId].filter(
            (pId) => pId !== null && pId !== undefined
          );
          await lockPriestsForScheduling(tx, priestsToLock);

          const current = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true } },
              parish: { select: { id: true, parishName: true } },
              assignedPriest: { select: { id: true, fullName: true } },
            },
          });

          if (!current) {
            const err = new Error("Schedule request not found.");
            err.statusCode = 404;
            err.code = "SCHEDULE_NOT_FOUND";
            throw err;
          }
          if (Number(current.userId) !== Number(actorId)) {
            const err = new Error("You do not have permission to modify this schedule request.");
            err.statusCode = 403;
            err.code = "FORBIDDEN";
            throw err;
          }
          assertScheduleMutable(current);
          validateScheduleTransition(current, ScheduleStatus.PENDING, {
            allowReversionToPending: true,
          });
          if (!current.assignedPriestId || current.layMinisterAssigned) {
            const err = new Error("A priest must currently be assigned before requesting a change.");
            err.statusCode = 400;
            err.code = "NO_ASSIGNED_PRIEST";
            throw err;
          }
          if (current.version !== version) {
            throwScheduleConcurrencyConflict();
          }
          if (Number(parsedReplacementId) === Number(current.assignedPriestId)) {
            const err = new Error("Please choose a different priest from the one currently assigned.");
            err.statusCode = 400;
            err.code = "SAME_PRIEST_SELECTED";
            throw err;
          }

          const replacementPriest = await validateRequestedPriestEligibility(
            parsedReplacementId,
            current.parishId,
            tx
          );

          const now = new Date();
          const historyReason = trimmedNote
            ? `Parishioner requested priest change to ${replacementPriest.name || "another priest"}: ${trimmedNote}`
            : `Parishioner requested priest change to ${replacementPriest.name || "another priest"}`;

          await appendScheduleHistory(tx, current, {
            reason: historyReason,
            actorId,
            actorRole: "PARISHIONER",
          });

          await updateScheduleAtVersion(tx, parsedId, version, {
            assignedPriestId: null,
            priestResponseStatus: null,
            priestResponseReason: null,
            priestVerbalApproval: false,
            priestVerbalApprovalById: null,
            priestVerbalApprovalAt: null,
            priestChangeStatus: "PENDING",
            priestChangeRequestedPriestId: parsedReplacementId,
            priestChangeNote: trimmedNote,
            priestChangeRequestedAt: now,
            priestChangeResolvedAt: null,
            status: ScheduleStatus.PENDING,
          });

          const updated = await tx.schedule.findUnique({
            where: { id: parsedId },
            include: {
              user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
              parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
              processedBy: {
                select: {
                  id: true,
                  fullName: true,
                  contactNumber: true,
                  status: true,
                  parishId: true,
                  role: { select: { roleName: true } },
                },
              },
              assignedPriest: { select: { id: true, fullName: true } },
              requestedPriest: { select: { id: true, fullName: true } },
              priestChangeRequestedPriest: { select: { id: true, fullName: true } },
              priestVerbalApprovalBy: { select: { id: true, fullName: true } },
              ...ALTERNATIVE_PROPOSAL_INCLUDE,
            },
          });

          await AuditLogService.log(actorId, "Priest Change Requested", tx, false, {
            role: "PARISHIONER",
            affectedTable: "schedules",
            affectedRecordId: parsedId,
            parishId: current.parishId,
            previousValues: {
              status: current.status,
              assignedPriestId: current.assignedPriestId,
              priestResponseStatus: current.priestResponseStatus,
              priestVerbalApproval: Boolean(current.priestVerbalApproval),
            },
            newValues: {
              status: updated.status,
              assignedPriestId: null,
              priestResponseStatus: null,
              priestVerbalApproval: false,
              priestChangeStatus: "PENDING",
              priestChangeRequestedPriestId: parsedReplacementId,
            },
            metadata: {
              previousPriestId: current.assignedPriestId,
              previousPriestName: current.assignedPriest?.fullName || null,
              replacementPriestId: parsedReplacementId,
              replacementPriestName: replacementPriest.name || null,
              note: trimmedNote,
            },
          });

          await NotificationDispatcher.notifyPriestChangeRequested(
            {
              parishId: updated.parishId,
              scheduleId: updated.id,
              displayTitle: resolveScheduleDisplayTitle(updated),
              requestedPriestName: replacementPriest.name || "another priest",
              previousPriestName: current.assignedPriest?.fullName || null,
              note: trimmedNote,
            },
            tx
          );

          const [enriched] = await attachParishSecretaries([updated], tx);
          return sanitizeSchedulePriest(enriched);
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        throwScheduleConcurrencyConflict();
      }
      throw err;
    }
  }

}

const DELETED_SCHEDULE_DRAFT_RESOURCE_ID = -1;

const SCHEDULE_DRAFT_INCLUDE = {
  parish: {
    select: {
      id: true,
      parishName: true,
      type: true,
      municipalityCity: true,
      isActive: true,
      eventSettings: true,
      officeHours: true,
    },
  },
  requestedPriest: {
    select: {
      id: true,
      fullName: true,
    },
  },
  attachments: {
    select: {
      id: true,
      requirementId: true,
      requirementLabel: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      uploadedAt: true,
    },
    orderBy: { id: "asc" },
  },
};

async function assertParishionerDraftOwner(userId, client = prisma) {
  const user = await client.user.findUnique({
    where: { id: Number(userId) },
    include: { role: true, governmentIdVerification: true },
  });
  const isParishioner = Boolean(
    user &&
      (!user.status || user.status === "ACTIVE") &&
      (user.role?.roleName === "PARISHIONER" ||
        (!user.role && (!user.roleId || user.roleId === 1)))
  );
  if (!isParishioner) {
    const err = new Error("Only authenticated parishioners can manage schedule drafts.");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
  return user;
}

function assertScheduleDraftNotDeleted(record) {
  if (Number(record?.resourceId) === DELETED_SCHEDULE_DRAFT_RESOURCE_ID) {
    const err = new Error("This schedule draft was already discarded. Start a new schedule draft to continue.");
    err.statusCode = 409;
    err.code = "DRAFT_ALREADY_DELETED";
    throw err;
  }
}

function parseOptionalDraftDate(rawDate, fieldName = "date") {
  if (rawDate === null || rawDate === undefined || String(rawDate).trim() === "") {
    return null;
  }
  const cleanStr = String(rawDate).trim().split("T")[0];
  const parsed = parseManilaDateOnly(cleanStr);
  if (!parsed || !parsed.year || !parsed.month || !parsed.day) {
    const err = new Error(`Invalid ${fieldName} format. Expected YYYY-MM-DD.`);
    err.statusCode = 400;
    err.code = "INVALID_DATE";
    throw err;
  }
  const dateStr = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  return {
    dateStr,
    utcDate: new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0)),
  };
}

function parseOptionalDraftTimeSlot(rawSlot) {
  if (rawSlot === null || rawSlot === undefined || String(rawSlot).trim() === "") {
    return null;
  }
  const normalized = normalizeTimeSlotString(String(rawSlot).trim());
  if (!normalized) {
    const err = new Error("Time slot must be in HH:MM AM/PM format (e.g., 09:00 AM).");
    err.statusCode = 400;
    err.code = "INVALID_TIME_SLOT";
    throw err;
  }
  return normalized;
}

function normalizeOptionalDraftLocation(rawLocation) {
  if (rawLocation === null || rawLocation === undefined) return null;
  const trimmed = String(rawLocation).trim();
  return trimmed ? trimmed.slice(0, 150) : null;
}

function normalizeOptionalDraftRemarks(rawRemarks) {
  if (rawRemarks === null || rawRemarks === undefined) return null;
  let cleaned = String(rawRemarks)
    .replace(/^Time Slot:\s*[^.]+\.\s*(?:\[Estimated End Time\])?\s*/i, "")
    .replace(/^Notes:\s*/i, "")
    .trim();
  if (!cleaned || cleaned === "Parishioner Portal Request") {
    return null;
  }
  return cleaned.slice(0, 1000);
}

function computeScheduleDraftPayloadHash(payload) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        parishId: Number(payload.parishId),
        eventType: String(payload.eventType || ""),
        displayTitle: payload.displayTitle || null,
        preferredDate: payload.preferredDate || null,
        requestedDate: payload.requestedDate || null,
        timeSlot: payload.timeSlot || null,
        requestedPriestId: payload.requestedPriestId ? Number(payload.requestedPriestId) : null,
        location: payload.location || null,
        remarks: payload.remarks || null,
      })
    )
    .digest("hex");
}

export function formatScheduleDraft(draft) {
  if (!draft) return null;
  const parishName = draft.parish?.parishName || null;
  const effectiveLocation = draft.eventType === "WEDDING"
    ? (parishName || draft.location || null)
    : (draft.location || null);
  const effectiveDisplayTitle =
    resolveDisplayTitle(draft.eventType, draft.displayTitle) || draft.displayTitle || draft.eventType;
  const requirements = draft.parish ? getScheduleRequirements(draft.parish, draft.eventType) : [];
  const preferredDateStr = draft.preferredDate ? getManilaDateString(new Date(draft.preferredDate)) : null;
  const requestedDateStr = draft.requestedDate ? getManilaDateString(new Date(draft.requestedDate)) : null;

  return {
    id: draft.id,
    userId: draft.userId,
    parishId: draft.parishId,
    parishName,
    parish: draft.parish
      ? {
          id: draft.parish.id,
          parishName: draft.parish.parishName,
          type: draft.parish.type,
          municipalityCity: draft.parish.municipalityCity,
        }
      : undefined,
    eventType: draft.eventType,
    displayTitle: draft.displayTitle || effectiveDisplayTitle,
    effectiveDisplayTitle,
    preferredDate: preferredDateStr,
    requestedDate: requestedDateStr,
    date: requestedDateStr,
    timeSlot: draft.timeSlot || null,
    requestedPriestId: draft.requestedPriestId || null,
    requestedPriest: draft.requestedPriest
      ? {
          id: draft.requestedPriest.id,
          name: draft.requestedPriest.fullName ?? draft.requestedPriest.name ?? null,
          fullName: draft.requestedPriest.fullName ?? draft.requestedPriest.name ?? null,
        }
      : null,
    location: effectiveLocation,
    remarks: draft.remarks || null,
    isDraft: true,
    status: "DRAFT",
    attachments: Array.isArray(draft.attachments)
      ? draft.attachments.map((att) => ({
          id: att.id,
          requirementId: att.requirementId,
          requirementLabel: att.requirementLabel,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          uploadedAt: att.uploadedAt,
        }))
      : [],
    requirements,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}
