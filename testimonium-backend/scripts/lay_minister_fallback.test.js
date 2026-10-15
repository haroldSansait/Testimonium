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
import { activeMassOccurrenceOverride, effectiveMassOccurrence } from "../shared/MassOccurrenceOverride.js";
import { evaluatePriestConflictFromSnapshot, getManilaDateString, massTemplateAppliesOnDate, parseManilaDateTime } from "../services/ConflictHelper.js";

function occurrenceFixture() {
  const template = {
    id: 7, parishId: 10, dayType: "SUNDAY", timeSlot: "08:00 AM", label: "Sunday High Mass",
    assignedPriestId: 201, assignedPriest: { id: 201, fullName: "Fr. Primary", isAssistant: false },
    layMinisterAssigned: false, isActive: true, occurrenceRevision: 1,
    updatedAt: new Date("2098-01-01T00:00:00Z"), occurrenceOverrides: [],
  };
  const priests = [template.assignedPriest, { id: 202, fullName: "Fr. Assistant", isAssistant: true }];
  const state = { template, priests, mode: "unavailable", writes: 0, checks: [], audits: [], rosterReads: 0 };
  const busy = [{ id: 1, startAt: new Date("2099-10-18T00:00:00Z"), endAt: new Date("2099-10-18T01:00:00Z"), title: "Private commitment" }];
  const tx = {
    $queryRaw: async () => [{ parish_id: 10, user_id: 201 }],
    parish: { findUnique: async () => ({ schedulingConfigVersion: 1 }) },
    user: {
      findMany: async () => { state.rosterReads++; return state.priests; },
      findUnique: async () => ({ role: { roleName: "SECRETARY" }, parishId: 10 }),
    },
    massScheduleTemplate: {
      findMany: async ({ where }) => where.parishId ? [state.template] : [],
      findUnique: async () => state.template,
    },
    parishAvailability: { findMany: async () => [] },
    schedule: { findMany: async () => [] },
    parishEvent: { findMany: async () => [] },
    priestPersonalSchedule: {
      findMany: async ({ where }) => {
        if (state.mode === "unknown") throw new Error("availability storage offline");
        return state.mode === "available" && where.priestId === 202 ? [] : busy;
      },
    },
    massOccurrenceOverride: {
      create: async ({ data }) => {
        state.writes++;
        const row = { id: 1, version: 1, ...data };
        state.template.occurrenceOverrides.push(row);
        return row;
      },
      update: async ({ data }) => {
        state.writes++;
        const row = state.template.occurrenceOverrides[0];
        Object.assign(row, { ...data, version: row.version + 1 });
        return row;
      },
    },
    activityLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
  };
  return { state, tx };
}

test("single-day Mass overrides use authoritative availability and preserve the recurring template", async t => {
  const service = new MassScheduleService();
  async function run(work) {
    const { state, tx } = occurrenceFixture();
    const restore = installTransactionMock(tx);
    const original = ConflictHelper.checkPriestConflict;
    ConflictHelper.checkPriestConflict = async (priestId, date, start, end, options) => {
      state.checks.push({ priestId, date, start, end, options });
      if (state.mode === "liveChanged") return;
      if (state.mode === "unknown") throw new Error("storage offline");
      if (state.mode === "available" && priestId === 202) return;
      throw conflict();
    };
    try { await work(state); } finally { restore(); ConflictHelper.checkPriestConflict = original; }
  }
  const preview = () => service.getOccurrences(10, "2099-10-18");
  const confirm = item => ({ weekStart: item.weekStart, availabilityToken: item.availabilityToken });
  await t.test("only October 18 changes; the following Sunday remains priest-led; revocation restores it", () => run(async state => {
    const week = await preview();
    assert.equal(state.writes, 0);
    const first = week.occurrences[0];
    assert.equal(first.date, "2099-10-18");
    assert.equal(first.classification, "CONFIRMED_UNAVAILABLE");
    const next = await service.getOccurrences(10, "2099-10-25");
    assert.equal(next.occurrences[0].classification, "AVAILABLE");
    await service.setOccurrenceLayMinister(10, 7, first.date, confirm(first), 901, true);
    assert.equal(state.checks.length, 2);
    assert.ok(state.checks.every(check => check.end - check.start === 3600000 && check.options.excludeMassTemplateId === 7));
    assert.equal(state.template.layMinisterAssigned, false);
    assert.equal(state.template.assignedPriestId, 201);
    const assigned = (await preview()).occurrences[0];
    assert.equal(assigned.displayLabel, "Liturgy of the Word");
    assert.equal(assigned.assignedPriest, null);
    assert.equal((await service.getOccurrences(10, "2099-10-25")).occurrences[0].displayLabel, "Sunday High Mass");
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, first.date, confirm(first), 901, true), error => error.code === "MASS_OCCURRENCE_STALE");
    await service.setOccurrenceLayMinister(10, 7, first.date, confirm(assigned), 901, false);
    const restored = (await preview()).occurrences[0];
    assert.equal(restored.displayLabel, "Sunday High Mass");
    assert.equal(restored.assignedPriest.id, 201);
    assert.equal(state.template.occurrenceOverrides[0].isActive, false);
    assert.equal(state.audits.length, 2);
  }));
  await t.test("an available assistant prevents assignment and is named accurately", () => run(async state => {
    state.mode = "available";
    const item = (await preview()).occurrences[0];
    assert.equal(item.classification, "AVAILABLE");
    assert.equal(item.priests.find(priest => priest.classification === "AVAILABLE").fullName, "Fr. Assistant");
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "LAY_MINISTER_PRIEST_AVAILABLE");
    assert.equal(state.writes, 0);
  }));
  await t.test("unknown availability fails closed, with no preview or save mutations", () => run(async state => {
    state.mode = "unknown";
    const item = (await preview()).occurrences[0];
    assert.equal(item.classification, "UNKNOWN");
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "LAY_MINISTER_AVAILABILITY_UNVERIFIED");
    assert.equal(state.writes, 0);
  }));
  await t.test("no active priests permits an explicitly confirmed dated designation", () => run(async state => {
    state.priests = [];
    const item = (await preview()).occurrences[0];
    assert.equal(item.classification, "NO_ACTIVE_PRIESTS");
    await service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true);
    assert.equal(state.writes, 1);
  }));
  await t.test("changed scheduling data and changed live results require fresh review", () => run(async state => {
    const item = (await preview()).occurrences[0];
    state.mode = "available";
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "MASS_OCCURRENCE_STALE");
    state.mode = "liveChanged";
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "MASS_OCCURRENCE_STALE");
    assert.equal(state.writes, 0);
  }));
  await t.test("changed time, weekday, archive and parish never authorize a stale occurrence", () => run(async state => {
    const item = (await preview()).occurrences[0];
    state.template.timeSlot = "09:00 AM";
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "MASS_OCCURRENCE_STALE");
    state.template.dayType = "FRIDAY";
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "INVALID_MASS_OCCURRENCE");
    state.template.isActive = false;
    await assert.rejects(service.setOccurrenceLayMinister(10, 7, item.date, confirm(item), 901, true), error => error.code === "INVALID_MASS_OCCURRENCE");
    await assert.rejects(service.setOccurrenceLayMinister(11, 7, item.date, confirm(item), 901, true), error => error.code === "MASS_TEMPLATE_NOT_FOUND");
    assert.equal(state.writes, 0);
  }));
  await t.test("every configured weekday and legacy WEEKDAY expand from saved recurrence", () => run(async state => {
    for (const dayType of ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "WEEKDAY"]) {
      state.template.dayType = dayType;
      const week = await preview();
      assert.equal(week.occurrences.length, dayType === "WEEKDAY" ? 2 : 1);
      assert.ok(week.occurrences.every(item => massTemplateAppliesOnDate(dayType, item.date)));
    }
    assert.equal(state.rosterReads, 8);
  }));
});

test("dated override conflict integrity uses saved date, time and revision in both engines", async () => {
  const { state, tx } = occurrenceFixture();
  const template = state.template;
  const override = { id: 1, isActive: true, dayType: template.dayType, timeSlot: template.timeSlot, templateRevision: 1, occurrenceDate: new Date("2099-10-18T00:00:00Z") };
  template.occurrenceOverrides = [override];
  const snapshot = { leaves: [], schedules: [], events: [], personalSchedules: [], massTemplates: [template] };
  const start = parseManilaDateTime("2099-10-18", "08:00 AM");
  assert.equal(evaluatePriestConflictFromSnapshot(snapshot, start, new Date(+start + 3600000)).available, true);
  const next = parseManilaDateTime("2099-10-25", "08:00 AM");
  assert.equal(evaluatePriestConflictFromSnapshot(snapshot, next, new Date(+next + 3600000)).available, false);
  assert.equal(effectiveMassOccurrence(template, "2099-10-18").assignedPriestId, null);
  template.timeSlot = "09:00 AM";
  assert.equal(activeMassOccurrenceOverride(template, "2099-10-18"), null);
  template.timeSlot = "08:00 AM";
  template.occurrenceRevision++;
  assert.equal(activeMassOccurrenceOverride(template, "2099-10-18"), null);
  template.occurrenceRevision = 1;
  tx.parishAvailability.findFirst = async () => null;
  tx.priestPersonalSchedule.findFirst = async () => null;
  tx.massScheduleTemplate.findMany = async () => [template];
  await ConflictHelper.checkPriestConflict(201, "2099-10-18", start, new Date(+start + 3600000), { tx });
  await assert.rejects(ConflictHelper.checkPriestConflict(201, "2099-10-25", next, new Date(+next + 3600000), { tx }), error => error.code === "PRIEST_CONFLICT");
  override.isActive = false;
  assert.equal(evaluatePriestConflictFromSnapshot(snapshot, start, new Date(+start + 3600000)).available, false);
});

test("recurring eligibility checks exactly seven Manila calendar dates and rejects unknown availability", async () => {
  const originalCheck = ConflictHelper.checkPriestConflict;
  const today = getManilaDateString();
  const weekday = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const template = { id: 7, parishId: 10, dayType: weekday, timeSlot: "08:00 AM", label: "Configured Mass", assignedPriestId: null, layMinisterAssigned: false, updatedAt: new Date(), isActive: true };
  const tx = {
    $queryRaw: async () => [{ parish_id: 10, user_id: 201 }],
    massScheduleTemplate: { findUnique: async () => template, update: async ({ data }) => ({ ...template, ...data }) },
    user: { findMany: async () => [{ id: 201 }], findUnique: async () => ({ role: { roleName: "SECRETARY" }, parishId: 10 }) },
    activityLog: { create: async ({ data }) => data },
  };
  const restore = installTransactionMock(tx);
  const dates = [];
  const input = { id: 7, dayType: weekday, timeSlot: template.timeSlot, label: template.label, layMinisterAssigned: true, layMinisterAssignedPresent: true, expectedUpdatedAt: template.updatedAt, actorId: 901 };
  try {
    ConflictHelper.checkPriestConflict = async (id, date) => { dates.push(date); if (date === today) throw conflict(); };
    await new MassScheduleService().upsertTemplate(10, input);
    assert.deepEqual(dates, [today]); // The next weekly occurrence (day eight) is outside the seven-day window.
    ConflictHelper.checkPriestConflict = async () => { throw new Error("unknown"); };
    await assert.rejects(new MassScheduleService().upsertTemplate(10, input), error => error.code === "LAY_MINISTER_AVAILABILITY_UNVERIFIED" && error.message.includes("7-day"));
  } finally { restore(); ConflictHelper.checkPriestConflict = originalCheck; }
});
import { CalendarService } from "../services/CalendarService.js";
import { ParishEventService } from "../services/ParishEventService.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";

test("dated designation reaches Admin, public Web/Android and Caloy feeds exactly once", async () => {
  const { state } = occurrenceFixture();
  const template = { ...state.template, parish: { id: 10, parishName: "Test Parish" } };
  template.occurrenceOverrides = [{ isActive: true, dayType: "SUNDAY", timeSlot: "08:00 AM", templateRevision: 1, occurrenceDate: new Date("2099-10-18T00:00:00Z") }];
  const originals = [prisma.massScheduleTemplate.findMany, prisma.parishEvent.findMany, prisma.user.findMany, prisma.schedule.findMany, prisma.parishAvailability.findMany];
  prisma.massScheduleTemplate.findMany = async () => [template];
  prisma.parishEvent.findMany = async () => [];
  prisma.user.findMany = async () => [];
  prisma.schedule.findMany = async () => [];
  prisma.parishAvailability.findMany = async () => [];
  try {
    const adminEvents = await new CalendarService().getEvents(2099, 10, 10);
    const firstAdmin = adminEvents.filter(item => item.id === "mass-7-18");
    assert.equal(firstAdmin.length, 1);
    assert.equal(firstAdmin[0].displayTitle, "Liturgy of the Word");
    assert.equal(firstAdmin[0].assignedPriest, null);
    assert.equal(adminEvents.find(item => item.id === "mass-7-25").displayTitle, "Sunday High Mass");
    const publicEvents = await new ParishEventService().getPublicEvents(2099, 10);
    const firstPublic = publicEvents.filter(item => item.id === "mass-t-7-2099-10-18");
    assert.equal(firstPublic.length, 1);
    assert.equal(firstPublic[0].title, "Liturgy of the Word");
    assert.match(firstPublic[0].description, /Lay Minister-led/);
    assert.equal(publicEvents.find(item => item.id === "mass-t-7-2099-10-25").title, "Sunday High Mass");
    const registry = new LiveToolRegistry({ prismaClient: {
      parish: { findUnique: async () => ({ id: 10, parishName: "Test Parish", isActive: true }) },
      parishEvent: { findMany: async () => [] },
      massScheduleTemplate: { findMany: async () => [template] },
    } });
    const firstCaloy = await registry.getParishEventsForDate({ parishId: 10, date: "2099-10-18" });
    assert.equal(firstCaloy.structuredFacts.massSchedules.length, 1);
    assert.equal(firstCaloy.structuredFacts.massSchedules[0].label, "Liturgy of the Word");
    assert.equal(firstCaloy.structuredFacts.massSchedules[0].layMinisterAssigned, true);
    assert.equal(firstCaloy.liveData.massSchedules[0].occurrenceOverrides, undefined);
    const nextCaloy = await registry.getParishEventsForDate({ parishId: 10, date: "2099-10-25" });
    assert.equal(nextCaloy.structuredFacts.massSchedules[0].label, "Sunday High Mass");
    assert.equal(nextCaloy.structuredFacts.massSchedules[0].layMinisterAssigned, false);
  } finally {
    [prisma.massScheduleTemplate.findMany, prisma.parishEvent.findMany, prisma.user.findMany, prisma.schedule.findMany, prisma.parishAvailability.findMany] = originals;
  }
});

test("an archived or moved designation remains visible for revocation without generating an event", async () => {
  const { state, tx } = occurrenceFixture();
  state.template.occurrenceOverrides = [{ id: 1, version: 1, isActive: true, dayType: "SUNDAY", timeSlot: "08:00 AM", templateRevision: 1, occurrenceDate: new Date("2099-10-18T00:00:00Z") }];
  state.template.dayType = "FRIDAY";
  state.template.occurrenceRevision++;
  const restore = installTransactionMock(tx);
  try {
    const service = new MassScheduleService();
    const moved = await service.getOccurrences(10, "2099-10-18");
    assert.equal(moved.occurrences.length, 1);
    assert.equal(moved.occurrences[0].date, "2099-10-23");
    assert.equal(moved.occurrences[0].layMinisterAssigned, false);
    assert.equal(moved.outdatedOverrides.length, 1);
    state.template.isActive = false;
    const archived = await service.getOccurrences(10, "2099-10-18");
    assert.equal(archived.occurrences.length, 0);
    const item = archived.outdatedOverrides[0];
    await service.setOccurrenceLayMinister(10, 7, item.date, { weekStart: item.weekStart, availabilityToken: item.availabilityToken }, 901, false);
    assert.equal(state.template.occurrenceOverrides[0].isActive, false);
  } finally { restore(); }
});

test("an unresolved legacy appointment is UNKNOWN in the weekly availability preview", async () => {
  const { tx } = occurrenceFixture();
  tx.schedule.findMany = async () => [{ id: 1, requestedDate: new Date("2099-10-18T00:00:00Z"), status: "CONFIRMED" }];
  const restore = installTransactionMock(tx);
  try {
    const week = await new MassScheduleService().getOccurrences(10, "2099-10-18");
    assert.equal(week.occurrences[0].classification, "UNKNOWN");
  } finally { restore(); }
});
