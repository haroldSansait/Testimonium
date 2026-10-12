import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import {
  computeOperationalEndDatetime,
  formatManilaTimeSlot,
  getManilaDateString,
  parseManilaDateTime,
} from "./ConflictHelper.js";
import {
  PARISH_BOOKING_BLOCK_TYPES,
  validateDateHorizon,
  validateParishAndOffice,
  validateParishAvailability,
  validateSlotAndCapacity,
} from "./BookingValidator.js";
import { requireEnabledSchedulingService } from "./SchedulingConfiguration.js";
import {
  evaluateSchedulingRules,
  loadSchedulingRules,
  lockParishSchedulingConfiguration,
  lockPriestsForScheduling,
  normalizePriestId,
} from "./SchedulingAvailability.js";
import {
  classifyPriestAvailability,
  PriestAvailabilityClassification,
  validateRequestedPriestEligibility,
} from "./ScheduleAvailabilityDomainService.js";
import {
  appendScheduleHistory,
  throwScheduleConcurrencyConflict,
  updateScheduleAtVersion,
} from "./ScheduleService.js";
import { assertScheduleMutable } from "./ScheduleStateMachine.js";
import {
  isLayMinisterEligibleEvent,
  resolveScheduleDisplayTitle,
} from "../shared/LayMinisterPresentation.js";
import { isAlternativeProposalStale } from "../shared/ScheduleAlternativeProposalPolicy.js";

const OPEN_STATUSES = ["SUBMITTED", "PRIEST_PENDING"];

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${label}.`);
    error.statusCode = 400;
    error.code = "INVALID_ID";
    throw error;
  }
  return parsed;
}

function domainError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function authorizeSchedule(schedule, actorId, actorRole, actorParishId, { allowPriest = false } = {}) {
  if (actorRole === "PARISHIONER") {
    if (schedule.userId !== Number(actorId)) {
      throw domainError("You do not have permission to access this proposal.", 403, "FORBIDDEN");
    }
    return;
  }
  if (actorRole === "DIOCESE_COORDINATOR") return;
  if (!["SECRETARY", ...(allowPriest ? ["PRIEST"] : [])].includes(actorRole)) {
    throw domainError("You do not have permission to manage this proposal.", 403, "FORBIDDEN");
  }
  if (!actorParishId || Number(actorParishId) !== Number(schedule.parishId)) {
    throw domainError("You do not have permission to manage proposals from another parish.", 403, "FORBIDDEN");
  }
}

async function supersedeProposal(tx, proposal, resolvedById = null) {
  const updated = await tx.scheduleAlternativeProposal.update({
    where: { id: proposal.id },
    data: {
      status: "SUPERSEDED",
      resolvedById: resolvedById ? Number(resolvedById) : null,
      resolvedAt: new Date(),
      nominatedPriestId: null,
      priestResponseStatus: null,
      nominationRevision: { increment: 1 },
    },
  });
  await AuditLogService.log(
    resolvedById,
    "Alternative Date Proposal Superseded",
    tx,
    !resolvedById,
    {
      affectedTable: "schedule_alternative_proposals",
      affectedRecordId: proposal.id,
      previousValues: { status: proposal.status, nominationRevision: proposal.nominationRevision },
      newValues: { status: "SUPERSEDED", nominationRevision: proposal.nominationRevision + 1 },
    }
  );
  return updated;
}

async function loadSchedule(tx, scheduleId) {
  return tx.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      parish: {
        include: {
          availabilities: { where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } } },
        },
      },
      user: { select: { id: true, fullName: true } },
    },
  });
}

async function validateCandidateSlot(tx, schedule, proposedDate, timeSlot, {
  requiredPriestId = null,
  requireAnyPriest = false,
  actorId = null,
} = {}) {
  const horizon = validateDateHorizon(proposedDate, timeSlot, new Date());
  const start = parseManilaDateTime(horizon.dateStr, timeSlot);
  if (!start) throw domainError("The proposed time slot is invalid.", 400, "INVALID_SLOT");
  const end = computeOperationalEndDatetime(start);
  if (!end || end <= start) {
    throw domainError("The proposed interval cannot be resolved.", 422, "SCHEDULE_INTERVAL_UNRESOLVED");
  }

  const schedulingConfig = requireEnabledSchedulingService(schedule.parish, schedule.eventType);
  validateParishAndOffice(schedule.parish, horizon.dayName, timeSlot);
  validateParishAvailability(schedule.parish.availabilities, horizon.dateStr);
  const schedulingRules = await loadSchedulingRules(tx, schedule.parishId, horizon.dateStr);
  evaluateSchedulingRules({ eventType: schedule.eventType, dateInput: horizon.dateStr, ...schedulingRules });

  const dateStartUtc = new Date(Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 0, 0, 0));
  const dateEndUtc = new Date(Date.UTC(horizon.parsed.year, horizon.parsed.month - 1, horizon.parsed.day, 23, 59, 59, 999));
  const activeBookings = await tx.schedule.findMany({
    where: {
      parishId: schedule.parishId,
      id: { not: schedule.id },
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

  const priests = await tx.user.findMany({
    where: {
      parishId: schedule.parishId,
      role: { roleName: "PRIEST" },
      status: "ACTIVE",
      ...(requiredPriestId ? { id: requiredPriestId } : {}),
    },
    select: { id: true, fullName: true },
    orderBy: { id: "asc" },
  });
  if (requiredPriestId && priests.length !== 1) {
    throw domainError("The nominated priest is no longer eligible.", 409, "NOMINATED_PRIEST_INELIGIBLE");
  }
  const classifications = [];
  for (const priest of priests) {
    classifications.push({
      priest,
      classification: await classifyPriestAvailability({
        priestId: priest.id,
        date: horizon.dateStr,
        startDatetime: start,
        endDatetime: end,
        excludeScheduleId: schedule.id,
        timeSlot,
        actorId,
        tx,
      }),
    });
  }
  if (requiredPriestId && classifications[0]?.classification !== PriestAvailabilityClassification.AVAILABLE) {
    throw domainError("The nominated priest is no longer available for the proposed slot.", 409, "NOMINATED_PRIEST_UNAVAILABLE");
  }
  if (requireAnyPriest && !classifications.some((item) => item.classification === PriestAvailabilityClassification.AVAILABLE)) {
    throw domainError("No eligible priest is confirmed available for the proposed slot.", 409, "NO_PRIEST_AVAILABLE_FOR_PROPOSED_SLOT");
  }
  return { horizon, start, end };
}

async function inSerializable(work) {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 15000,
    });
  } catch (error) {
    if (
      error?.code === "P2034"
      || error?.message?.includes("Serialization")
      || error?.message?.includes("could not serialize")
    ) {
      throwScheduleConcurrencyConflict();
    }
    throw error;
  }
}

export class ScheduleAlternativeProposalService {
  async list(scheduleId, { actorId, actorRole, actorParishId }) {
    const parsedScheduleId = positiveId(scheduleId, "schedule ID");
    return inSerializable(async (tx) => {
      const schedule = await loadSchedule(tx, parsedScheduleId);
      if (!schedule) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
      authorizeSchedule(schedule, actorId, actorRole, actorParishId, { allowPriest: true });
      const proposals = await tx.scheduleAlternativeProposal.findMany({
        where: { scheduleId: parsedScheduleId },
        include: { nominatedPriest: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
      for (const proposal of proposals) {
        if (OPEN_STATUSES.includes(proposal.status) && isAlternativeProposalStale(schedule, proposal)) {
          const superseded = await supersedeProposal(tx, proposal);
          Object.assign(proposal, superseded);
          await NotificationDispatcher.notifyAlternativeProposal({
            event: "SUPERSEDED",
            parishionerId: schedule.userId,
            parishId: schedule.parishId,
            scheduleId: schedule.id,
            displayTitle: resolveScheduleDisplayTitle(schedule),
          }, tx);
        }
      }
      return proposals;
    });
  }

  async submit(scheduleId, { proposedDate, timeSlot, note, actorId, actorRole }) {
    const parsedScheduleId = positiveId(scheduleId, "schedule ID");
    if (actorRole !== "PARISHIONER") {
      throw domainError("Only the owning parishioner may submit an alternative-date proposal.", 403, "FORBIDDEN");
    }
    const trimmedNote = typeof note === "string" ? note.trim() : "";
    try {
      return await inSerializable(async (tx) => {
        const initial = await tx.schedule.findUnique({ where: { id: parsedScheduleId } });
        if (!initial) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
        await lockParishSchedulingConfiguration(tx, initial.parishId);
        const priests = await tx.user.findMany({
          where: { parishId: initial.parishId, role: { roleName: "PRIEST" }, status: "ACTIVE" },
          select: { id: true },
          orderBy: { id: "asc" },
        });
        await lockPriestsForScheduling(tx, priests.map((priest) => priest.id));
        const schedule = await loadSchedule(tx, parsedScheduleId);
        if (!schedule || schedule.userId !== Number(actorId)) {
          throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
        }
        assertScheduleMutable(schedule);
        if (!["PENDING", "REQUESTED", "CONFIRMED"].includes(schedule.status)) {
          throw domainError("Alternative dates are not available in the appointment's current state.", 409, "ALTERNATIVE_PROPOSAL_STATUS_INELIGIBLE");
        }
        if (!schedule.layMinisterAssigned || !isLayMinisterEligibleEvent(schedule.eventType)) {
          throw domainError("Alternative dates are available only for Lay-Minister-assigned Funeral or Blessing appointments.", 422, "ALTERNATIVE_PROPOSAL_NOT_ELIGIBLE");
        }
        if (["PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"].includes(schedule.status) || schedule.proposedDate) {
          throw domainError("A staff reschedule proposal is already pending.", 409, "INCOMPATIBLE_RESCHEDULE_PENDING");
        }
        const originalStart = schedule.startDatetime ? new Date(schedule.startDatetime) : null;
        if (!originalStart || Number.isNaN(originalStart.getTime()) || Date.now() >= originalStart.getTime()) {
          throw domainError("The original appointment has already started or its interval cannot be verified.", 409, "SCHEDULE_ALREADY_STARTED");
        }
        const existing = await tx.scheduleAlternativeProposal.findFirst({
          where: { scheduleId: parsedScheduleId, status: { in: OPEN_STATUSES } },
        });
        if (existing) {
          throw domainError("An alternative-date proposal is already open for this appointment.", 409, "ALTERNATIVE_PROPOSAL_ALREADY_OPEN");
        }
        const slot = await validateCandidateSlot(tx, schedule, proposedDate, timeSlot, {
          requireAnyPriest: true,
          actorId,
        });
        if (
          slot.horizon.dateStr === getManilaDateString(schedule.requestedDate)
          && formatManilaTimeSlot(slot.start) === formatManilaTimeSlot(schedule.startDatetime)
        ) {
          throw domainError("The proposed date and time must differ from the original appointment.", 400, "ALTERNATIVE_PROPOSAL_UNCHANGED");
        }
        const proposal = await tx.scheduleAlternativeProposal.create({
          data: {
            scheduleId: schedule.id,
            createdById: Number(actorId),
            proposedDate: new Date(Date.UTC(slot.horizon.parsed.year, slot.horizon.parsed.month - 1, slot.horizon.parsed.day)),
            proposedStartDatetime: slot.start,
            proposedEndDatetime: slot.end,
            note: trimmedNote || null,
            baseScheduleVersion: schedule.version,
            baseRequestedDate: schedule.requestedDate,
            baseStartDatetime: schedule.startDatetime,
          },
          include: { nominatedPriest: { select: { id: true, fullName: true } } },
        });
        await AuditLogService.log(actorId, "Alternative Date Proposal Submitted", tx, false, {
          affectedTable: "schedule_alternative_proposals",
          affectedRecordId: proposal.id,
          parishId: schedule.parishId,
          newValues: { scheduleId: schedule.id, status: proposal.status, proposedDate: slot.horizon.dateStr, timeSlot },
        });
        await NotificationDispatcher.notifyAlternativeProposal({
          event: "SUBMITTED",
          parishionerId: schedule.userId,
          parishId: schedule.parishId,
          scheduleId: schedule.id,
          displayTitle: resolveScheduleDisplayTitle(schedule),
          date: slot.horizon.dateStr,
          timeSlot,
        }, tx);
        return proposal;
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw domainError("An alternative-date proposal is already open for this appointment.", 409, "ALTERNATIVE_PROPOSAL_ALREADY_OPEN");
      }
      throw error;
    }
  }

  async withdraw(scheduleId, proposalId, { actorId, actorRole, expectedRevision }) {
    if (actorRole !== "PARISHIONER") {
      throw domainError("Only the owning parishioner may withdraw this proposal.", 403, "FORBIDDEN");
    }
    const sid = positiveId(scheduleId, "schedule ID");
    const pid = positiveId(proposalId, "proposal ID");
    return inSerializable(async (tx) => {
      const schedule = await loadSchedule(tx, sid);
      if (!schedule || schedule.userId !== Number(actorId)) {
        throw domainError("Proposal not found.", 404, "ALTERNATIVE_PROPOSAL_NOT_FOUND");
      }
      const proposal = await tx.scheduleAlternativeProposal.findFirst({ where: { id: pid, scheduleId: sid } });
      if (!proposal) throw domainError("Proposal not found.", 404, "ALTERNATIVE_PROPOSAL_NOT_FOUND");
      if (!OPEN_STATUSES.includes(proposal.status)) {
        throw domainError("This proposal is no longer open.", 409, "ALTERNATIVE_PROPOSAL_CLOSED");
      }
      if (proposal.nominationRevision !== Number(expectedRevision)) {
        throw domainError("The proposal changed. Please refresh and retry.", 409, "ALTERNATIVE_PROPOSAL_CONFLICT");
      }
      const updated = await tx.scheduleAlternativeProposal.update({
        where: { id: pid },
        data: {
          status: "WITHDRAWN",
          resolvedById: Number(actorId),
          resolvedAt: new Date(),
          nominatedPriestId: null,
          priestResponseStatus: null,
          nominationRevision: { increment: 1 },
        },
      });
      await AuditLogService.log(actorId, "Alternative Date Proposal Withdrawn", tx, false, {
        affectedTable: "schedule_alternative_proposals",
        affectedRecordId: proposal.id,
        parishId: schedule.parishId,
        previousValues: { status: proposal.status, nominationRevision: proposal.nominationRevision },
        newValues: { status: "WITHDRAWN", nominationRevision: proposal.nominationRevision + 1 },
      });
      await NotificationDispatcher.notifyAlternativeProposal({
        event: "WITHDRAWN",
        parishId: schedule.parishId,
        scheduleId: schedule.id,
        displayTitle: resolveScheduleDisplayTitle(schedule),
      }, tx);
      return updated;
    });
  }

  async decline(scheduleId, proposalId, { actorId, actorRole, actorParishId, expectedRevision, reason }) {
    const sid = positiveId(scheduleId, "schedule ID");
    const pid = positiveId(proposalId, "proposal ID");
    return inSerializable(async (tx) => {
      const schedule = await loadSchedule(tx, sid);
      if (!schedule) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
      authorizeSchedule(schedule, actorId, actorRole, actorParishId);
      const proposal = await tx.scheduleAlternativeProposal.findFirst({ where: { id: pid, scheduleId: sid } });
      if (!proposal) throw domainError("Proposal not found.", 404, "ALTERNATIVE_PROPOSAL_NOT_FOUND");
      if (!OPEN_STATUSES.includes(proposal.status) || proposal.nominationRevision !== Number(expectedRevision)) {
        throw domainError("The proposal changed. Please refresh and retry.", 409, "ALTERNATIVE_PROPOSAL_CONFLICT");
      }
      const updated = await tx.scheduleAlternativeProposal.update({
        where: { id: pid },
        data: {
          status: "DECLINED",
          resolvedById: Number(actorId),
          resolvedAt: new Date(),
          priestResponseReason: reason,
          nominatedPriestId: null,
          priestResponseStatus: null,
          nominationRevision: { increment: 1 },
        },
      });
      await AuditLogService.log(actorId, "Alternative Date Proposal Declined", tx, false, {
        affectedTable: "schedule_alternative_proposals",
        affectedRecordId: proposal.id,
        parishId: schedule.parishId,
        previousValues: { status: proposal.status, nominationRevision: proposal.nominationRevision },
        newValues: { status: "DECLINED", nominationRevision: proposal.nominationRevision + 1 },
      });
      await NotificationDispatcher.notifyAlternativeProposal({
        event: "DECLINED",
        parishionerId: schedule.userId,
        scheduleId: schedule.id,
        displayTitle: resolveScheduleDisplayTitle(schedule),
        reason,
      }, tx);
      return updated;
    });
  }

  async nominate(scheduleId, proposalId, {
    priestId,
    actorId,
    actorRole,
    actorParishId,
    expectedRevision,
    expectedVersion,
  }) {
    const sid = positiveId(scheduleId, "schedule ID");
    const pid = positiveId(proposalId, "proposal ID");
    const nominatedPriestId = normalizePriestId(priestId);
    const outcome = await inSerializable(async (tx) => {
      const initial = await tx.schedule.findUnique({ where: { id: sid } });
      if (!initial) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
      await lockParishSchedulingConfiguration(tx, initial.parishId);
      await lockPriestsForScheduling(tx, [nominatedPriestId]);
      const schedule = await loadSchedule(tx, sid);
      authorizeSchedule(schedule, actorId, actorRole, actorParishId);
      const proposal = await tx.scheduleAlternativeProposal.findFirst({ where: { id: pid, scheduleId: sid } });
      if (!proposal) throw domainError("Proposal not found.", 404, "ALTERNATIVE_PROPOSAL_NOT_FOUND");
      if (!OPEN_STATUSES.includes(proposal.status) || proposal.nominationRevision !== Number(expectedRevision)) {
        throw domainError("The proposal changed. Please refresh and retry.", 409, "ALTERNATIVE_PROPOSAL_CONFLICT");
      }
      if (schedule.version !== Number(expectedVersion) || isAlternativeProposalStale(schedule, proposal)) {
        const superseded = await supersedeProposal(tx, proposal, actorId);
        return {
          recoverableError: domainError("The original appointment changed, so this proposal was closed.", 409, "ALTERNATIVE_PROPOSAL_SUPERSEDED"),
          proposal: superseded,
        };
      }
      await validateRequestedPriestEligibility(nominatedPriestId, schedule.parishId, tx);
      const timeSlot = formatManilaTimeSlot(proposal.proposedStartDatetime);
      await validateCandidateSlot(tx, schedule, getManilaDateString(proposal.proposedDate), timeSlot, {
        requiredPriestId: nominatedPriestId,
        actorId,
      });
      const updated = await tx.scheduleAlternativeProposal.update({
        where: { id: proposal.id },
        data: {
          status: "PRIEST_PENDING",
          nominatedPriestId,
          priestResponseStatus: "PENDING",
          priestResponseReason: null,
          resolvedById: Number(actorId),
          resolvedAt: new Date(),
          nominationRevision: { increment: 1 },
        },
        include: { nominatedPriest: { select: { id: true, fullName: true } } },
      });
      await AuditLogService.log(actorId, "Alternative Date Priest Nominated", tx, false, {
        affectedTable: "schedule_alternative_proposals",
        affectedRecordId: proposal.id,
        parishId: schedule.parishId,
        previousValues: {
          status: proposal.status,
          nominatedPriestId: proposal.nominatedPriestId,
          nominationRevision: proposal.nominationRevision,
        },
        newValues: {
          status: "PRIEST_PENDING",
          nominatedPriestId,
          nominationRevision: proposal.nominationRevision + 1,
        },
      });
      await NotificationDispatcher.notifyAlternativeProposal({
        event: "PRIEST_PENDING",
        parishionerId: schedule.userId,
        parishId: schedule.parishId,
        scheduleId: schedule.id,
        priestId: nominatedPriestId,
        displayTitle: resolveScheduleDisplayTitle(schedule),
        date: getManilaDateString(proposal.proposedDate),
        timeSlot,
      }, tx);
      return { proposal: updated };
    });
    if (outcome.recoverableError) throw outcome.recoverableError;
    return outcome.proposal;
  }

  async revokeNomination(scheduleId, proposalId, { actorId, actorRole, actorParishId, expectedRevision }) {
    const sid = positiveId(scheduleId, "schedule ID");
    const pid = positiveId(proposalId, "proposal ID");
    return inSerializable(async (tx) => {
      const schedule = await loadSchedule(tx, sid);
      if (!schedule) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
      authorizeSchedule(schedule, actorId, actorRole, actorParishId);
      const proposal = await tx.scheduleAlternativeProposal.findFirst({ where: { id: pid, scheduleId: sid } });
      if (!proposal || proposal.status !== "PRIEST_PENDING" || proposal.nominationRevision !== Number(expectedRevision)) {
        throw domainError("The proposal changed. Please refresh and retry.", 409, "ALTERNATIVE_PROPOSAL_CONFLICT");
      }
      const updated = await tx.scheduleAlternativeProposal.update({
        where: { id: pid },
        data: {
          status: "SUBMITTED",
          nominatedPriestId: null,
          priestResponseStatus: null,
          priestResponseReason: null,
          resolvedById: Number(actorId),
          resolvedAt: new Date(),
          nominationRevision: { increment: 1 },
        },
      });
      await AuditLogService.log(actorId, "Alternative Date Priest Nomination Revoked", tx, false, {
        affectedTable: "schedule_alternative_proposals",
        affectedRecordId: proposal.id,
        parishId: schedule.parishId,
        previousValues: {
          status: proposal.status,
          nominatedPriestId: proposal.nominatedPriestId,
          nominationRevision: proposal.nominationRevision,
        },
        newValues: {
          status: "SUBMITTED",
          nominatedPriestId: null,
          nominationRevision: proposal.nominationRevision + 1,
        },
      });
      await NotificationDispatcher.notifyAlternativeProposal({
        event: "NOMINATION_REVOKED",
        parishionerId: schedule.userId,
        parishId: schedule.parishId,
        scheduleId: schedule.id,
        displayTitle: resolveScheduleDisplayTitle(schedule),
      }, tx);
      return updated;
    });
  }

  async priestRespond(scheduleId, proposalId, {
    actorId,
    actorRole,
    expectedRevision,
    status,
    reason,
  }) {
    if (actorRole !== "PRIEST") {
      throw domainError("Only the nominated priest may respond.", 403, "FORBIDDEN");
    }
    const sid = positiveId(scheduleId, "schedule ID");
    const pid = positiveId(proposalId, "proposal ID");
    const response = status === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
    const outcome = await inSerializable(async (tx) => {
      const initial = await tx.schedule.findUnique({ where: { id: sid } });
      if (!initial) throw domainError("Schedule request not found.", 404, "SCHEDULE_NOT_FOUND");
      await lockParishSchedulingConfiguration(tx, initial.parishId);
      await lockPriestsForScheduling(tx, [Number(actorId)]);
      const schedule = await loadSchedule(tx, sid);
      const proposal = await tx.scheduleAlternativeProposal.findFirst({
        where: { id: pid, scheduleId: sid },
        include: { nominatedPriest: { select: { id: true, fullName: true } } },
      });
      if (
        !proposal
        || proposal.status !== "PRIEST_PENDING"
        || proposal.nominatedPriestId !== Number(actorId)
      ) {
        throw domainError("You are not the current nominated priest for this proposal.", 403, "FORBIDDEN");
      }
      if (proposal.nominationRevision !== Number(expectedRevision)) {
        throw domainError("This nomination is stale. Please refresh.", 409, "ALTERNATIVE_PROPOSAL_CONFLICT");
      }

      if (response === "REJECTED") {
        const updated = await tx.scheduleAlternativeProposal.update({
          where: { id: pid },
          data: {
            status: "SUBMITTED",
            nominatedPriestId: null,
            priestResponseStatus: "REJECTED",
            priestResponseReason: reason || null,
            nominationRevision: { increment: 1 },
          },
        });
        await AuditLogService.log(actorId, "Alternative Date Priest Nomination Rejected", tx, false, {
          affectedTable: "schedule_alternative_proposals",
          affectedRecordId: proposal.id,
          parishId: schedule.parishId,
          previousValues: {
            status: proposal.status,
            nominatedPriestId: proposal.nominatedPriestId,
            nominationRevision: proposal.nominationRevision,
          },
          newValues: {
            status: "SUBMITTED",
            nominatedPriestId: null,
            nominationRevision: proposal.nominationRevision + 1,
          },
        });
        await NotificationDispatcher.notifyAlternativeProposal({
          event: "PRIEST_REJECTED",
          parishionerId: schedule.userId,
          parishId: schedule.parishId,
          scheduleId: schedule.id,
          displayTitle: resolveScheduleDisplayTitle(schedule),
          reason,
        }, tx);
        return { proposal: updated };
      }

      if (isAlternativeProposalStale(schedule, proposal)) {
        const superseded = await supersedeProposal(tx, proposal, actorId);
        await NotificationDispatcher.notifyAlternativeProposal({
          event: "SUPERSEDED",
          parishionerId: schedule.userId,
          scheduleId: schedule.id,
          displayTitle: resolveScheduleDisplayTitle(schedule),
        }, tx);
        return {
          recoverableError: domainError("The original appointment changed, so this proposal was closed.", 409, "ALTERNATIVE_PROPOSAL_SUPERSEDED"),
          proposal: superseded,
        };
      }

      const timeSlot = formatManilaTimeSlot(proposal.proposedStartDatetime);
      try {
        await validateCandidateSlot(tx, schedule, getManilaDateString(proposal.proposedDate), timeSlot, {
          requiredPriestId: Number(actorId),
          actorId,
        });
      } catch {
        await tx.scheduleAlternativeProposal.update({
          where: { id: proposal.id },
          data: {
            status: "SUBMITTED",
            nominatedPriestId: null,
            priestResponseStatus: null,
            priestResponseReason: "Final availability validation failed.",
            nominationRevision: { increment: 1 },
          },
        });
        return {
          recoverableError: domainError("The proposed slot is no longer available. Parish staff may nominate another option.", 409, "ALTERNATIVE_PROPOSAL_REVALIDATION_FAILED"),
        };
      }

      assertScheduleMutable(schedule);
      await appendScheduleHistory(tx, schedule, {
        reason: "Parishioner alternative date accepted by nominated priest",
        actorId,
        actorRole,
      });
      const oldDate = getManilaDateString(schedule.requestedDate);
      const existingRemarks = schedule.remarks
        ? schedule.remarks
            .replace(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)\.?/i, "")
            .replace(/\[Estimated End Time\]/gi, "")
            .trim()
        : "";
      const remarks = [
        `Time Slot: ${timeSlot}. [Estimated End Time]`,
        existingRemarks,
        `[Rescheduled from ${oldDate} (parishioner-requested)]`,
      ].filter(Boolean).join(" ");
      await updateScheduleAtVersion(tx, schedule.id, schedule.version, {
        requestedDate: proposal.proposedDate,
        startDatetime: proposal.proposedStartDatetime,
        endDatetime: proposal.proposedEndDatetime,
        assignedPriestId: Number(actorId),
        priestResponseStatus: "ACCEPTED",
        priestResponseReason: null,
        layMinisterAssigned: false,
        remarks,
        processedById: proposal.resolvedById || Number(actorId),
      });
      const applied = await tx.scheduleAlternativeProposal.update({
        where: { id: proposal.id },
        data: {
          status: "APPLIED",
          priestResponseStatus: "ACCEPTED",
          priestResponseReason: reason || null,
          resolvedAt: new Date(),
        },
        include: { nominatedPriest: { select: { id: true, fullName: true } } },
      });
      await AuditLogService.log(actorId, "Alternative Date Proposal Applied", tx, false, {
        affectedTable: "schedules",
        affectedRecordId: schedule.id,
        parishId: schedule.parishId,
        previousValues: { requestedDate: oldDate, layMinisterAssigned: true, assignedPriestId: null },
        newValues: {
          requestedDate: getManilaDateString(proposal.proposedDate),
          layMinisterAssigned: false,
          assignedPriestId: Number(actorId),
        },
      });
      await NotificationDispatcher.notifyAlternativeProposal({
        event: "APPLIED",
        parishionerId: schedule.userId,
        parishId: schedule.parishId,
        scheduleId: schedule.id,
        displayTitle: schedule.displayTitle || schedule.eventType,
        date: getManilaDateString(proposal.proposedDate),
        timeSlot,
      }, tx);
      return { proposal: applied };
    });
    if (outcome.recoverableError) throw outcome.recoverableError;
    return outcome.proposal;
  }
}
