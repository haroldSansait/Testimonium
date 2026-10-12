import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../config/db.js";
import { ConflictHelper } from "../services/ConflictHelper.js";
import { EventTypeCatalog } from "../shared/EventTypeCatalog.js";
import {
  decorateMassTemplateForDisplay,
  decorateScheduleForDisplay,
  isLayMinisterEligibleEvent,
  resolveMassDisplayLabel,
  resolveScheduleDisplayTitle,
} from "../shared/LayMinisterPresentation.js";
import { requirePriestAccepted } from "../services/ScheduleStateMachine.js";
import { isAlternativeProposalStale } from "../shared/ScheduleAlternativeProposalPolicy.js";
import {
  classifyPriestAvailability,
  PriestAvailabilityClassification,
} from "../services/ScheduleAvailabilityDomainService.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { MassScheduleService } from "../services/MassScheduleService.js";
import { ScheduleAlternativeProposalService } from "../services/ScheduleAlternativeProposalService.js";
import {
  assignLayMinisterSchema,
  submitAlternativeProposalSchema,
} from "../validators/scheduleSchemas.js";

function conflict(code = "PRIEST_CONFLICT") {
  const error = new Error(code);
  error.statusCode = 409;
  error.code = code;
  return error;
}

function futureSchedule(overrides = {}) {
  return {
    id: 101,
    userId: 501,
    parishId: 10,
    eventType: "FUNERAL",
    displayTitle: "Funeral",
    requestedDate: new Date("2099-01-10T00:00:00.000Z"),
    startDatetime: new Date("2099-01-10T01:00:00.000Z"),
    endDatetime: new Date("2099-01-10T02:00:00.000Z"),
    remarks: "Time Slot: 09:00 AM. Family note",
    status: "CONFIRMED",
    assignedPriestId: 201,
    priestResponseStatus: "ACCEPTED",
    priestResponseReason: null,
    layMinisterAssigned: false,
    version: 4,
    processedById: 901,
    ...overrides,
  };
}

function installTransactionMock(client) {
  const original = prisma.$transaction;
  prisma.$transaction = async (work) => {
    if (typeof work === "function") return work(client);
    return Promise.all(work);
  };
  return () => {
    prisma.$transaction = original;
  };
}

test("Lay Minister presentation and state-machine behavior", async (t) => {
  await t.test("only FUNERAL and BLESSING are eligible among all 16 canonical events", () => {
    assert.equal(EventTypeCatalog.length, 16);
    const eligible = EventTypeCatalog.filter((item) => isLayMinisterEligibleEvent(item.enum)).map((item) => item.enum);
    assert.deepEqual(eligible, ["FUNERAL", "BLESSING"]);
    assert.equal(EventTypeCatalog.filter((item) => !isLayMinisterEligibleEvent(item.enum)).length, 14);
  });

  await t.test("display mapping is conditional and does not overwrite stored titles or labels", () => {
    const funeral = {
      eventType: "FUNERAL",
      displayTitle: "Funeral",
      layMinisterAssigned: true,
      status: "CONFIRMED",
      startDatetime: new Date("2099-01-10T01:00:00.000Z"),
    };
    const mass = { label: "Sunday High Mass", layMinisterAssigned: true };
    assert.equal(resolveScheduleDisplayTitle(funeral), "Rite of Committal");
    assert.equal(resolveScheduleDisplayTitle({ ...funeral, eventType: "BLESSING" }), "Blessing");
    assert.equal(resolveScheduleDisplayTitle({ ...funeral, layMinisterAssigned: false }), "Funeral");
    assert.equal(resolveMassDisplayLabel(mass), "Liturgy of the Word");
    assert.equal(resolveMassDisplayLabel({ ...mass, layMinisterAssigned: false }), "Sunday High Mass");
    assert.equal(funeral.displayTitle, "Funeral");
    assert.equal(mass.label, "Sunday High Mass");
    assert.equal(decorateScheduleForDisplay(funeral).canProposeAlternativeDate, true);
    assert.equal(decorateMassTemplateForDisplay(mass).label, "Sunday High Mass");
  });

  await t.test("proposal staleness detects schedule drift, reassignment, terminal state, and elapsed start", () => {
    const schedule = futureSchedule({
      assignedPriestId: null,
      priestResponseStatus: null,
      layMinisterAssigned: true,
    });
    const proposal = {
      baseScheduleVersion: schedule.version,
      baseRequestedDate: schedule.requestedDate,
      baseStartDatetime: schedule.startDatetime,
    };
    assert.equal(isAlternativeProposalStale(schedule, proposal, new Date("2098-01-01T00:00:00.000Z")), false);
    assert.equal(isAlternativeProposalStale({ ...schedule, version: 5 }, proposal, new Date("2098-01-01T00:00:00.000Z")), true);
    assert.equal(isAlternativeProposalStale({ ...schedule, layMinisterAssigned: false }, proposal, new Date("2098-01-01T00:00:00.000Z")), true);
    assert.equal(isAlternativeProposalStale({ ...schedule, status: "CANCELLED" }, proposal, new Date("2098-01-01T00:00:00.000Z")), true);
    assert.equal(isAlternativeProposalStale(schedule, proposal, new Date("2099-01-10T01:00:00.000Z")), true);
  });

  await t.test("confirmed invariant has only the narrow eligible Lay Minister exception", () => {
    assert.doesNotThrow(() => requirePriestAccepted({
      eventType: "FUNERAL",
      layMinisterAssigned: true,
      assignedPriestId: null,
    }));
    assert.throws(
      () => requirePriestAccepted({ eventType: "BAPTISM", layMinisterAssigned: true, assignedPriestId: null }),
      (error) => error.code === "PRIEST_ASSIGNMENT_REQUIRED"
    );
    assert.throws(
      () => requirePriestAccepted({
        eventType: "FUNERAL",
        layMinisterAssigned: false,
        assignedPriestId: 201,
        priestResponseStatus: "PENDING",
      }),
      (error) => error.code === "PRIEST_ASSIGNMENT_PENDING"
    );
  });

  await t.test("request validators require a reason/version and bound proposal notes", () => {
    assert.equal(assignLayMinisterSchema.safeParse({ expectedVersion: 4, reason: "Emergency coverage" }).success, true);
    assert.equal(assignLayMinisterSchema.safeParse({ expectedVersion: 4, reason: "no" }).success, false);
    assert.equal(submitAlternativeProposalSchema.safeParse({
      proposedDate: "2099-01-12",
      timeSlot: "09:00 AM",
      note: "x".repeat(1001),
    }).success, false);
  });
});

test("authoritative availability classification fails closed", async () => {
  const original = ConflictHelper.checkPriestConflict;
  try {
    ConflictHelper.checkPriestConflict = async () => undefined;
    assert.equal(
      await classifyPriestAvailability({ priestId: 201, date: "2099-01-10" }),
      PriestAvailabilityClassification.AVAILABLE
    );
    ConflictHelper.checkPriestConflict = async () => { throw conflict(); };
    assert.equal(
      await classifyPriestAvailability({ priestId: 201, date: "2099-01-10" }),
      PriestAvailabilityClassification.CONFIRMED_UNAVAILABLE
    );
    ConflictHelper.checkPriestConflict = async () => { throw conflict("PRIEST_AVAILABILITY_UNDETERMINED"); };
    assert.equal(
      await classifyPriestAvailability({ priestId: 201, date: "2099-01-10" }),
      PriestAvailabilityClassification.UNKNOWN
    );
    ConflictHelper.checkPriestConflict = async () => { throw new Error("query timeout"); };
    assert.equal(
      await classifyPriestAvailability({ priestId: 201, date: "2099-01-10" }),
      PriestAvailabilityClassification.UNKNOWN
    );
  } finally {
    ConflictHelper.checkPriestConflict = original;
  }
});

test("individual Lay Minister assignment preserves appointment identity and is idempotent", async () => {
  const state = {
    schedule: futureSchedule(),
    histories: [],
    notifications: [],
    audits: [],
  };
  const tx = {
    $queryRaw: async () => [{ parish_id: 10, user_id: 201 }],
    user: {
      findMany: async () => [{ id: 201 }, { id: 202 }],
      findUnique: async ({ where }) => ({
        id: where.id,
        parishId: 10,
        role: { roleName: where.id === 901 ? "SECRETARY" : "PRIEST" },
      }),
    },
    schedule: {
      findUnique: async () => ({
        ...state.schedule,
        user: { id: 501, fullName: "Parishioner" },
        parish: { id: 10, parishName: "Test Parish" },
      }),
      updateMany: async ({ where, data }) => {
        if (where.id !== state.schedule.id || where.version !== state.schedule.version) return { count: 0 };
        state.schedule = { ...state.schedule, ...data, version: state.schedule.version + 1 };
        return { count: 1 };
      },
    },
    scheduleHistory: {
      create: async ({ data }) => {
        state.histories.push(data);
        return data;
      },
    },
    activityLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        return data;
      },
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
        return { count: data.length };
      },
    },
  };
  const originalFind = prisma.schedule.findUnique;
  const originalConflict = ConflictHelper.checkPriestConflict;
  const restoreTransaction = installTransactionMock(tx);
  prisma.schedule.findUnique = tx.schedule.findUnique;
  ConflictHelper.checkPriestConflict = async () => { throw conflict(); };
  try {
    const service = new ScheduleService();
    const before = { ...state.schedule };
    const result = await service.assignLayMinister(101, {
      expectedVersion: 4,
      reason: "All parish priests have recorded conflicts",
      actorId: 901,
      actorRole: "SECRETARY",
      actorParishId: 10,
    });
    assert.equal(result.layMinisterAssigned, true);
    assert.equal(result.effectiveDisplayTitle, "Rite of Committal");
    assert.equal(state.schedule.assignedPriestId, null);
    assert.equal(state.schedule.priestResponseStatus, null);
    assert.equal(state.schedule.status, "CONFIRMED");
    assert.equal(state.schedule.version, 5);
    assert.equal(state.schedule.eventType, before.eventType);
    assert.equal(state.schedule.displayTitle, before.displayTitle);
    assert.equal(state.schedule.requestedDate, before.requestedDate);
    assert.equal(state.schedule.startDatetime, before.startDatetime);
    assert.equal(state.schedule.endDatetime, before.endDatetime);
    assert.equal(state.schedule.remarks, before.remarks);
    assert.equal(state.histories.length, 1);
    assert.equal(state.histories[0].layMinisterAssigned, false);
    assert.equal(state.notifications.length, 1);
    assert.equal(state.audits.length, 1);

    await service.assignLayMinister(101, {
      expectedVersion: 4,
      reason: "Repeated delivery",
      actorId: 901,
      actorRole: "SECRETARY",
      actorParishId: 10,
    });
    assert.equal(state.histories.length, 1);
    assert.equal(state.notifications.length, 1);
  } finally {
    prisma.schedule.findUnique = originalFind;
    ConflictHelper.checkPriestConflict = originalConflict;
    restoreTransaction();
  }
});

test("Mass template updates preserve an omitted Lay Minister assignment", async () => {
  const original = {
    id: 7,
    parishId: 10,
    dayType: "SUNDAY",
    timeSlot: "09:00 AM",
    label: "Sunday High Mass",
    isActive: true,
    assignedPriestId: null,
    priestResponseStatus: null,
    priestResponseReason: null,
    layMinisterAssigned: true,
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
  };
  let saved = { ...original };
  const tx = {
    $queryRaw: async () => [{ parish_id: 10, user_id: 901 }],
    massScheduleTemplate: {
      findUnique: async () => ({ ...saved }),
      update: async ({ data }) => {
        saved = { ...saved, ...data, updatedAt: new Date("2026-10-12T01:00:00.000Z") };
        return { ...saved, assignedPriest: null };
      },
    },
    user: {
      findMany: async () => [],
      findUnique: async ({ where }) => ({ id: where.id, parishId: 10, role: { roleName: "SECRETARY" } }),
    },
    activityLog: { create: async ({ data }) => data },
  };
  const restoreTransaction = installTransactionMock(tx);
  try {
    const result = await new MassScheduleService().upsertTemplate(10, {
      id: 7,
      dayType: original.dayType,
      timeSlot: original.timeSlot,
      label: "Configured label edit",
      assignedPriestIdPresent: false,
      layMinisterAssignedPresent: false,
      actorId: 901,
    });
    assert.equal(result.layMinisterAssigned, true);
    assert.equal(result.displayLabel, "Liturgy of the Word");
    assert.equal(saved.id, original.id);
    assert.equal(saved.dayType, original.dayType);
    assert.equal(saved.timeSlot, original.timeSlot);
    assert.equal(saved.isActive, original.isActive);
    assert.equal(saved.assignedPriestId, null);
    assert.equal(saved.label, "Configured label edit");
    await assert.rejects(
      new MassScheduleService().upsertTemplate(10, {
        id: 7,
        dayType: original.dayType,
        timeSlot: original.timeSlot,
        label: saved.label,
        assignedPriestId: 201,
        assignedPriestIdPresent: true,
        layMinisterAssignedPresent: false,
        actorId: 901,
      }),
      (error) => error.code === "MASS_ASSIGNMENT_CONCURRENCY_CONFLICT"
    );
    assert.equal(saved.layMinisterAssigned, true);
    assert.equal(saved.assignedPriestId, null);
  } finally {
    restoreTransaction();
  }
});

test("failed or rejected alternative proposal responses never mutate the original schedule", async (t) => {
  async function runResponse(status) {
    const schedule = futureSchedule({
      assignedPriestId: null,
      priestResponseStatus: null,
      layMinisterAssigned: true,
    });
    const proposal = {
      id: 301,
      scheduleId: schedule.id,
      createdById: schedule.userId,
      proposedDate: new Date("2000-01-01T00:00:00.000Z"),
      proposedStartDatetime: new Date("2000-01-01T01:00:00.000Z"),
      proposedEndDatetime: new Date("2000-01-01T02:00:00.000Z"),
      status: "PRIEST_PENDING",
      nominatedPriestId: 201,
      priestResponseStatus: "PENDING",
      nominationRevision: 2,
      baseScheduleVersion: schedule.version,
      baseRequestedDate: schedule.requestedDate,
      baseStartDatetime: schedule.startDatetime,
      resolvedById: 901,
      nominatedPriest: { id: 201, fullName: "Priest" },
    };
    let scheduleWrites = 0;
    const tx = {
      $queryRaw: async () => [{ parish_id: 10, user_id: 201 }],
      schedule: {
        findUnique: async () => ({
          ...schedule,
          parish: { id: 10, parishName: "Test Parish", availabilities: [] },
          user: { id: 501, fullName: "Parishioner" },
        }),
        updateMany: async () => {
          scheduleWrites += 1;
          return { count: 1 };
        },
        findMany: async () => [],
      },
      scheduleAlternativeProposal: {
        findFirst: async () => ({ ...proposal }),
        update: async ({ data }) => {
          Object.assign(proposal, data, { nominationRevision: proposal.nominationRevision + 1 });
          return { ...proposal };
        },
      },
      user: {
        findMany: async () => [],
        findUnique: async ({ where }) => ({ id: where.id, parishId: 10, role: { roleName: "PRIEST" } }),
      },
      activityLog: { create: async ({ data }) => data },
      notification: { createMany: async ({ data }) => ({ count: data.length }) },
    };
    const restoreTransaction = installTransactionMock(tx);
    try {
      const service = new ScheduleAlternativeProposalService();
      const call = service.priestRespond(101, 301, {
        actorId: 201,
        actorRole: "PRIEST",
        expectedRevision: 2,
        status,
        reason: status === "REJECTED" ? "Pastoral conflict" : undefined,
      });
      if (status === "ACCEPTED") {
        await assert.rejects(call, (error) => error.code === "ALTERNATIVE_PROPOSAL_REVALIDATION_FAILED");
      } else {
        await call;
      }
      return { schedule, proposal, scheduleWrites };
    } finally {
      restoreTransaction();
    }
  }

  await t.test("priest rejection reopens the proposal and leaves Lay Minister/date/status/version intact", async () => {
    const result = await runResponse("REJECTED");
    assert.equal(result.proposal.status, "SUBMITTED");
    assert.equal(result.scheduleWrites, 0);
    assert.equal(result.schedule.layMinisterAssigned, true);
    assert.equal(result.schedule.status, "CONFIRMED");
    assert.equal(result.schedule.version, 4);
  });

  await t.test("final validation failure reopens the proposal without changing or cancelling the appointment", async () => {
    const result = await runResponse("ACCEPTED");
    assert.equal(result.proposal.status, "SUBMITTED");
    assert.equal(result.scheduleWrites, 0);
    assert.equal(result.schedule.layMinisterAssigned, true);
    assert.equal(result.schedule.status, "CONFIRMED");
    assert.equal(result.schedule.version, 4);
  });
});
