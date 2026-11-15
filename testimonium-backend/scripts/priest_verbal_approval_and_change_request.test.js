import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { ScheduleService, attachParishSecretaries } from "../services/ScheduleService.js";
import { ConflictHelper } from "../services/ConflictHelper.js";
import { NotificationDispatcher } from "../services/NotificationDispatcher.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { assignPriestSchema, requestPriestChangeSchema } from "../validators/scheduleSchemas.js";
import * as scheduleController from "../controllers/ScheduleController.js";

function makeBaseSchedule(overrides = {}) {
  return {
    id: 55,
    userId: 500,
    parishId: 10,
    eventType: "BAPTISM",
    displayTitle: "Baptism of Baby",
    requestedDate: new Date("2026-12-10T00:00:00.000Z"),
    startDatetime: new Date("2026-12-10T02:00:00.000Z"),
    endDatetime: new Date("2026-12-10T03:00:00.000Z"),
    remarks: "Time Slot: 10:00 AM. Original booking note.",
    location: "St. Jude Parish",
    status: "PENDING",
    requestedPriestId: 21,
    assignedPriestId: null,
    priestResponseStatus: null,
    priestResponseReason: null,
    priestVerbalApproval: false,
    priestVerbalApprovalById: null,
    priestVerbalApprovalAt: null,
    priestChangeStatus: null,
    priestChangeRequestedPriestId: null,
    priestChangeNote: null,
    priestChangeRequestedAt: null,
    priestChangeResolvedAt: null,
    layMinisterAssigned: false,
    processedById: 90,
    version: 3,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("1. Zod schemas validate verbalApproval and requestPriestChange payloads", () => {
  const withoutFlag = assignPriestSchema.parse({ priestId: 22, expectedVersion: 2 });
  assert.equal(withoutFlag.verbalApproval, false);

  const withFlag = assignPriestSchema.parse({ priestId: 22, expectedVersion: 2, verbalApproval: true });
  assert.equal(withFlag.verbalApproval, true);

  const changeNoNote = requestPriestChangeSchema.parse({
    replacementPriestId: 23,
    expectedVersion: 4,
  });
  assert.equal(changeNoNote.replacementPriestId, 23);
  assert.equal(changeNoNote.note, undefined);

  const changeWithNote = requestPriestChangeSchema.parse({
    replacementPriestId: "24",
    note: "  Prefer Fr. Julius  ",
    expectedVersion: 5,
  });
  assert.equal(changeWithNote.replacementPriestId, 24);
  assert.equal(changeWithNote.note, "Prefer Fr. Julius");

  assert.throws(() => requestPriestChangeSchema.parse({ replacementPriestId: -1, expectedVersion: 1 }));
});

test("2. assignPriest without verbalApproval preserves PENDING and false verbal approval flags", async () => {
  const origFind = prisma.schedule.findUnique;
  const origTx = prisma.$transaction;
  const origConflict = ConflictHelper.checkPriestConflict;
  const origNotify = NotificationDispatcher.notifyPriestAssigned;
  const origAudit = AuditLogService.log;

  const base = makeBaseSchedule();
  let updatedData = null;
  let notifyArgs = null;

  try {
    prisma.schedule.findUnique = async () => base;
    ConflictHelper.checkPriestConflict = async () => undefined;
    NotificationDispatcher.notifyPriestAssigned = async (args) => { notifyArgs = args; };
    AuditLogService.log = async () => true;
    prisma.$transaction = async (cb) => {
      let reads = 0;
      return cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => {
            reads += 1;
            return reads === 1
              ? base
              : {
                  ...base,
                  assignedPriestId: 22,
                  priestResponseStatus: "PENDING",
                  priestVerbalApproval: false,
                  version: 4,
                  assignedPriest: { id: 22, fullName: "Fr. Mario" },
                };
          },
          updateMany: async ({ data }) => {
            updatedData = data;
            return { count: 1 };
          },
        },
        user: {
          findUnique: async () => ({ id: 22, parishId: 10, status: "ACTIVE", role: { roleName: "PRIEST" } }),
        },
        scheduleHistory: { create: async () => ({ id: 1 }) },
        scheduleAlternativeProposal: { findMany: async () => [] },
      });
    };

    const result = await new ScheduleService().assignPriest(55, 22, 90, "SECRETARY", 10, 3);
    assert.equal(updatedData.priestResponseStatus, "PENDING");
    assert.equal(updatedData.priestVerbalApproval, false);
    assert.equal(updatedData.priestVerbalApprovalById, null);
    assert.equal(updatedData.priestVerbalApprovalAt, null);
    assert.equal(notifyArgs.verbalApproval, false);
    assert.equal(result.priestResponseStatus, "PENDING");
  } finally {
    prisma.schedule.findUnique = origFind;
    prisma.$transaction = origTx;
    ConflictHelper.checkPriestConflict = origConflict;
    NotificationDispatcher.notifyPriestAssigned = origNotify;
    AuditLogService.log = origAudit;
  }
});

test("3. assignPriest with verbalApproval records ACCEPTED on secretary's authority without auto-confirming", async () => {
  const origFind = prisma.schedule.findUnique;
  const origTx = prisma.$transaction;
  const origConflict = ConflictHelper.checkPriestConflict;
  const origNotify = NotificationDispatcher.notifyPriestAssigned;
  const origAudit = AuditLogService.log;

  const base = makeBaseSchedule({
    status: "PENDING",
    priestChangeStatus: "PENDING",
    priestChangeRequestedPriestId: 22,
    priestChangeNote: "Please assign Fr. Mario",
  });
  let updatedData = null;
  let historyEntry = null;
  let auditCall = null;
  let notifyArgs = null;

  try {
    prisma.schedule.findUnique = async () => base;
    ConflictHelper.checkPriestConflict = async () => undefined;
    NotificationDispatcher.notifyPriestAssigned = async (args) => { notifyArgs = args; };
    AuditLogService.log = async (userId, action, _tx, _isSystem, extra) => {
      auditCall = { userId, action, extra };
      return true;
    };
    prisma.$transaction = async (cb) => {
      let reads = 0;
      return cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => {
            reads += 1;
            return reads === 1
              ? base
              : {
                  ...base,
                  assignedPriestId: 22,
                  priestResponseStatus: "ACCEPTED",
                  priestVerbalApproval: true,
                  priestVerbalApprovalById: 90,
                  priestChangeStatus: "RESOLVED",
                  status: "PENDING",
                  version: 4,
                  assignedPriest: { id: 22, fullName: "Fr. Mario" },
                  priestVerbalApprovalBy: { id: 90, fullName: "Sec. Anna" },
                  priestChangeRequestedPriest: { id: 22, fullName: "Fr. Mario" },
                };
          },
          updateMany: async ({ data }) => {
            updatedData = data;
            return { count: 1 };
          },
        },
        user: {
          findUnique: async () => ({ id: 22, parishId: 10, status: "ACTIVE", role: { roleName: "PRIEST" } }),
        },
        scheduleHistory: {
          create: async ({ data }) => {
            historyEntry = data;
            return { id: 1 };
          },
        },
        scheduleAlternativeProposal: { findMany: async () => [] },
      });
    };

    const result = await new ScheduleService().assignPriest(55, 22, 90, "SECRETARY", 10, 3, {
      verbalApproval: true,
    });

    assert.equal(updatedData.assignedPriestId, 22);
    assert.equal(updatedData.priestResponseStatus, "ACCEPTED");
    assert.equal(updatedData.priestVerbalApproval, true);
    assert.equal(updatedData.priestVerbalApprovalById, 90);
    assert.ok(updatedData.priestVerbalApprovalAt instanceof Date);
    assert.equal(updatedData.status, "PENDING");
    assert.equal(updatedData.priestChangeStatus, "RESOLVED");
    assert.ok(updatedData.priestChangeResolvedAt instanceof Date);
    assert.equal(historyEntry.actorId, 90);
    assert.equal(historyEntry.actorRole, "SECRETARY");
    assert.match(historyEntry.reason, /verbal approval/i);
    assert.equal(auditCall.userId, 90);
    assert.equal(auditCall.extra.role, "SECRETARY");
    assert.equal(auditCall.extra.metadata.verbalApproval, true);
    assert.equal(auditCall.extra.metadata.recordedBySecretaryId, 90);
    assert.equal(notifyArgs.verbalApproval, true);
    assert.equal(result.priestResponseStatus, "ACCEPTED");
    assert.equal(result.priestVerbalApproval, true);
    assert.equal(result.status, "PENDING");
  } finally {
    prisma.schedule.findUnique = origFind;
    prisma.$transaction = origTx;
    ConflictHelper.checkPriestConflict = origConflict;
    NotificationDispatcher.notifyPriestAssigned = origNotify;
    AuditLogService.log = origAudit;
  }
});

test("4. assignPriest verbalApproval blocks non-secretary, cross-parish, conflicts, and stale version", async () => {
  const origFind = prisma.schedule.findUnique;
  const origTx = prisma.$transaction;
  const origConflict = ConflictHelper.checkPriestConflict;
  const base = makeBaseSchedule({ parishId: 10, version: 3 });

  try {
    prisma.schedule.findUnique = async () => base;

    // Non-secretary (DIOCESE_COORDINATOR cannot bypass secretary verbal approval)
    await assert.rejects(
      () => new ScheduleService().assignPriest(55, 22, 99, "DIOCESE_COORDINATOR", null, 3, { verbalApproval: true }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN_VERBAL_APPROVAL"
    );

    // Cross-parish secretary
    await assert.rejects(
      () => new ScheduleService().assignPriest(55, 22, 91, "SECRETARY", 99, 3, { verbalApproval: true }),
      (err) => err.statusCode === 403
    );

    // Stale expectedVersion
    await assert.rejects(
      () => new ScheduleService().assignPriest(55, 22, 90, "SECRETARY", 10, 2, { verbalApproval: true }),
      (err) => err.statusCode === 409 && err.code === "SCHEDULE_CONCURRENCY_CONFLICT"
    );

    // Priest conflict preserved even with verbalApproval: true
    ConflictHelper.checkPriestConflict = async () => {
      const err = new Error("Priest already has a conflict");
      err.statusCode = 409;
      err.code = "PRIEST_CONFLICT";
      throw err;
    };
    prisma.$transaction = async (cb) =>
      cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: { findUnique: async () => base },
        user: {
          findUnique: async () => ({ id: 22, parishId: 10, status: "ACTIVE", role: { roleName: "PRIEST" } }),
        },
      });
    await assert.rejects(
      () => new ScheduleService().assignPriest(55, 22, 90, "SECRETARY", 10, 3, { verbalApproval: true }),
      (err) => err.statusCode === 409 && err.code === "PRIEST_CONFLICT"
    );
  } finally {
    prisma.schedule.findUnique = origFind;
    prisma.$transaction = origTx;
    ConflictHelper.checkPriestConflict = origConflict;
  }
});

test("5. requestPriestChange resets assignment & verbal approval, reverts CONFIRMED -> PENDING, preserves remarks & requestedPriestId, and notifies admins", async () => {
  const origFind = prisma.schedule.findUnique;
  const origTx = prisma.$transaction;
  const origNotify = NotificationDispatcher.notifyPriestChangeRequested;
  const origAudit = AuditLogService.log;

  const base = makeBaseSchedule({
    status: "CONFIRMED",
    assignedPriestId: 21,
    priestResponseStatus: "ACCEPTED",
    priestVerbalApproval: true,
    priestVerbalApprovalById: 90,
    priestVerbalApprovalAt: new Date("2026-11-10T00:00:00.000Z"),
    requestedPriestId: 22,
    assignedPriest: { id: 21, fullName: "Fr. Wrong" },
    user: { id: 500, fullName: "Juan Dela Cruz" },
    parish: { id: 10, parishName: "St. Jude Parish" },
  });

  let updatedData = null;
  let historyData = null;
  let notifiedPayload = null;
  let auditedPayload = null;

  try {
    prisma.schedule.findUnique = async () => base;
    NotificationDispatcher.notifyPriestChangeRequested = async (payload) => {
      notifiedPayload = payload;
    };
    AuditLogService.log = async (userId, action, _tx, _isSys, extra) => {
      auditedPayload = { userId, action, extra };
      return true;
    };
    prisma.$transaction = async (cb) => {
      let reads = 0;
      return cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => {
            reads += 1;
            return reads === 1
              ? base
              : {
                  ...base,
                  status: "PENDING",
                  assignedPriestId: null,
                  priestResponseStatus: null,
                  priestResponseReason: null,
                  priestVerbalApproval: false,
                  priestVerbalApprovalById: null,
                  priestVerbalApprovalAt: null,
                  priestChangeStatus: "PENDING",
                  priestChangeRequestedPriestId: 22,
                  priestChangeNote: "Please assign Fr. Julius instead.",
                  version: 4,
                  assignedPriest: null,
                  requestedPriest: { id: 22, fullName: "Fr. Julius" },
                  priestChangeRequestedPriest: { id: 22, fullName: "Fr. Julius" },
                  processedBy: {
                    id: 90,
                    fullName: "Sec. Anna",
                    contactNumber: "09171234567",
                    status: "ACTIVE",
                    parishId: 10,
                    role: { roleName: "SECRETARY" },
                  },
                };
          },
          updateMany: async ({ data }) => {
            updatedData = data;
            return { count: 1 };
          },
        },
        user: {
          findUnique: async ({ where }) =>
            where.id === 22
              ? { id: 22, fullName: "Fr. Julius", parishId: 10, status: "ACTIVE", role: { roleName: "PRIEST" } }
              : null,
          findMany: async () => [],
        },
        scheduleHistory: {
          create: async ({ data }) => {
            historyData = data;
            return { id: 1 };
          },
        },
      });
    };

    const result = await new ScheduleService().requestPriestChange(
      55,
      {
        replacementPriestId: 22,
        note: "Please assign Fr. Julius instead.",
        expectedVersion: 3,
      },
      500,
      "PARISHIONER"
    );

    assert.equal(updatedData.status, "PENDING");
    assert.equal(updatedData.assignedPriestId, null);
    assert.equal(updatedData.priestResponseStatus, null);
    assert.equal(updatedData.priestVerbalApproval, false);
    assert.equal(updatedData.priestVerbalApprovalById, null);
    assert.equal(updatedData.priestChangeStatus, "PENDING");
    assert.equal(updatedData.priestChangeRequestedPriestId, 22);
    assert.equal(updatedData.priestChangeNote, "Please assign Fr. Julius instead.");
    assert.equal(result.requestedPriestId, 22);
    assert.equal(result.remarks, base.remarks);
    assert.equal(historyData.actorId, 500);
    assert.equal(historyData.actorRole, "PARISHIONER");
    assert.equal(historyData.priestVerbalApproval, true);
    assert.equal(auditedPayload.action, "Priest Change Requested");
    assert.equal(notifiedPayload.requestedPriestName, "Fr. Julius");
    assert.equal(notifiedPayload.previousPriestName, "Fr. Wrong");
    assert.equal(result.parishSecretary.fullName, "Sec. Anna");
    assert.equal(result.parishSecretary.contactNumber, "09171234567");
  } finally {
    prisma.schedule.findUnique = origFind;
    prisma.$transaction = origTx;
    NotificationDispatcher.notifyPriestChangeRequested = origNotify;
    AuditLogService.log = origAudit;
  }
});

test("6. requestPriestChange rejects wrong owner, same priest, inactive/cross-parish priest, terminal/incompatible state, and stale version", async () => {
  const origFind = prisma.schedule.findUnique;
  const origTx = prisma.$transaction;

  try {
    // Non-owner
    prisma.schedule.findUnique = async () => makeBaseSchedule({ userId: 500, assignedPriestId: 21 });
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 22, expectedVersion: 3 }, 999, "PARISHIONER"),
      (err) => err.statusCode === 403
    );

    // Stale version
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 22, expectedVersion: 1 }, 500, "PARISHIONER"),
      (err) => err.statusCode === 409
    );

    // Same priest as currently assigned
    prisma.schedule.findUnique = async () => makeBaseSchedule({ userId: 500, assignedPriestId: 21, version: 3 });
    prisma.$transaction = async (cb) =>
      cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => makeBaseSchedule({ userId: 500, assignedPriestId: 21, version: 3 }),
        },
      });
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 21, expectedVersion: 3 }, 500, "PARISHIONER"),
      (err) => err.statusCode === 400 && err.code === "SAME_PRIEST_SELECTED"
    );

    // Cross-parish / inactive replacement priest
    prisma.$transaction = async (cb) =>
      cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => makeBaseSchedule({ userId: 500, assignedPriestId: 21, version: 3 }),
        },
        user: {
          findUnique: async () => ({ id: 99, parishId: 99, status: "ACTIVE", role: { roleName: "PRIEST" } }),
        },
      });
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 99, expectedVersion: 3 }, 500, "PARISHIONER"),
      (err) => err.statusCode === 400 && err.code === "INVALID_REQUESTED_PRIEST"
    );

    // Terminal COMPLETED schedule
    prisma.schedule.findUnique = async () => makeBaseSchedule({ userId: 500, status: "COMPLETED", assignedPriestId: 21 });
    prisma.$transaction = async (cb) =>
      cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => makeBaseSchedule({ userId: 500, status: "COMPLETED", assignedPriestId: 21 }),
        },
      });
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 22, expectedVersion: 3 }, 500, "PARISHIONER"),
      (err) => err.statusCode === 400 && err.code === "TERMINAL_STATUS_IMMUTABLE"
    );

    // Incompatible PROPOSED_RESCHEDULE state
    prisma.schedule.findUnique = async () => makeBaseSchedule({ userId: 500, status: "PROPOSED_RESCHEDULE", assignedPriestId: 21 });
    prisma.$transaction = async (cb) =>
      cb({
        $queryRaw: async () => [{ id: 10 }],
        schedule: {
          findUnique: async () => makeBaseSchedule({ userId: 500, status: "PROPOSED_RESCHEDULE", assignedPriestId: 21 }),
        },
      });
    await assert.rejects(
      () => new ScheduleService().requestPriestChange(55, { replacementPriestId: 22, expectedVersion: 3 }, 500, "PARISHIONER"),
      (err) => err.statusCode === 400 && err.code === "INVALID_STATE_TRANSITION"
    );
  } finally {
    prisma.schedule.findUnique = origFind;
    prisma.$transaction = origTx;
  }
});

test("7. Removed priest cannot respond to assignment after requestPriestChange clears assignedPriestId", async () => {
  const origFind = prisma.schedule.findUnique;
  try {
    prisma.schedule.findUnique = async () =>
      makeBaseSchedule({
        assignedPriestId: null,
        priestResponseStatus: null,
        priestChangeStatus: "PENDING",
        version: 4,
      });

    await assert.rejects(
      () => new ScheduleService().respondPriestAssignment(55, 21, "ACCEPTED", null, 4),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );
  } finally {
    prisma.schedule.findUnique = origFind;
  }
});

test("8. attachParishSecretaries prefers active parish SECRETARY processedBy, falls back to first active parish SECRETARY, excludes inactive/other roles", async () => {
  const schedules = [
    {
      id: 1,
      parishId: 10,
      processedBy: {
        id: 100,
        fullName: "Sec. Clara",
        contactNumber: "09170001111",
        status: "ACTIVE",
        parishId: 10,
        role: { roleName: "SECRETARY" },
      },
    },
    {
      id: 2,
      parishId: 20,
      processedBy: {
        id: 200,
        fullName: "Coordinator",
        contactNumber: "09170009999",
        status: "ACTIVE",
        parishId: 20,
        role: { roleName: "DIOCESE_COORDINATOR" },
      },
    },
    {
      id: 3,
      parishId: 30,
      processedBy: null,
    },
  ];

  const fakeClient = {
    user: {
      findMany: async ({ where }) => {
        assert.deepEqual(where.status, "ACTIVE");
        assert.deepEqual(where.role, { roleName: "SECRETARY" });
        return [
          { id: 201, parishId: 20, fullName: "Sec. Marco", contactNumber: "09181112222" },
          { id: 202, parishId: 20, fullName: "Sec. Second", contactNumber: "09183334444" },
        ];
      },
    },
  };

  const enriched = await attachParishSecretaries(schedules, fakeClient);
  assert.deepEqual(enriched[0].parishSecretary, {
    id: 100,
    fullName: "Sec. Clara",
    contactNumber: "09170001111",
  });
  assert.equal(enriched[0].processedBy.contactNumber, undefined);
  assert.deepEqual(enriched[1].parishSecretary, {
    id: 201,
    fullName: "Sec. Marco",
    contactNumber: "09181112222",
  });
  assert.equal(enriched[2].parishSecretary, null);
});

test("9. NotificationDispatcher sends informational notice for verbalApproval and admin redirect notice for requestPriestChange", async () => {
  const origCreateMany = prisma.notification?.createMany;
  const origFindUsers = prisma.user.findMany;
  const createdPayloads = [];

  try {
    prisma.notification.createMany = async ({ data }) => {
      createdPayloads.push(...data);
      return { count: data.length };
    };
    prisma.user.findMany = async ({ where }) => {
      if (where?.role?.roleName === "SECRETARY") return [{ id: 90 }];
      if (where?.role?.roleName === "DIOCESE_COORDINATOR") return [{ id: 99 }];
      return [];
    };

    await NotificationDispatcher.notifyPriestAssigned({
      parishionerId: 500,
      parishId: 10,
      scheduleId: 55,
      displayTitle: "Baptism",
      priestId: 22,
      priestName: "Fr. Mario",
      verbalApproval: true,
    });

    const priestNotif = createdPayloads.find((n) => n.userId === 22);
    assert.match(priestNotif.title, /^Pastoral Assignment Confirmed \(Verbal Approval\)/);
    assert.match(priestNotif.message, /no action is required/i);

    createdPayloads.length = 0;
    await NotificationDispatcher.notifyPriestChangeRequested({
      parishId: 10,
      scheduleId: 55,
      displayTitle: "Baptism",
      requestedPriestName: "Fr. Julius",
      previousPriestName: "Fr. Wrong",
      note: "Prefer Fr. Julius",
    });

    assert.equal(createdPayloads.length, 2);
    for (const notif of createdPayloads) {
      assert.equal(notif.title, "Priest Change Requested");
      assert.equal(notif.referenceType, "SCHEDULE_REQUEST");
      assert.equal(notif.referenceId, 55);
      assert.match(notif.message, /Fr\. Julius/);
    }
  } finally {
    if (origCreateMany) prisma.notification.createMany = origCreateMany;
    prisma.user.findMany = origFindUsers;
  }
});

test("10. ScheduleController.requestPriestChange delegates to service and returns HTTP 200", async () => {
  let capturedArgs = null;
  let statusCode = null;
  let body = null;

  const origMethod = ScheduleService.prototype.requestPriestChange;
  try {
    ScheduleService.prototype.requestPriestChange = async (id, payload, actorId, actorRole) => {
      capturedArgs = { id, payload, actorId, actorRole };
      return { id: 55, status: "PENDING", priestChangeStatus: "PENDING" };
    };

    const req = {
      params: { id: "55" },
      body: { replacementPriestId: 22, note: "Prefer Fr. Julius", expectedVersion: 3 },
      user: { id: 500, role: "PARISHIONER" },
    };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(jsonBody) {
            body = jsonBody;
          },
        };
      },
    };

    await scheduleController.requestPriestChange(req, res, (err) => {
      throw err;
    });

    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(capturedArgs.id, 55);
    assert.equal(capturedArgs.actorId, 500);
    assert.equal(capturedArgs.actorRole, "PARISHIONER");
    assert.equal(capturedArgs.payload.replacementPriestId, 22);
  } finally {
    ScheduleService.prototype.requestPriestChange = origMethod;
  }
});

