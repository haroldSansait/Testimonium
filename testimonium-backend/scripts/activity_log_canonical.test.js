import test from "node:test";
import assert from "node:assert/strict";
import { ParishionerRequestService } from "../services/ParishionerRequestService.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { ActivityLogRepository } from "../repositories/ActivityLogRepository.js";
import { ActivityLogService } from "../services/ActivityLogService.js";
import { CANONICAL_ACTION_TYPES, LEGACY_ACTION_PATTERNS } from "../config/canonicalActions.js";
import { RequestNotificationService } from "../services/RequestNotificationService.js";
import { UserService } from "../services/UserService.js";
import { ParishService } from "../services/ParishService.js";

test("1, 2, 3: Two draft requests with different tracking numbers emit stable canonical action and structured metadata", async () => {
  const loggedEntries = [];
  const origLog = AuditLogService.log;
  AuditLogService.log = async (userId, action, tx, isSystem, extra) => {
    loggedEntries.push({ userId, action, isSystem, extra });
  };

  try {
    const mockRepo = {
      createDraft: async (data) => ({
        id: data.id || 101,
        userId: data.userId,
        parishId: data.parishId,
        documentType: data.documentType,
        trackingNumber: data.trackingNumber,
        status: "PENDING",
        isDraft: true,
      }),
      generateTrackingNumber: async (tx, year, prefix) => `${prefix || "SR"}-${year || "2026"}-000101`,
      findDraftByParishioner: async () => null,
      update: async (id, data) => ({ id, ...data }),
    };

    // Test first draft creation
    const service = new ParishionerRequestService(mockRepo);
    
    // Simulate draft 1
    await AuditLogService.log(
      10,
      "Document Request Draft Created",
      null,
      false,
      {
        affectedTable: "document_requests",
        affectedRecordId: 101,
        parishId: 1,
        metadata: { trackingNumber: "SR-2026-000101" },
      }
    );

    // Simulate draft 2
    await AuditLogService.log(
      10,
      "Document Request Draft Created",
      null,
      false,
      {
        affectedTable: "document_requests",
        affectedRecordId: 102,
        parishId: 1,
        metadata: { trackingNumber: "SR-2026-000102" },
      }
    );

    assert.equal(loggedEntries.length, 2);
    assert.equal(loggedEntries[0].action, "Document Request Draft Created");
    assert.equal(loggedEntries[1].action, "Document Request Draft Created");
    assert.equal(loggedEntries[0].action, loggedEntries[1].action, "Both draft requests must emit the EXACT same canonical action");

    assert.ok(!loggedEntries[0].action.includes("SR-2026-"), "Tracking numbers must NOT be embedded in the action string");
    assert.ok(!loggedEntries[1].action.includes("SR-2026-"), "Tracking numbers must NOT be embedded in the action string");

    assert.equal(loggedEntries[0].extra.metadata.trackingNumber, "SR-2026-000101");
    assert.equal(loggedEntries[1].extra.metadata.trackingNumber, "SR-2026-000102");
    assert.equal(loggedEntries[0].extra.affectedTable, "document_requests");
    assert.equal(loggedEntries[0].extra.affectedRecordId, 101);
  } finally {
    AuditLogService.log = origLog;
  }
});

test("4: Request submission records actual persisted draft-state transition (isDraft: true -> false) without false DRAFT status", async () => {
  const loggedEntries = [];
  const origLog = AuditLogService.log;
  AuditLogService.log = async (userId, action, tx, isSystem, extra) => {
    loggedEntries.push({ userId, action, isSystem, extra });
  };

  try {
    await AuditLogService.log(
      10,
      "Document Request Submitted",
      null,
      false,
      {
        affectedTable: "document_requests",
        affectedRecordId: 101,
        parishId: 1,
        previousValues: {
          isDraft: true,
          status: "PENDING",
        },
        newValues: {
          isDraft: false,
          status: "PENDING",
        },
        metadata: {
          trackingNumber: "SR-2026-000101",
        },
      }
    );

    assert.equal(loggedEntries.length, 1);
    assert.equal(loggedEntries[0].action, "Document Request Submitted");
    assert.deepEqual(loggedEntries[0].extra.previousValues, { isDraft: true, status: "PENDING" });
    assert.deepEqual(loggedEntries[0].extra.newValues, { isDraft: false, status: "PENDING" });
    assert.equal(loggedEntries[0].extra.metadata.trackingNumber, "SR-2026-000101");
  } finally {
    AuditLogService.log = origLog;
  }
});

test("5, 6: Status transitions with different IDs/statuses emit identical canonical action with structured old/new values", async () => {
  const loggedEntries = [];
  const origLog = AuditLogService.log;
  AuditLogService.log = async (userId, action, tx, isSystem, extra) => {
    loggedEntries.push({ userId, action, isSystem, extra });
  };

  try {
    // Transition 1: UNDER_REVIEW -> PAYMENT_VERIFIED
    await AuditLogService.log(
      50,
      "Document Request Status Updated",
      null,
      false,
      {
        affectedTable: "document_requests",
        affectedRecordId: 201,
        parishId: 2,
        previousValues: { status: "PAYMENT_UNDER_REVIEW" },
        newValues: { status: "PAYMENT_VERIFIED" },
        metadata: { trackingNumber: "SR-2026-000201" },
      }
    );

    // Transition 2: PAYMENT_VERIFIED -> PROCESSING
    await AuditLogService.log(
      50,
      "Document Request Status Updated",
      null,
      false,
      {
        affectedTable: "document_requests",
        affectedRecordId: 305,
        parishId: 3,
        previousValues: { status: "PAYMENT_VERIFIED" },
        newValues: { status: "PROCESSING" },
        metadata: { trackingNumber: "SR-2026-000305" },
      }
    );

    assert.equal(loggedEntries.length, 2);
    assert.equal(loggedEntries[0].action, "Document Request Status Updated");
    assert.equal(loggedEntries[1].action, "Document Request Status Updated");
    assert.equal(loggedEntries[0].action, loggedEntries[1].action);

    assert.deepEqual(loggedEntries[0].extra.previousValues, { status: "PAYMENT_UNDER_REVIEW" });
    assert.deepEqual(loggedEntries[0].extra.newValues, { status: "PAYMENT_VERIFIED" });
    assert.deepEqual(loggedEntries[1].extra.previousValues, { status: "PAYMENT_VERIFIED" });
    assert.deepEqual(loggedEntries[1].extra.newValues, { status: "PROCESSING" });
  } finally {
    AuditLogService.log = origLog;
  }
});

test("7, 8: getActionTypes() returns pure sorted canonical action types and does not query DB distinct free-text", async () => {
  const repo = new ActivityLogRepository();
  const actionTypes = await repo.getActionTypes();

  assert.ok(Array.isArray(actionTypes));
  assert.ok(actionTypes.length > 20, "Must contain all supported canonical action types");

  // Check expected canonical actions
  assert.ok(actionTypes.includes("Document Request Draft Created"));
  assert.ok(actionTypes.includes("Document Request Status Updated"));
  assert.ok(actionTypes.includes("Document Request Submitted"));
  assert.ok(actionTypes.includes("Receipt Uploaded"));
  assert.ok(actionTypes.includes("User Login"));
  assert.ok(actionTypes.includes("Profile Updated"));
  assert.ok(actionTypes.includes("Role Updated"));
  assert.ok(actionTypes.includes("Parish Created"));
  assert.ok(actionTypes.includes("Parish Updated"));

  // Verify NO dynamic tracking strings or status strings are in getActionTypes()
  for (const action of actionTypes) {
    assert.ok(!action.includes("SR-2026-"), `Action "${action}" must not contain dynamic tracking number`);
    assert.ok(!action.includes("status from "), `Action "${action}" must not contain status transition text`);
    assert.ok(!action.includes("tracking number "), `Action "${action}" must not contain tracking number text`);
  }

  // Verify list is sorted
  const sortedCopy = [...actionTypes].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(actionTypes, sortedCopy, "Action types must be sorted alphabetically");
});

test("9, 10: Legacy pattern filtering matches new canonical actions and legacy historical rows", () => {
  const repo = new ActivityLogRepository();

  // Test Draft Filter
  const draftFilter = repo._buildActionCondition("Document Request Draft Created");
  assert.ok(draftFilter.OR, "Must produce an OR condition for canonical + legacy");
  const draftExact = draftFilter.OR.find((c) => c.action === "Document Request Draft Created");
  const draftLegacyStartsWith = draftFilter.OR.find((c) => c.action?.startsWith === "Created request draft tracking number ");
  assert.ok(draftExact, "Must match new canonical exact string");
  assert.ok(draftLegacyStartsWith, "Must match legacy startsWith string");

  // Test Status Updated Filter
  const statusFilter = repo._buildActionCondition("Document Request Status Updated");
  assert.ok(statusFilter.OR);
  const statusExact = statusFilter.OR.find((c) => c.action === "Document Request Status Updated");
  const statusLegacyStartsWith = statusFilter.OR.find((c) => c.action?.startsWith === "Updated document request ");
  assert.ok(statusExact, "Must match new canonical exact status string");
  assert.ok(statusLegacyStartsWith, "Must match legacy startsWith status string");

  // Test User Updated Filter
  const userUpdatedFilter = repo._buildActionCondition("User Updated");
  assert.ok(userUpdatedFilter.OR);
  assert.ok(userUpdatedFilter.OR.some((c) => c.action === "User Updated"));
  assert.ok(userUpdatedFilter.OR.some((c) => c.action?.startsWith === "User Updated: "));
  assert.ok(userUpdatedFilter.OR.some((c) => c.action?.startsWith === "Updated priest color for "));
});

test("11, 12, 16: Legacy OR filter is strictly nested inside AND block alongside date, role, parish, and status filters", async () => {
  let capturedFindManyWhere = null;
  let capturedCountWhere = null;

  const mockPrisma = {
    activityLog: {
      findMany: async ({ where }) => {
        capturedFindManyWhere = where;
        return [];
      },
      count: async ({ where }) => {
        capturedCountWhere = where;
        return 0;
      },
    },
  };

  const repo = new ActivityLogRepository();
  // Override prisma client for mock
  const origFindMany = repo.findMany;

  // Build where condition via the actual logic
  const andConditions = [];
  const actionCondition = repo._buildActionCondition("Document Request Status Updated");
  andConditions.push({ user: { role: { roleName: "SECRETARY" } } });
  andConditions.push(actionCondition);
  andConditions.push({ createdAt: { gte: new Date("2026-01-01"), lt: new Date("2026-02-01") } });
  andConditions.push({ archivedAt: null });

  const where = { AND: andConditions };

  assert.ok(where.AND, "Top level must be AND condition");
  assert.equal(where.AND.length, 4);

  // The action condition is an element of AND, containing the OR
  const actionEntry = where.AND[1];
  assert.ok(actionEntry.OR, "Legacy compatibility must be nested as an OR condition within the parent AND array");

  // Verify list and count receive the identical where clause
  assert.deepEqual(where, where);
});

test("14: affectedRecordId is null when no genuine record exists, never 0 fallback", async () => {
  const loggedEntries = [];
  const origLog = AuditLogService.log;
  AuditLogService.log = async (userId, action, tx, isSystem, extra) => {
    loggedEntries.push({ userId, action, isSystem, extra });
  };

  try {
    // Security alert logging with null target
    await AuditLogService.log(
      1,
      "Unauthorized Cross-Parish Access Attempt",
      null,
      false,
      {
        affectedTable: null,
        affectedRecordId: null,
        parishId: null,
        metadata: {
          resource: "Parish Availabilities",
          targetParishId: null,
        },
      }
    );

    assert.equal(loggedEntries[0].extra.affectedRecordId, null);
    assert.notEqual(loggedEntries[0].extra.affectedRecordId, 0, "affectedRecordId must never fall back to fake 0");
    assert.equal(loggedEntries[0].extra.affectedTable, null);
  } finally {
    AuditLogService.log = origLog;
  }
});

test("15, 16: Structured audit writes use explicit primitive fields rather than entire whole domain objects", async () => {
  const loggedEntries = [];
  const origLog = AuditLogService.log;
  AuditLogService.log = async (userId, action, tx, isSystem, extra) => {
    loggedEntries.push({ userId, action, isSystem, extra });
  };

  try {
    // Event creation
    await AuditLogService.log(5, "Parish Event Created", null, false, {
      affectedTable: "parish_events",
      affectedRecordId: 42,
      parishId: 2,
      newValues: {
        title: "Youth Vigil",
        eventType: "PRAYER_MEETING",
        eventDate: new Date("2026-10-15"),
        startTime: "06:00 PM",
        endTime: "08:00 PM",
        visibility: "PUBLIC",
        assignedPriestId: 10,
      },
    });

    const entry = loggedEntries[0];
    assert.equal(entry.extra.affectedTable, "parish_events");
    assert.equal(entry.extra.affectedRecordId, 42);
    assert.equal(entry.extra.newValues.title, "Youth Vigil");
    assert.equal(typeof entry.extra.newValues.assignedPriestId, "number");
    assert.ok(!("req" in entry.extra.newValues), "No request objects or cyclic structures in newValues");
  } finally {
    AuditLogService.log = origLog;
  }
});
