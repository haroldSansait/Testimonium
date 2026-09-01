import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { getAvailabilityDates, getAvailableSlots } from "../controllers/ScheduleController.js";
import { resolveEventType } from "../shared/EventTypeCatalog.js";
import { createScheduleSchema } from "../validators/scheduleSchemas.js";
import { computeSchedulePayloadHash } from "../services/IdempotencyService.js";
import {
  parseManilaDateTime,
  parseManilaDateOnly,
  getManilaDateString,
} from "../services/ConflictHelper.js";
import { isScheduleElapsed, ScheduleService } from "../services/ScheduleService.js";
import {
  CANONICAL_SCHEDULE_EVENT_TYPES,
  MAX_HORIZON_DAYS,
  validateDateHorizon,
  validateCanonicalEventType,
  validateParishAndOffice,
  validateParishAvailability,
  PARISH_BOOKING_BLOCK_TYPES,
  validateSlotAndCapacity,
  validatePriestConflict,
  getManilaHorizonMaxDate,
} from "../services/BookingValidator.js";
import {
  getParishSchedulingConfiguration,
  validateSchedulingSettingsForSave,
} from "../services/SchedulingConfiguration.js";

const persistedWeekdayRules = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
].map((weekday) => ({ weekday, isAvailable: true }));

test("Phase 5A: availability endpoints use the generated Parish.availabilities relation", async () => {
  const parishModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "Parish");
  const parishRelations = parishModel.fields.filter((field) => field.kind === "object").map((field) => field.name);
  assert.ok(parishRelations.includes("availabilities"));
  assert.equal(parishRelations.includes("serviceBlocks"), false);

  const originalFindUnique = prisma.parish.findUnique;
  const originalFindMany = prisma.schedule.findMany;
  const seenQueries = [];
  let parishAvailabilities = [];

  prisma.parish.findUnique = async (query) => {
    seenQueries.push(query);
    assert.deepEqual(query.include.availabilities, {
      where: { type: { in: PARISH_BOOKING_BLOCK_TYPES } },
    });
    assert.equal(query.include.weekdayRules, true);
    assert.equal(query.include.serviceWeekdayRules, true);
    assert.deepEqual(query.include.scheduleDateRules.include, { serviceOverrides: true });
    return {
      id: 2,
      isActive: true,
      officeHours: null,
      eventSettings: {
        availableEvents: ["BAPTISM", "WEDDING"],
        timeSlots: ["08:00 AM", "09:30 AM"],
        capacitySettings: { dailyLimit: 3, slotCapacity: 1 },
      },
      availabilities: parishAvailabilities,
      weekdayRules: persistedWeekdayRules,
      serviceWeekdayRules: [],
      scheduleDateRules: [],
    };
  };
  prisma.schedule.findMany = async () => [];

  const makeResponse = () => {
    const response = { statusCode: null, body: null };
    response.status = (statusCode) => {
      response.statusCode = statusCode;
      return response;
    };
    response.json = (body) => {
      response.body = body;
      return response;
    };
    return response;
  };

  try {
    const datesResponse = makeResponse();
    await getAvailabilityDates(
      { query: { parishId: "2", eventType: "BAPTISM" }, user: { id: 42, role: "PARISHIONER" } },
      datesResponse,
      (error) => { throw error; }
    );
    assert.equal(datesResponse.statusCode, 200);
    assert.equal(datesResponse.body.success, true);
    assert.equal(datesResponse.body.data.eventType, "BAPTISM");
    assert.ok(Array.isArray(datesResponse.body.data.dates));

    const slotsResponse = makeResponse();
    const tomorrow = getManilaHorizonMaxDate(new Date(), 1);
    await getAvailableSlots(
      { query: { parishId: "2", date: tomorrow, eventType: "WEDDING" }, user: { id: 42, role: "PARISHIONER" } },
      slotsResponse,
      (error) => { throw error; }
    );
    assert.equal(slotsResponse.statusCode, 200);
    assert.equal(slotsResponse.body.success, true);
    assert.deepEqual(slotsResponse.body.data, ["08:00 AM", "09:30 AM"]);

    parishAvailabilities = [{
      type: "FULLY_BOOKED",
      title: "Already fully booked",
      startDate: new Date(`${tomorrow}T00:00:00.000Z`),
      endDate: new Date(`${tomorrow}T00:00:00.000Z`),
    }];
    const blockedSlotsResponse = makeResponse();
    await getAvailableSlots(
      { query: { parishId: "2", date: tomorrow, eventType: "WEDDING" }, user: { id: 42, role: "PARISHIONER" } },
      blockedSlotsResponse,
      (error) => { throw error; }
    );
    assert.equal(blockedSlotsResponse.statusCode, 200);
    assert.deepEqual(blockedSlotsResponse.body.data, []);
    assert.equal(seenQueries.length, 3);
  } finally {
    prisma.parish.findUnique = originalFindUnique;
    prisma.schedule.findMany = originalFindMany;
  }
});

test("Phase 5A: Exactly 16 canonical ScheduleEventType values present and resolvable", () => {
  assert.equal(CANONICAL_SCHEDULE_EVENT_TYPES.length, 16);
  for (const eventType of CANONICAL_SCHEDULE_EVENT_TYPES) {
    const resolved = resolveEventType(eventType);
    assert.equal(resolved, eventType, `Failed to resolve canonical event type: ${eventType}`);
  }

  // Common aliases resolve to canonical enums
  assert.equal(resolveEventType("wedding"), "WEDDING");
  assert.equal(resolveEventType("Marriage Canonical Interview"), "WEDDING");
  assert.equal(resolveEventType("marriage special"), "MARRIAGE_SPECIAL");
  assert.equal(resolveEventType("Christening"), "BAPTISM");
  assert.equal(resolveEventType("sick call"), "ANOINTING_OF_THE_SICK");
  assert.equal(resolveEventType("red mass"), "MASS_OF_HOLY_SPIRIT");
  assert.equal(resolveEventType("house blessing"), "BLESSING");
  assert.equal(resolveEventType("non_existent_event_type"), null);
});

test("Phase 5A: scheduling configuration never falls back to fabricated services, slots, or capacity", () => {
  const missing = getParishSchedulingConfiguration({ id: 1, isActive: true, eventSettings: null });
  assert.equal(missing.isConfigured, false);
  assert.deepEqual(missing.enabledServices, []);
  assert.deepEqual(missing.timeSlots, []);
  assert.equal(missing.dailyCapacity, null);
  assert.equal(missing.slotCapacity, null);

  const saved = validateSchedulingSettingsForSave({
    availableEvents: ["BAPTISM", "BAPTISM"],
    timeSlots: ["8:00 am", "08:00 AM"],
    capacitySettings: { dailyLimit: 4, slotCapacity: 2 },
  });
  assert.deepEqual(saved.availableEvents, ["BAPTISM"]);
  assert.deepEqual(saved.timeSlots, ["08:00 AM"]);

  assert.throws(
    () => validateSchedulingSettingsForSave({ availableEvents: ["BAPTISM"], timeSlots: [], capacitySettings: { dailyLimit: 0, slotCapacity: 1 } }),
    (err) => err.code === "SCHEDULING_CONFIGURATION_INCOMPLETE"
  );
});

test("Phase 5A: createScheduleSchema validates all 16 canonical types and rejects invalid input", () => {
  for (const eventType of CANONICAL_SCHEDULE_EVENT_TYPES) {
    const parsed = createScheduleSchema.safeParse({
      parishId: 1,
      eventType,
      date: "2026-09-01",
      timeSlot: "08:00 AM",
      remarks: "Sample remarks",
    });
    assert.equal(parsed.success, true, `Validation failed for event type: ${eventType}`);
  }

  const invalid = createScheduleSchema.safeParse({
    parishId: 1,
    eventType: "INVALID_SACRAMENT",
    date: "2026-09-01",
    timeSlot: "08:00 AM",
  });
  assert.equal(invalid.success, false);
});

test("Phase 5A: Manila timezone date parsing and formatting", () => {
  const dateStr = "2026-08-25";
  const parsed = parseManilaDateOnly(dateStr);
  assert.ok(parsed);
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 8);
  assert.equal(parsed.day, 25);
  assert.equal(parsed.dateStr, "2026-08-25");
  assert.equal(parsed.dayName, "tuesday");

  const dt = parseManilaDateTime(dateStr, "09:30 AM");
  assert.ok(dt);
  assert.equal(dt.toISOString().startsWith("2026-08-25T01:30:00.000Z"), true); // 09:30 UTC+8 is 01:30 UTC
});

test("Phase 5A: computeSchedulePayloadHash canonical equality and changes across all 5 fields", () => {
  const base = {
    parishId: 1,
    eventType: "BAPTISM",
    requestedDate: "2026-09-01",
    timeSlot: "08:00 AM",
    remarks: "Notes",
  };

  const samePayloadNormalized = {
    parishId: "1",
    eventType: "baptism",
    requestedDate: "2026-09-01T00:00:00.000Z",
    timeSlot: " 08:00 AM ",
    remarks: "  Notes  ",
  };

  const slotChanged = { ...base, timeSlot: "09:30 AM" };
  const dateChanged = { ...base, requestedDate: "2026-09-02" };
  const parishChanged = { ...base, parishId: 2 };
  const eventChanged = { ...base, eventType: "WEDDING" };
  const remarksChanged = { ...base, remarks: "Updated notes" };

  const hash1 = computeSchedulePayloadHash(base);
  const hash2 = computeSchedulePayloadHash(samePayloadNormalized);
  assert.equal(hash1, hash2, "Identical logical payload must have identical hash");

  assert.notEqual(hash1, computeSchedulePayloadHash(slotChanged));
  assert.notEqual(hash1, computeSchedulePayloadHash(dateChanged));
  assert.notEqual(hash1, computeSchedulePayloadHash(parishChanged));
  assert.notEqual(hash1, computeSchedulePayloadHash(eventChanged));
  assert.notEqual(hash1, computeSchedulePayloadHash(remarksChanged));
});

test("Phase 5A: Upcoming vs History exact time and boundary instant classification", () => {
  // Reference time: 2026-08-25 at 10:00:00.000 AM Manila (02:00:00.000Z)
  const now = new Date("2026-08-25T02:00:00.000Z");

  // Same day, earlier slot: 08:00 AM - 09:00 AM Manila (elapsed)
  const sameDayPast = {
    status: "CONFIRMED",
    requestedDate: new Date("2026-08-25T00:00:00.000+08:00"),
    startDatetime: new Date("2026-08-25T08:00:00.000+08:00"),
    endDatetime: new Date("2026-08-25T09:00:00.000+08:00"),
  };
  assert.equal(isScheduleElapsed(sameDayPast, now), true, "Earlier same-day slot must be elapsed");

  // Exact boundary: endDatetime is exactly 10:00:00.000 AM Manila (02:00:00.000Z) -> elapsed!
  const exactEnd = {
    status: "CONFIRMED",
    requestedDate: new Date("2026-08-25T00:00:00.000+08:00"),
    startDatetime: new Date("2026-08-25T09:00:00.000+08:00"),
    endDatetime: new Date("2026-08-25T02:00:00.000Z"),
  };
  assert.equal(isScheduleElapsed(exactEnd, now), true, "Exact boundary instant must be elapsed (now >= end)");

  // Same day, later slot: 02:00 PM Manila (not elapsed)
  const sameDayFuture = {
    status: "CONFIRMED",
    requestedDate: new Date("2026-08-25T00:00:00.000+08:00"),
    startDatetime: new Date("2026-08-25T14:00:00.000+08:00"),
    endDatetime: new Date("2026-08-25T15:00:00.000+08:00"),
  };
  assert.equal(isScheduleElapsed(sameDayFuture, now), false, "Later same-day slot must NOT be elapsed");

  // Future day: 2026-08-26 (not elapsed)
  const futureDay = {
    status: "CONFIRMED",
    requestedDate: new Date("2026-08-26T00:00:00.000+08:00"),
    startDatetime: new Date("2026-08-26T08:00:00.000+08:00"),
  };
  assert.equal(isScheduleElapsed(futureDay, now), false);

  // Past day: 2026-08-24 (elapsed)
  const pastDay = {
    status: "CONFIRMED",
    requestedDate: new Date("2026-08-24T00:00:00.000+08:00"),
    startDatetime: new Date("2026-08-24T08:00:00.000+08:00"),
  };
  assert.equal(isScheduleElapsed(pastDay, now), true);
});

test("Phase 5A: Shared BookingValidator - 90-Day Manila Horizon Parity", () => {
  // Reference date: 2026-08-25 at 08:00 AM Manila (00:00:00.000Z)
  const now = new Date("2026-08-25T00:00:00.000Z");
  const todayStr = "2026-08-25";

  // Today (Day 0) is valid for future slot
  const validToday = validateDateHorizon(todayStr, "11:00 AM", now);
  assert.equal(validToday.dateStr, todayStr);

  // Day 90 (inclusive) is valid
  const maxHorizonStr = getManilaHorizonMaxDate(now, 90);
  const validMax = validateDateHorizon(maxHorizonStr, "08:00 AM", now);
  assert.equal(validMax.dateStr, maxHorizonStr);

  // Day 91 (outside 90-day horizon) must throw 400 DATE_OUT_OF_HORIZON
  const day91Parsed = parseManilaDateOnly(maxHorizonStr);
  const day91Utc = new Date(Date.UTC(day91Parsed.year, day91Parsed.month - 1, day91Parsed.day + 1, 0, 0, 0));
  const day91Str = getManilaDateString(day91Utc);

  assert.throws(
    () => validateDateHorizon(day91Str, "08:00 AM", now),
    (err) => err.code === "DATE_OUT_OF_HORIZON" && err.statusCode === 400
  );

  // Past date must throw 400 DATE_IN_PAST
  assert.throws(
    () => validateDateHorizon("2026-08-24", "08:00 AM", now),
    (err) => err.code === "DATE_IN_PAST" && err.statusCode === 400
  );

  // Same-day past slot must throw 400 TIME_IN_PAST
  // (08:00 AM slot is past when now is 10:00 AM Manila / 02:00:00Z)
  const now10Am = new Date("2026-08-25T02:00:00.000Z");
  assert.throws(
    () => validateDateHorizon(todayStr, "08:00 AM", now10Am),
    (err) => err.code === "TIME_IN_PAST" && err.statusCode === 400
  );
});

test("Phase 5A: Shared BookingValidator - Event Types, Office Hours, Availability, and Capacities", () => {
  // 1. Canonical event type
  assert.equal(validateCanonicalEventType("BAPTISM"), "BAPTISM");
  assert.equal(validateCanonicalEventType("wedding"), "WEDDING");
  assert.throws(
    () => validateCanonicalEventType("UNKNOWN_EVENT"),
    (err) => err.code === "INVALID_EVENT_TYPE" && err.statusCode === 400
  );

  // 2. Parish inactive
  assert.throws(
    () => validateParishAndOffice({ isActive: false }, "monday"),
    (err) => err.code === "PARISH_INACTIVE" && err.statusCode === 400
  );

  // 3. Office hours closed day
  const closedParish = {
    isActive: true,
    officeHours: { monday: { isClosed: true } },
  };
  assert.throws(
    () => validateParishAndOffice(closedParish, "monday"),
    (err) => err.code === "OFFICE_CLOSED" && err.statusCode === 400
  );

  // 4. Canonical parish availability block
  const blockedParishAvailability = [
    {
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-05T00:00:00.000Z"),
      type: "PARISH_CLOSED",
      title: "Church renovation",
    },
  ];
  assert.throws(
    () => validateParishAvailability(blockedParishAvailability, "2026-09-03"),
    (err) => err.code === "PARISH_CLOSED" && err.statusCode === 409
  );
  assert.equal(validateParishAvailability(blockedParishAvailability, "2026-09-06"), true);
  assert.deepEqual(PARISH_BOOKING_BLOCK_TYPES, ["PARISH_CLOSED", "SECRETARY_LEAVE", "FULLY_BOOKED"]);

  // 5. Explicit parish time slots and capacities
  const configuredSlots = ["08:00 AM", "09:30 AM"];
  assert.throws(
    () => validateSlotAndCapacity(configuredSlots, [], "01:15 PM", 10, 1),
    (err) => err.code === "SLOT_NOT_CONFIGURED" && err.statusCode === 400
  );

  // Slot capacity
  const existingBookings = [
    { status: "CONFIRMED", remarks: "Time Slot: 08:00 AM." },
  ];
  assert.throws(
    () => validateSlotAndCapacity(configuredSlots, existingBookings, "08:00 AM", 10, 1),
    (err) => err.code === "FULLY_BOOKED" && err.statusCode === 409
  );

  // Different slot has capacity
  assert.equal(
    validateSlotAndCapacity(configuredSlots, existingBookings, "09:30 AM", 10, 1),
    true
  );

  // 6. Assigned priest conflict
  const priestSchedules = [
    { id: 10, status: "CONFIRMED", requestedDate: new Date("2026-09-01T00:00:00.000Z"), remarks: "Time Slot: 08:00 AM." },
  ];
  assert.throws(
    () => validatePriestConflict(priestSchedules, [], "2026-09-01", "08:00 AM"),
    (err) => err.code === "SCHEDULE_CONFLICT" && err.statusCode === 409
  );
});

test("Phase 5A: respondReschedule strict role and tenant ownership authorization", async () => {
  const service = new ScheduleService();

  // Non-parishioner role must be rejected with 403 FORBIDDEN
  await assert.rejects(
    async () => {
      await service.respondReschedule(999, true, 10, "SECRETARY");
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await service.respondReschedule(999, true, 10, "PRIEST");
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await service.respondReschedule(999, true, 10, "DIOCESE_COORDINATOR");
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    }
  );
});

test("Phase 5B: schedule idempotency uses the generated Int contract and rolls back failed persistence", async () => {
  const scheduleModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "Schedule");
  const idempotencyModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "IdempotencyKey");
  assert.equal(scheduleModel.fields.find((field) => field.name === "id").type, "Int");
  assert.equal(idempotencyModel.fields.find((field) => field.name === "resourceId").type, "Int");

  const state = { schedules: [], keys: [], nextScheduleId: 1, failIdempotencyPersistence: false };
  const parish = {
    id: 51,
    isActive: true,
    officeHours: null,
    availabilities: [],
    eventSettings: {
      availableEvents: ["BAPTISM"],
      timeSlots: ["08:00 AM"],
      capacitySettings: { dailyLimit: 10, slotCapacity: 10 },
    },
  };
  const cloneState = () => ({
    schedules: state.schedules.map((schedule) => ({ ...schedule })),
    keys: state.keys.map((key) => ({ ...key })),
    nextScheduleId: state.nextScheduleId,
  });
  const restoreState = (snapshot) => {
    state.schedules = snapshot.schedules;
    state.keys = snapshot.keys;
    state.nextScheduleId = snapshot.nextScheduleId;
  };
  const makeTransactionClient = () => ({
    $queryRaw: async () => [{ id: parish.id }],
    parish: {
      findUnique: async () => parish,
    },
    parishWeekdayRule: { findMany: async () => persistedWeekdayRules },
    parishServiceWeekdayRule: { findMany: async () => [] },
    parishScheduleDateRule: { findUnique: async () => null },
    user: {
      findMany: async () => [],
      findUnique: async () => ({ emailNotificationsEnabled: true }),
    },
    notification: { createMany: async () => ({ count: 1 }) },
    emailOutbox: { upsert: async ({ create }) => create },
    schedule: {
      findMany: async () => state.schedules,
      findUnique: async ({ where }) => state.schedules.find((schedule) => schedule.id === where.id) || null,
      create: async ({ data }) => {
        const created = {
          id: state.nextScheduleId++,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: data.userId, fullName: "Test Parishioner", email: "test@example.invalid", contactNumber: null, emailNotificationsEnabled: true },
          parish: { id: data.parishId, parishName: "Test Parish", type: "PARISH", municipalityCity: "Test City" },
        };
        state.schedules.push(created);
        return created;
      },
    },
    idempotencyKey: {
      findUnique: async ({ where }) => {
        const compound = where.userId_key_resourceType;
        return state.keys.find(
          (key) =>
            key.userId === compound.userId &&
            key.key === compound.key &&
            key.resourceType === compound.resourceType
        ) || null;
      },
      create: async ({ data }) => {
        assert.equal(Number.isInteger(data.resourceId), true, "Prisma Int resourceId must receive a number");
        if (state.failIdempotencyPersistence) {
          throw new Error("Simulated idempotency persistence failure");
        }
        if (state.keys.some((key) => key.userId === data.userId && key.key === data.key && key.resourceType === data.resourceType)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const record = { id: state.keys.length + 1, ...data, createdAt: new Date() };
        state.keys.push(record);
        return record;
      },
    },
  });

  const originals = {
    parishFindUnique: prisma.parish.findUnique,
    scheduleFindMany: prisma.schedule.findMany,
    scheduleFindUnique: prisma.schedule.findUnique,
    scheduleCreate: prisma.schedule.create,
    idempotencyFindUnique: prisma.idempotencyKey.findUnique,
    idempotencyCreate: prisma.idempotencyKey.create,
    transaction: prisma.$transaction,
  };

  const testClient = makeTransactionClient();
  prisma.parish.findUnique = testClient.parish.findUnique;
  prisma.schedule.findMany = testClient.schedule.findMany;
  prisma.schedule.findUnique = testClient.schedule.findUnique;
  prisma.schedule.create = testClient.schedule.create;
  prisma.idempotencyKey.findUnique = testClient.idempotencyKey.findUnique;
  prisma.idempotencyKey.create = testClient.idempotencyKey.create;
  prisma.$transaction = async (callback) => {
    const snapshot = cloneState();
    try {
      return await callback(makeTransactionClient());
    } catch (error) {
      restoreState(snapshot);
      throw error;
    }
  };

  try {
    const service = new ScheduleService();
    const payload = {
      userId: 701,
      parishId: parish.id,
      eventType: "BAPTISM",
      displayTitle: "Baptism",
      requestedDate: getManilaHorizonMaxDate(new Date(), 1),
      timeSlot: "08:00 AM",
      remarks: "Canonical remarks",
    };
    const key = "schedule-idempotency-regression-key";

    const first = await service.create(payload, key);
    assert.equal(first.isReplay, false);
    assert.equal(state.schedules.length, 1);
    assert.equal(state.keys.length, 1);
    assert.equal(typeof state.keys[0].resourceId, "number");
    assert.equal(state.keys[0].resourceId, first.schedule.id);

    const replay = await service.create({ ...payload }, key);
    assert.equal(replay.isReplay, true);
    assert.equal(replay.schedule.id, first.schedule.id);
    assert.equal(state.schedules.length, 1, "same key and payload must not create a duplicate schedule");

    await assert.rejects(
      () => service.create({ ...payload, remarks: "Changed semantic remarks" }, key),
      (error) => error.statusCode === 409 && error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH"
    );
    assert.equal(state.schedules.length, 1, "payload mismatch must not create a second schedule");

    const differentUser = await service.create({ ...payload, userId: 702 }, key);
    assert.equal(differentUser.isReplay, false);
    assert.notEqual(differentUser.schedule.id, first.schedule.id);
    assert.equal(state.keys.filter((record) => record.key === key).length, 2);

    state.failIdempotencyPersistence = true;
    const scheduleCountBeforeFailure = state.schedules.length;
    const keyCountBeforeFailure = state.keys.length;
    await assert.rejects(
      () => service.create({ ...payload, userId: 703, remarks: "Rollback verification" }, "schedule-idempotency-failure-key"),
      /Simulated idempotency persistence failure/
    );
    assert.equal(state.schedules.length, scheduleCountBeforeFailure, "failed idempotency persistence must roll back the schedule row");
    assert.equal(state.keys.length, keyCountBeforeFailure, "failed idempotency persistence must not create an idempotency row");
  } finally {
    prisma.parish.findUnique = originals.parishFindUnique;
    prisma.schedule.findMany = originals.scheduleFindMany;
    prisma.schedule.findUnique = originals.scheduleFindUnique;
    prisma.schedule.create = originals.scheduleCreate;
    prisma.idempotencyKey.findUnique = originals.idempotencyFindUnique;
    prisma.idempotencyKey.create = originals.idempotencyCreate;
    prisma.$transaction = originals.transaction;
  }
});

test("Phase 5B: error handler preserves safe conflict codes and never returns internal 5xx details", () => {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const request = {
    method: "POST",
    originalUrl: "/api/v1/schedule-requests",
    user: { id: 701 },
    ip: "127.0.0.1",
    headers: {},
  };
  const internalError = new Error("Invalid prisma.idempotencyKey.create() invocation");

  errorHandler(internalError, request, response, () => {});
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, "TESTIMONIUM encountered an internal server error.");
  assert.deepEqual(response.body.errors, []);
  assert.equal(response.body.code, undefined);
  assert.equal(response.body.stack, undefined);

  const conflictError = new Error("The selected slot is fully booked.");
  conflictError.statusCode = 409;
  conflictError.code = "SLOT_CAPACITY_EXCEEDED";
  errorHandler(conflictError, request, response, () => {});
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "SLOT_CAPACITY_EXCEEDED");
  assert.equal(response.body.message, "The selected slot is fully booked.");
});
