import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { ParishEventService } from "../services/ParishEventService.js";

function setupMockState() {
  const persistedNotifications = [];
  const futureSunday = new Date();
  futureSunday.setUTCHours(0, 0, 0, 0);
  futureSunday.setUTCDate(futureSunday.getUTCDate() + 7);
  while (futureSunday.getUTCDay() !== 0) {
    futureSunday.setUTCDate(futureSunday.getUTCDate() + 1);
  }
  const futureSundayStart = new Date(futureSunday);
  futureSundayStart.setUTCHours(1, 0, 0, 0);
  const futureSundayEnd = new Date(futureSunday);
  futureSundayEnd.setUTCHours(2, 0, 0, 0);
  const state = {
    schedules: [
      {
        id: 101,
        userId: 501,
        parishId: 10,
        eventType: "BAPTISM",
        displayTitle: "Baptism of John",
        status: "PENDING",
        requestedDate: new Date("2026-09-10T00:00:00.000Z"),
        startDatetime: new Date("2026-09-10T01:00:00.000Z"),
        endDatetime: new Date("2026-09-10T02:00:00.000Z"),
        proposedDate: null,
        proposedStartDatetime: null,
        proposedEndDatetime: null,
        rescheduleReason: null,
        assignedPriestId: null,
        priestResponseStatus: null,
        priestResponseReason: null,
        processedById: null,
        proposalVersion: 1,
        version: 1,
        updatedAt: new Date("2026-08-31T00:00:00.000Z"),
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
        user: { id: 501, fullName: "Juan Dela Cruz", email: "juan@example.test", emailNotificationsEnabled: true },
        parish: {
          id: 10,
          parishName: "San Pedro Parish",
          isActive: true,
          officeHours: null,
          eventSettings: {
            availableEvents: ["BAPTISM", "WEDDING"],
            timeSlots: ["09:00 AM"],
            capacitySettings: { dailyLimit: 10, slotCapacity: 5 },
          },
          availabilities: [],
        },
        assignedPriest: null,
      },
      {
        id: 102,
        userId: 502,
        parishId: 10,
        eventType: "WEDDING",
        displayTitle: "Wedding of Santos",
        status: "PROPOSED_RESCHEDULE",
        requestedDate: new Date("2026-09-15T00:00:00.000Z"),
        startDatetime: new Date("2026-09-15T01:00:00.000Z"),
        endDatetime: new Date("2026-09-15T02:00:00.000Z"),
        proposedDate: futureSunday,
        proposedStartDatetime: futureSundayStart,
        proposedEndDatetime: futureSundayEnd,
        rescheduleReason: "Priest unavailable on original date",
        assignedPriestId: null,
        priestResponseStatus: null,
        priestResponseReason: null,
        processedById: 901,
        proposalVersion: 1,
        version: 1,
        updatedAt: new Date("2026-08-31T00:00:00.000Z"),
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
        user: { id: 502, fullName: "Maria Clara", email: "maria@example.test", emailNotificationsEnabled: true },
        parish: {
          id: 10,
          parishName: "San Pedro Parish",
          isActive: true,
          officeHours: null,
          eventSettings: {
            availableEvents: ["BAPTISM", "WEDDING"],
            timeSlots: ["09:00 AM"],
            capacitySettings: { dailyLimit: 10, slotCapacity: 5 },
          },
          availabilities: [],
        },
        assignedPriest: null,
      },
    ],
    events: [
      {
        id: 301,
        parishId: 10,
        title: "Parish Fiesta Mass",
        eventType: "FIESTA",
        eventDate: new Date("2026-09-25T00:00:00.000Z"),
        startTime: "09:00 AM",
        endTime: "10:30 AM",
        assignedPriestId: null,
        visibility: "PUBLIC",
        version: 1,
        isActive: true,
        parish: { id: 10, parishName: "San Pedro Parish" },
        assignedPriest: null,
      },
    ],
    notifications: persistedNotifications,
    nextEventId: 302,
  };

  const cloneState = () => ({
    schedules: state.schedules.map((s) => ({ ...s })),
    events: state.events.map((e) => ({ ...e })),
    notifications: [...state.notifications],
  });

  const restoreState = (snapshot) => {
    state.schedules = snapshot.schedules;
    state.events = snapshot.events;
    state.notifications.length = 0;
    state.notifications.push(...snapshot.notifications);
  };

  const makeMockClient = () => ({
    $queryRaw: async () => [{ id: 10 }],
    parish: {
      findUnique: async () => ({
        id: 10,
        isActive: true,
        officeHours: null,
        eventSettings: {
          availableEvents: ["BAPTISM", "WEDDING"],
          timeSlots: ["09:00 AM"],
          capacitySettings: { dailyLimit: 10, slotCapacity: 5 },
        },
        availabilities: [],
        weekdayRules: [
          { weekday: "MONDAY", isAvailable: true },
          { weekday: "TUESDAY", isAvailable: true },
          { weekday: "WEDNESDAY", isAvailable: true },
          { weekday: "THURSDAY", isAvailable: true },
          { weekday: "FRIDAY", isAvailable: true },
          { weekday: "SATURDAY", isAvailable: true },
          { weekday: "SUNDAY", isAvailable: true },
        ],
        serviceWeekdayRules: [],
        scheduleDateRules: [],
      }),
    },
    parishWeekdayRule: {
      findMany: async () => [
        { weekday: "MONDAY", isAvailable: true },
        { weekday: "TUESDAY", isAvailable: true },
        { weekday: "WEDNESDAY", isAvailable: true },
        { weekday: "THURSDAY", isAvailable: true },
        { weekday: "FRIDAY", isAvailable: true },
        { weekday: "SATURDAY", isAvailable: true },
        { weekday: "SUNDAY", isAvailable: true },
      ],
    },
    parishServiceWeekdayRule: {
      findMany: async () => [],
    },
    parishScheduleDateRule: {
      findUnique: async () => null,
    },
    user: {
      findMany: async () => [],
      findUnique: async ({ where }) => ({
        id: where.id,
        fullName: "Father Thomas",
        emailNotificationsEnabled: true,
        status: "ACTIVE",
        parishId: 10,
        role: { roleName: "PRIEST" },
      }),
    },
    activityLog: {
      create: async () => ({}),
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
        return { count: data.length };
      },
    },
    emailOutbox: {
      upsert: async ({ create }) => create,
    },
    scheduleHistory: {
      create: async ({ data }) => data,
    },
    parishAvailability: {
      findFirst: async () => null,
    },
    massScheduleTemplate: {
      findMany: async () => [],
    },
    priestPersonalSchedule: {
      findFirst: async () => null,
    },
    schedule: {
      findUnique: async ({ where }) => {
        const item = state.schedules.find((s) => s.id === where.id);
        return item ? { ...item } : null;
      },
      findMany: async () => state.schedules,
      findFirst: async () => null,
      updateMany: async ({ where, data }) => {
        const idx = state.schedules.findIndex(
          (schedule) => schedule.id === where.id && schedule.version === where.version
        );
        if (idx === -1) return { count: 0 };
        const current = state.schedules[idx];
        state.schedules[idx] = {
          ...current,
          ...data,
          version: current.version + 1,
          proposalVersion: data.proposalVersion?.increment
            ? current.proposalVersion + data.proposalVersion.increment
            : current.proposalVersion,
          updatedAt: new Date(),
        };
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const idx = state.schedules.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error("Schedule not found");
        state.schedules[idx] = {
          ...state.schedules[idx],
          ...data,
          updatedAt: new Date(),
        };
        return {
          ...state.schedules[idx],
          user: { id: state.schedules[idx].userId, fullName: "User", email: "user@test.invalid" },
          parish: { id: state.schedules[idx].parishId, parishName: "San Pedro Parish" },
          assignedPriest: state.schedules[idx].assignedPriestId
            ? { id: state.schedules[idx].assignedPriestId, fullName: "Father Thomas" }
            : null,
        };
      },
    },
    parishEvent: {
      findUnique: async ({ where }) => {
        const item = state.events.find((e) => e.id === where.id);
        return item ? { ...item } : null;
      },
      findMany: async ({ where } = {}) =>
        state.events.filter((event) => {
          if (where?.assignedPriestId !== undefined && event.assignedPriestId !== where.assignedPriestId) return false;
          if (where?.id?.not !== undefined && event.id === where.id.not) return false;
          return true;
        }),
      create: async ({ data }) => {
        const item = {
          id: state.nextEventId++,
          ...data,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          parish: { id: data.parishId, parishName: "San Pedro Parish" },
          assignedPriest: data.assignedPriestId
            ? { id: data.assignedPriestId, fullName: "Father Thomas" }
            : null,
        };
        state.events.push(item);
        return item;
      },
      updateMany: async ({ where, data }) => {
        const idx = state.events.findIndex((e) => e.id === where.id && e.version === where.version);
        if (idx === -1) return { count: 0 };
        state.events[idx] = {
          ...state.events[idx],
          ...data,
          version: state.events[idx].version + 1,
          updatedAt: new Date(),
        };
        return { count: 1 };
      },
    },
  });

  return { state, cloneState, restoreState, makeMockClient };
}

test("Part 4 Invariant A: updateStatus rejects CONFIRMED when no priest is assigned", async () => {
  const { state, cloneState, restoreState, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;
  const origNotificationCreateMany = prisma.notification.createMany;

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ScheduleService();
    // Schedule 101 has assignedPriestId = null
    await assert.rejects(
      async () => {
        await service.updateStatus(101, "CONFIRMED", 901, "SECRETARY", 10, state.schedules[0].version);
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_REQUIRED");
        return true;
      }
    );
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
    prisma.notification.createMany = origNotificationCreateMany;
  }
});

test("Part 4 Invariant B: updateStatus rejects CONFIRMED when priest is assigned but status is PENDING / null", async () => {
  const { state, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;
  const origNotificationCreateMany = prisma.notification.createMany;

  // Set assigned priest but pending response
  state.schedules[0].assignedPriestId = 201;
  state.schedules[0].priestResponseStatus = "PENDING";

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ScheduleService();
    await assert.rejects(
      async () => {
        await service.updateStatus(101, "CONFIRMED", 901, "SECRETARY", 10, state.schedules[0].version);
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_PENDING");
        return true;
      }
    );
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
    prisma.notification.createMany = origNotificationCreateMany;
  }
});

test("Part 4 Invariant C: updateStatus rejects CONFIRMED when priest declined/rejected assignment", async () => {
  const { state, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;
  const origNotificationCreateMany = prisma.notification.createMany;

  state.schedules[0].assignedPriestId = 201;
  state.schedules[0].priestResponseStatus = "REJECTED";

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ScheduleService();
    await assert.rejects(
      async () => {
        await service.updateStatus(101, "CONFIRMED", 901, "SECRETARY", 10, state.schedules[0].version);
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_PENDING");
        return true;
      }
    );
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
    prisma.notification.createMany = origNotificationCreateMany;
  }
});

test("Part 4 Invariant D: updateStatus allows CONFIRMED when priest is assigned AND has ACCEPTED", async () => {
  const { state, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;
  const origNotificationCreateMany = prisma.notification.createMany;

  state.schedules[0].assignedPriestId = 201;
  state.schedules[0].priestResponseStatus = "ACCEPTED";

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ScheduleService();
    const result = await service.updateStatus(101, "CONFIRMED", 901, "SECRETARY", 10, state.schedules[0].version);
    assert.equal(result.status, "CONFIRMED");
    assert.equal(state.schedules[0].status, "CONFIRMED");
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
    prisma.notification.createMany = origNotificationCreateMany;
  }
});

test("Part 4 Invariant E: failed confirmation leaves schedule state intact", async () => {
  const { state, cloneState, restoreState, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;

  state.schedules[0].assignedPriestId = null;
  state.schedules[0].status = "PENDING";

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.$transaction = async (cb) => {
    const snapshot = cloneState();
    try {
      return await cb(mock);
    } catch (e) {
      restoreState(snapshot);
      throw e;
    }
  };

  try {
    const service = new ScheduleService();
    await assert.rejects(
      async () => {
        await service.updateStatus(101, "CONFIRMED", 901, "SECRETARY", 10, state.schedules[0].version);
      }
    );
    assert.equal(state.schedules[0].status, "PENDING");
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
  }
});

test("Part 4 Invariant F: respondReschedule CONFIRMED transition is protected by priest acceptance gate", async () => {
  const { state, cloneState, restoreState, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origTransaction = prisma.$transaction;
  const origParishFindUnique = prisma.parish.findUnique;

  // Schedule 102 is in PROPOSED_RESCHEDULE status with proposedDate set
  state.schedules[1].assignedPriestId = null; // No priest

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.parish.findUnique = mock.parish.findUnique;
  prisma.$transaction = async (cb) => {
    const snapshot = cloneState();
    try {
      return await cb(mock);
    } catch (e) {
      restoreState(snapshot);
      throw e;
    }
  };

  try {
    const service = new ScheduleService();
    // Accepting reschedule when no priest is assigned must be rejected
    await assert.rejects(
      async () => {
        await service.respondReschedule(102, true, 502, "PARISHIONER", state.schedules[1].version);
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, "PRIEST_ASSIGNMENT_REQUIRED");
        return true;
      }
    );

    // Now assign an ACCEPTED priest
    state.schedules[1].assignedPriestId = 201;
    state.schedules[1].priestResponseStatus = "ACCEPTED";

    const accepted = await service.respondReschedule(102, true, 502, "PARISHIONER", state.schedules[1].version);
    assert.equal(accepted.status, "CONFIRMED");
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.$transaction = origTransaction;
    prisma.parish.findUnique = origParishFindUnique;
  }
});

test("Part 6 Schedule Priest Notification G/H/I: genuine assignment notifies priest, same-priest is no-op, new priest is notified", async () => {
  const { state, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.schedule.findUnique;
  const origUpdate = prisma.schedule.update;
  const origNotificationCreateMany = prisma.notification.createMany;
  const origTransaction = prisma.$transaction;

  prisma.schedule.findUnique = mock.schedule.findUnique;
  prisma.schedule.update = mock.schedule.update;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ScheduleService();

    // G: Genuine initial assignment (null -> Priest 201)
    await service.assignPriest(101, 201, 901, "SECRETARY", 10, state.schedules[0].version);
    const priestNotifs1 = state.notifications.filter(
      (n) => n.userId === 201 && n.referenceType === "SCHEDULE_REQUEST" && n.referenceId === 101
    );
    assert.equal(priestNotifs1.length, 1);
    assert.equal(priestNotifs1[0].type, "IN_APP");

    // H: Same-priest reassignment (Priest 201 -> Priest 201) -> no duplicate notification
    state.notifications.length = 0;
    await service.assignPriest(101, 201, 901, "SECRETARY", 10, state.schedules[0].version);
    const priestNotifs2 = state.notifications.filter((n) => n.userId === 201);
    assert.equal(priestNotifs2.length, 0);

    // I: New priest assignment (Priest 201 -> Priest 202) -> Priest 202 notified, response reset to null
    state.notifications.length = 0;
    await service.assignPriest(101, 202, 901, "SECRETARY", 10, state.schedules[0].version);
    const priestNotifs3 = state.notifications.filter(
      (n) => n.userId === 202 && n.referenceType === "SCHEDULE_REQUEST" && n.referenceId === 101
    );
    assert.equal(priestNotifs3.length, 1);
    assert.equal(state.schedules[0].priestResponseStatus, "PENDING");
  } finally {
    prisma.schedule.findUnique = origFindUnique;
    prisma.schedule.update = origUpdate;
    prisma.notification.createMany = origNotificationCreateMany;
    prisma.$transaction = origTransaction;
  }
});

test("Part 8 Parish Event Priest Notification J: creates GENERAL notification for assigned priest on create and update", async () => {
  const { state, makeMockClient } = setupMockState();
  const mock = makeMockClient();
  const origFindUnique = prisma.parishEvent.findUnique;
  const origCreate = prisma.parishEvent.create;
  const origUpdateMany = prisma.parishEvent.updateMany;
  const origNotificationCreateMany = prisma.notification.createMany;
  const origActivityLog = prisma.activityLog;
  const origTransaction = prisma.$transaction;

  prisma.parishEvent.findUnique = mock.parishEvent.findUnique;
  prisma.parishEvent.create = mock.parishEvent.create;
  prisma.parishEvent.updateMany = mock.parishEvent.updateMany;
  prisma.notification.createMany = mock.notification.createMany;
  prisma.activityLog = { create: async () => ({}) };
  prisma.$transaction = async (cb) => cb(mock);

  try {
    const service = new ParishEventService();

    // 1. Create event with assigned priest 201
    state.notifications.length = 0;
    const created = await service.createEvent(
      10,
      {
        title: "Youth Vigil",
        eventType: "YOUTH_MINISTRY",
        eventDate: "2026-09-30",
        startTime: "06:00 PM",
        endTime: "08:00 PM",
        assignedPriestId: 201,
        visibility: "PUBLIC",
      },
      901
    );

    const createNotifs = state.notifications.filter(
      (n) => n.userId === 201 && n.referenceType === "GENERAL" && n.referenceId === null
    );
    assert.equal(createNotifs.length, 1);
    assert.equal(createNotifs[0].type, "IN_APP");

    // 2. Update event with new assigned priest 202
    state.notifications.length = 0;
    await service.updateEvent(
      created.id,
      {
        title: "Youth Vigil Updated",
        eventType: "YOUTH_MINISTRY",
        assignedPriestId: 202,
        expectedVersion: 1,
      },
      901
    );

    const updateNotifs = state.notifications.filter(
      (n) => n.userId === 202 && n.referenceType === "GENERAL" && n.referenceId === null
    );
    assert.equal(updateNotifs.length, 1);

    // 3. Update event keeping same priest 202 -> no duplicate notification
    state.notifications.length = 0;
    await service.updateEvent(
      created.id,
      {
        title: "Youth Vigil Final",
        eventType: "YOUTH_MINISTRY",
        assignedPriestId: 202,
        expectedVersion: 2,
      },
      901
    );
    assert.equal(state.notifications.length, 0);
  } finally {
    prisma.parishEvent.findUnique = origFindUnique;
    prisma.parishEvent.create = origCreate;
    prisma.parishEvent.updateMany = origUpdateMany;
    prisma.notification.createMany = origNotificationCreateMany;
    prisma.activityLog = origActivityLog;
    prisma.$transaction = origTransaction;
  }
});
