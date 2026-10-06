import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ParishService } from "../services/ParishService.js";
import * as ParishController from "../controllers/ParishController.js";
import * as RequestStateMachine from "../services/RequestStateMachine.js";
import { DocumentRequestService } from "../services/DocumentRequestService.js";
import * as DocumentRequestController from "../controllers/DocumentRequestController.js";
import { RecipientResolver } from "../services/RecipientResolver.js";
import { NotificationDispatcher } from "../services/NotificationDispatcher.js";
import { ParishionerRequestService, assertParishionerOwnerRole } from "../services/ParishionerRequestService.js";
import { ReceiptVerificationService } from "../services/ReceiptVerificationService.js";
import { RequestNotificationService } from "../services/RequestNotificationService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";
import { DioceseRepository } from "../repositories/DioceseRepository.js";
import { ParishRepository } from "../repositories/ParishRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { descriptiveAnalyticsQuerySchema } from "../validators/analyticsSchemas.js";
import { createParishSchema, updateParishSchema } from "../validators/parishSchemas.js";
import { humanizeDocumentStatus } from "../services/ai/liveTools/enumFormatters.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { prisma } from "../config/db.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { ConflictHelper } from "../services/ConflictHelper.js";
import { PriestAssignmentHandler } from "../services/PriestAssignmentHandler.js";

const parishService = new ParishService();
const documentRequestService = new DocumentRequestService();

// ─── 0. Schema & Migration Integrity ──────────────────────────────────────────

test("0. Applied migration remains intact and corrective migration replaces the relationship safely", () => {
  const appliedMigrationDir = path.join(
    process.cwd(),
    "prisma/migrations/20260919120000_add_mother_parish_and_ready_for_signing"
  );
  assert.equal(fs.existsSync(appliedMigrationDir), true, "Applied migration directory must remain present");
  const appliedSql = fs.readFileSync(path.join(appliedMigrationDir, "migration.sql"), "utf-8");
  assert.match(appliedSql, /READY_FOR_SIGNING/i, "Applied migration must retain READY_FOR_SIGNING");
  assert.match(appliedSql, /mother_parish_id/i, "Applied migration must remain unchanged");

  const correctiveMigrationDir = path.join(
    process.cwd(),
    "prisma/migrations/20260928120000_correct_mother_parish_designation"
  );
  assert.equal(fs.existsSync(correctiveMigrationDir), true, "Corrective migration directory must exist");
  const correctiveSql = fs.readFileSync(path.join(correctiveMigrationDir, "migration.sql"), "utf-8");
  assert.match(correctiveSql, /ADD COLUMN "is_mother_parish" BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(correctiveSql, /DROP CONSTRAINT "parishes_mother_parish_id_fkey"/i);
  assert.match(correctiveSql, /DROP INDEX "parishes_mother_parish_id_idx"/i);
  assert.match(correctiveSql, /DROP COLUMN "mother_parish_id"/i);
});

test("0b. Prisma schema contains the boolean designation and no self-relation", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  assert.match(schema, /isMotherParish\s+Boolean\s+@default\(false\)\s+@map\("is_mother_parish"\)/);
  assert.doesNotMatch(schema, /motherParishId|childParishes|MotherChildParish/);
  assert.match(schema, /READY_FOR_SIGNING/);
});

// ─── Feature 1: Mother Parish ─────────────────────────────────────────────────

test("Feature 1: mapToDto exposes a true Mother Parish designation", () => {
  const motherParish = {
    id: 10,
    parishName: "St. Joseph Parish",
    isMotherParish: true,
    users: [],
  };
  const dto = parishService.mapToDto(motherParish);
  assert.equal(dto.isMotherParish, true);
  assert.equal("motherParishId" in dto, false);
  assert.equal("motherParishName" in dto, false);
});

test("Feature 1: mapToDto exposes a false Mother Parish designation", () => {
  const ordinaryParish = {
    id: 2,
    parishName: "San Pedro Parish",
    isMotherParish: false,
    users: [],
  };
  assert.equal(parishService.mapToDto(ordinaryParish).isMotherParish, false);
});

test("Feature 1: create rejects a non-coordinator changing the designation", async () => {
  await assert.rejects(
    () => parishService.createParish({
      parishInfo: { name: "Unauthorized Parish", type: "Parish", isMotherParish: true },
    }, 10, "SECRETARY"),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN"
  );
});

test("Feature 1: edit rejects a Secretary changing the designation", async () => {
  await assert.rejects(
    () => parishService.editParish(1, { isMotherParish: true }, 10, "SECRETARY"),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN"
  );
});

test("Feature 1: edit rejects a Priest changing the designation", async () => {
  await assert.rejects(
    () => parishService.editParish(1, { isMotherParish: false }, 10, "PRIEST"),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN"
  );
});

test("Feature 1: create validation accepts explicit OFF and ON booleans", () => {
  const base = {
    name: "Boolean Parish",
    type: "Parish",
    municipalityCity: "Canlaon City",
    feastDay: "January 1",
  };
  assert.equal(createParishSchema.safeParse({ parishInfo: { ...base, isMotherParish: false } }).success, true);
  assert.equal(createParishSchema.safeParse({ parishInfo: { ...base, isMotherParish: true } }).success, true);
});

test("Feature 1: update validation accepts designation changes without a parish relationship", () => {
  assert.equal(updateParishSchema.safeParse({ isMotherParish: true }).success, true);
  assert.equal(updateParishSchema.safeParse({ isMotherParish: false }).success, true);
});

test("Feature 1: backend source contains no relationship validation or ancestor traversal", () => {
  const serviceSource = fs.readFileSync(path.join(process.cwd(), "services/ParishService.js"), "utf-8");
  const repositorySource = fs.readFileSync(path.join(process.cwd(), "repositories/ParishRepository.js"), "utf-8");
  assert.doesNotMatch(serviceSource, /validateMotherParish|motherParishId|childParishes|ancestor/i);
  assert.doesNotMatch(repositorySource, /motherParishId|childParishes|MotherChildParish/i);
});

test("Feature 1: archive uses the existing soft-archive repository path only", async () => {
  const originalAuditLog = AuditLogService.log;
  let archivedId = null;
  try {
    AuditLogService.log = async () => undefined;
    const service = new ParishService({
      archive: async (id) => {
        archivedId = id;
        return { id, isActive: false };
      },
    });
    await service.archiveParish(5, 10);
    assert.equal(archivedId, 5);
  } finally {
    AuditLogService.log = originalAuditLog;
  }
});

// ─── Feature 2: Primary vs Assistant Priests ───────────────────────────────────

test("Feature 2: mapToDto resolves primary priest from !isAssistant and collects assistantPriests", () => {
  const parishData = {
    id: 1,
    parishName: "Parish 1",
    users: [
      { id: 101, fullName: "Father Assistant One", role: { roleName: "PRIEST" }, isAssistant: true, email: "asst1@church.org" },
      { id: 102, fullName: "Father Primary Pastor", role: { roleName: "PRIEST" }, isAssistant: false, email: "pastor@church.org" },
      { id: 103, fullName: "Father Assistant Two", role: { roleName: "PRIEST" }, isAssistant: true, email: "asst2@church.org" },
      { id: 201, fullName: "Secretary Maria", role: { roleName: "SECRETARY" }, email: "sec@church.org" },
    ],
  };

  const dto = parishService.mapToDto(parishData);

  // Primary priest must be Father Primary Pastor despite assistant being first in array
  assert.equal(dto.priest, "Father Primary Pastor");
  assert.equal(dto.priestId, "102");
  assert.equal(dto.priestName, "Father Primary Pastor");

  // Assistants collection
  assert.equal(dto.assistantPriests.length, 2);
  assert.deepEqual(dto.assistantPriests, [
    { id: "101", name: "Father Assistant One" },
    { id: "103", name: "Father Assistant Two" },
  ]);
});

test("Feature 2: mapToDto handles parish with zero assistant priests", () => {
  const parishData = {
    id: 1,
    parishName: "Parish 1",
    users: [
      { id: 102, fullName: "Father Solo", role: { roleName: "PRIEST" }, isAssistant: false },
    ],
  };

  const dto = parishService.mapToDto(parishData);
  assert.equal(dto.priest, "Father Solo");
  assert.equal(dto.priestId, "102");
  assert.deepEqual(dto.assistantPriests, []);
});

// ─── Feature 3: Document Requirements Authorization Hardening ─────────────────

test("Feature 3: updateSettings rejects PRIEST from modifying documentSettings or availableDocuments", async () => {
  let statusResult = null;
  let jsonResult = null;
  const res = {
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => {
          jsonResult = data;
        },
      };
    },
  };

  // PRIEST attempting to modify documentSettings
  const req1 = {
    params: { id: "1" },
    body: { documentSettings: { BAPTISMAL_CERTIFICATE: { fee: 200 } } },
    user: { role: "PRIEST", parish: { id: 1 } },
  };

  let capturedErr1 = null;
  await ParishController.updateSettings(req1, res, (err) => { capturedErr1 = err; });
  assert.equal(capturedErr1?.statusCode, 403);
  assert.match(capturedErr1?.message, /Priests cannot modify authoritative parish configuration/i);

  // PRIEST attempting to modify availableDocuments
  const req2 = {
    params: { id: "1" },
    body: { availableDocuments: ["BAPTISMAL_CERTIFICATE"] },
    user: { role: "PRIEST", parish: { id: 1 } },
  };

  let capturedErr2 = null;
  await ParishController.updateSettings(req2, res, (err) => { capturedErr2 = err; });
  assert.equal(capturedErr2?.statusCode, 403);
  assert.match(capturedErr2?.message, /Priests cannot modify authoritative parish configuration/i);
});

// ─── Feature 4: Priest Acceptance / Rejection Notifications ───────────────────

test("Feature 4: RecipientResolver getAdminRecipients returns Secretary and DC", async () => {
  const mockTx = {
    user: {
      findMany: async ({ where }) => {
        if (where.role?.roleName === "SECRETARY") {
          return [{ id: 10 }];
        }
        if (where.role?.roleName === "DIOCESE_COORDINATOR") {
          return [{ id: 99 }];
        }
        return [];
      },
    },
  };

  const recipients = await RecipientResolver.getAdminRecipients(1, mockTx);
  assert.equal(recipients.length, 2);
  assert.ok(recipients.includes(10));
  assert.ok(recipients.includes(99));
});

test("Feature 4: notifyPriestResponse formats acceptance and decline accurately", async () => {
  let notificationsCreated = [];
  const mockTx = {
    user: {
      findMany: async ({ where }) => {
        if (where.role?.roleName === "SECRETARY") return [{ id: 10 }];
        if (where.role?.roleName === "DIOCESE_COORDINATOR") return [{ id: 99 }];
        return [];
      },
    },
    notification: {
      createMany: async ({ data }) => {
        notificationsCreated.push(...data);
        return { count: data.length };
      },
    },
  };

  const schedule = {
    id: 50,
    trackingNumber: "SCH-2026-001",
    parishId: 1,
    assignedPriest: { fullName: "Fr. Juan Cruz" },
  };

  // ACCEPTED
  await NotificationDispatcher.notifyPriestResponse({
    parishId: 1,
    scheduleId: 50,
    displayTitle: "Marriage Blessing",
    priestName: "Juan Cruz",
    status: "ACCEPTED",
    reason: null,
  }, mockTx);
  assert.equal(notificationsCreated.length, 2);
  assert.match(notificationsCreated[0].title, /Pastoral Assignment Accepted/i);
  assert.match(notificationsCreated[0].message, /Father Juan Cruz has accepted the assignment for "Marriage Blessing"/i);

  // Reset and test REJECTED
  notificationsCreated = [];
  await NotificationDispatcher.notifyPriestResponse({
    parishId: 1,
    scheduleId: 50,
    displayTitle: "Marriage Blessing",
    priestName: "Juan Cruz",
    status: "REJECTED",
    reason: "Prior commitment",
  }, mockTx);
  assert.equal(notificationsCreated.length, 2);
  assert.match(notificationsCreated[0].title, /Pastoral Assignment Declined/i);
  assert.match(notificationsCreated[0].message, /Father Juan Cruz has declined the assignment for "Marriage Blessing"/i);
  assert.match(notificationsCreated[0].message, /Prior commitment/i);
});

// ─── Feature 5: Reassign Priest on Confirmed Schedule ─────────────────────────

test("Feature 5: assignPriest executes CONFIRMED -> PENDING with pending priest response", async () => {
  const originalFindUnique = prisma.schedule.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalConflictCheck = ConflictHelper.checkPriestConflict;
  const originalNotifyAssigned = NotificationDispatcher.notifyPriestAssigned;
  const current = {
    id: 1,
    parishId: 5,
    userId: 100,
    status: "CONFIRMED",
    assignedPriestId: 10,
    priestResponseStatus: "ACCEPTED",
    version: 3,
    requestedDate: new Date("2026-09-20T00:00:00.000Z"),
    startDatetime: new Date("2026-09-20T01:00:00.000Z"),
    endDatetime: new Date("2026-09-20T02:00:00.000Z"),
  };
  let updateData = null;
  let historyCount = 0;
  let notificationCount = 0;
  let findCount = 0;

  try {
    prisma.schedule.findUnique = async () => current;
    ConflictHelper.checkPriestConflict = async () => undefined;
    NotificationDispatcher.notifyPriestAssigned = async () => { notificationCount += 1; };
    prisma.$transaction = async (callback, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback({
        $queryRaw: async () => [{ user_id: 10 }],
        schedule: {
          findUnique: async () => {
            findCount += 1;
            return findCount === 1
              ? current
              : { ...current, status: "PENDING", assignedPriestId: 20, priestResponseStatus: "PENDING", assignedPriest: { fullName: "New Priest" } };
          },
          updateMany: async ({ data }) => { updateData = data; return { count: 1 }; },
        },
        scheduleHistory: {
          create: async () => { historyCount += 1; return { id: 1 }; },
        },
        user: {
          findUnique: async () => ({ id: 20, parishId: 5, status: "ACTIVE", role: { roleName: "PRIEST" } }),
        },
      });
    };

    const updated = await new ScheduleService().assignPriest(1, 20, 99, "SECRETARY", 5, 3);
    assert.equal(updateData.status, "PENDING");
    assert.equal(updateData.priestResponseStatus, "PENDING");
    assert.equal(updateData.assignedPriestId, 20);
    assert.equal(historyCount, 1);
    assert.equal(notificationCount, 1);
    assert.equal(updated.status, "PENDING");
  } finally {
    prisma.schedule.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
    ConflictHelper.checkPriestConflict = originalConflictCheck;
    NotificationDispatcher.notifyPriestAssigned = originalNotifyAssigned;
  }
});

// ─── Feature 6: Priest Read-Only Document Requests ────────────────────────────

test("Feature 6: DocumentRequestController.updateStatus rejects PRIEST with 403", async () => {
  let statusResult = null;
  let jsonResult = null;
  const res = {
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => {
          jsonResult = data;
        },
      };
    },
  };

  const req = {
    params: { id: "1" },
    body: { status: "PROCESSING" },
    user: { id: 100, role: "PRIEST", parish: { id: 1 } },
  };

  await DocumentRequestController.updateStatus(req, res, (err) => { throw err; });
  assert.equal(statusResult, 403);
  assert.match(jsonResult.message, /Priests have read-only access to document requests/i);
});

test("Feature 6: DocumentRequestService.updateStatus rejects PRIEST with 403", async () => {
  await assert.rejects(
    async () => {
      await documentRequestService.updateStatus(
        1,
        "READY_FOR_PICKUP",
        "",
        100,
        "PRIEST",
        1
      );
    },
    (err) => err.statusCode === 403 && err.message.includes("read-only access")
  );
});

test("NF-01: updateStatus authorizes tenant ownership before same-status idempotency", async () => {
  const originalTransaction = prisma.$transaction;
  const originalNotifyStatus = RequestNotificationService.notifyStatusChange;
  const originalNotifySigning = NotificationDispatcher.notifyPriestReadyForSigning;
  const originalAudit = AuditLogService.log;
  let statusNotificationCount = 0;
  let signingNotificationCount = 0;

  const makeTx = ({ parishId, status = "PROCESSING" }) => {
    const counts = { transition: 0, history: 0 };
    let findCount = 0;
    const request = {
      id: 77,
      userId: 7,
      parishId,
      status,
      remarks: null,
      trackingNumber: "DOC-77",
      documentType: "BAPTISMAL_CERTIFICATE",
    };
    return {
      counts,
      request,
      documentRequest: {
        findUnique: async () => {
          findCount += 1;
          return findCount === 1
            ? request
            : { ...request, status: counts.transition ? "READY_FOR_SIGNING" : status, hydrated: true };
        },
        updateMany: async () => {
          counts.transition += 1;
          return { count: 1 };
        },
      },
      requestHistory: {
        create: async () => {
          counts.history += 1;
          return { id: 900 };
        },
      },
    };
  };

  try {
    RequestNotificationService.notifyStatusChange = async () => { statusNotificationCount += 1; };
    NotificationDispatcher.notifyPriestReadyForSigning = async () => { signingNotificationCount += 1; };
    AuditLogService.log = async () => undefined;

    const ownSameStatus = makeTx({ parishId: 1 });
    prisma.$transaction = async (callback) => callback(ownSameStatus);
    const idempotentResult = await documentRequestService.updateStatus(77, "PROCESSING", "", 5, "SECRETARY", 1);
    assert.equal(idempotentResult.status, "PROCESSING");
    assert.equal(idempotentResult.hydrated, true);
    assert.deepEqual(ownSameStatus.counts, { transition: 0, history: 0 });
    assert.equal(statusNotificationCount, 0);
    assert.equal(signingNotificationCount, 0);

    const foreignSameStatus = makeTx({ parishId: 2 });
    prisma.$transaction = async (callback) => callback(foreignSameStatus);
    let foreignError = null;
    try {
      await documentRequestService.updateStatus(77, "PROCESSING", "", 5, "SECRETARY", 1);
    } catch (error) {
      foreignError = error;
    }
    assert.equal(foreignError?.statusCode, 403);
    assert.match(foreignError?.message || "", /different parish/i);
    assert.equal(Object.hasOwn(foreignError || {}, "parishId"), false);
    assert.deepEqual(foreignSameStatus.counts, { transition: 0, history: 0 });
    assert.equal(statusNotificationCount, 0);
    assert.equal(signingNotificationCount, 0);

    const foreignDifferentStatus = makeTx({ parishId: 2 });
    prisma.$transaction = async (callback) => callback(foreignDifferentStatus);
    await assert.rejects(
      () => documentRequestService.updateStatus(77, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1),
      (error) => error.statusCode === 403 && /different parish/i.test(error.message)
    );
    assert.deepEqual(foreignDifferentStatus.counts, { transition: 0, history: 0 });

    const ownDifferentStatus = makeTx({ parishId: 1 });
    prisma.$transaction = async (callback) => callback(ownDifferentStatus);
    const transitioned = await documentRequestService.updateStatus(77, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1);
    assert.equal(transitioned.status, "READY_FOR_SIGNING");
    assert.deepEqual(ownDifferentStatus.counts, { transition: 1, history: 1 });
    assert.equal(statusNotificationCount, 1);
    assert.equal(signingNotificationCount, 1);
  } finally {
    prisma.$transaction = originalTransaction;
    RequestNotificationService.notifyStatusChange = originalNotifyStatus;
    NotificationDispatcher.notifyPriestReadyForSigning = originalNotifySigning;
    AuditLogService.log = originalAudit;
  }
});

// ─── Feature 7: Ready for Signing Status & Workflow ───────────────────────────

test("Feature 7: RequestStateMachine validates canonical transitions for READY_FOR_SIGNING", () => {
  // PROCESSING -> READY_FOR_SIGNING allowed
  assert.equal(
    RequestStateMachine.canTransition("PROCESSING", "READY_FOR_SIGNING"),
    true,
    "PROCESSING -> READY_FOR_SIGNING must be allowed"
  );

  // READY_FOR_SIGNING -> READY_FOR_PICKUP allowed
  assert.equal(
    RequestStateMachine.canTransition("READY_FOR_SIGNING", "READY_FOR_PICKUP"),
    true,
    "READY_FOR_SIGNING -> READY_FOR_PICKUP must be allowed"
  );

  // Normal PROCESSING -> READY_FOR_PICKUP no longer allowed (must go through READY_FOR_SIGNING)
  assert.equal(
    RequestStateMachine.canTransition("PROCESSING", "READY_FOR_PICKUP"),
    false,
    "Direct PROCESSING -> READY_FOR_PICKUP must be blocked in canonical workflow"
  );
});

test("Feature 7: RecipientResolver.getPrimaryPriest resolves active non-assistant priest", async () => {
  const mockTx = {
    user: {
      findFirst: async ({ where }) => {
        assert.equal(where.parishId, 1);
        assert.deepEqual(where.role, { roleName: "PRIEST" });
        assert.equal(where.isAssistant, false);
        assert.equal(where.status, "ACTIVE");
        return {
          id: 42,
        };
      },
    },
  };

  const primaryPriestId = await RecipientResolver.getPrimaryPriest(1, mockTx);
  assert.equal(primaryPriestId, 42);
});

test("Feature 7: notifyPriestReadyForSigning sends IN_APP notification to primary priest with referenceType DOCUMENT_REQUEST", async () => {
  let createdNotifications = [];

  const mockTx = {
    user: {
      findFirst: async () => ({
        id: 42,
      }),
    },
    notification: {
      createMany: async ({ data }) => {
        createdNotifications.push(...data);
        return { count: data.length };
      },
    },
  };

  const request = {
    parishId: 1,
    requestId: 100,
    trackingNumber: "DOC-2026-0001",
    documentType: "BAPTISMAL_CERTIFICATE",
  };

  await NotificationDispatcher.notifyPriestReadyForSigning(request, mockTx);

  assert.equal(createdNotifications.length, 1, "Notification must be created");
  const notification = createdNotifications[0];
  assert.equal(notification.userId, 42);
  assert.equal(notification.type, "IN_APP");
  assert.equal(notification.referenceType, "DOCUMENT_REQUEST");
  assert.equal(notification.referenceId, 100);
  assert.equal(notification.title, "Document Ready for Signing");
  assert.match(notification.message, /Request #DOC-2026-0001 \(Baptismal Certificate\) is ready for your signature\./);
});

test("Feature 7: notifyPriestReadyForSigning handles parish without active primary priest gracefully without crashing", async () => {
  const mockTx = {
    user: {
      findFirst: async () => null, // No primary priest found
    },
    notification: {
      createMany: async () => {
        assert.fail("Should not create notification if no priest");
      },
    },
  };

  const request = {
    parishId: 99,
    requestId: 100,
    trackingNumber: "DOC-2026-0001",
    documentType: "BAPTISMAL_CERTIFICATE",
  };

  // Must resolve gracefully without throwing
  await assert.doesNotReject(async () => {
    await NotificationDispatcher.notifyPriestReadyForSigning(request, mockTx);
  });
});

// Correction-pass behavioral and controlled-mock coverage

test("H-01: parishioner owner-route middleware rejects every staff role", async () => {
  const middleware = checkRole(["PARISHIONER"]);
  for (const role of ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]) {
    let statusCode = null;
    let nextCalled = false;
    middleware(
      { user: { id: 10, role } },
      { status: (code) => { statusCode = code; return { json: () => undefined }; } },
      () => { nextCalled = true; }
    );
    assert.equal(statusCode, 403, `${role} must be rejected`);
    assert.equal(nextCalled, false);
  }

  let parishionerNextCalled = false;
  middleware(
    { user: { id: 11, role: "PARISHIONER" } },
    { status: () => assert.fail("Parishioner should pass role middleware") },
    () => { parishionerNextCalled = true; }
  );
  assert.equal(parishionerNextCalled, true);

  const routeSource = fs.readFileSync(path.join(process.cwd(), "routes/parishionerRequestRoutes.js"), "utf8");
  assert.match(routeSource, /router\.use\(checkRole\(\["PARISHIONER"\]\)\)/);
});

test("H-01: owner services reject staff before create, submit, cancel, upload-read, receipt, resubmit, and owner reads", async () => {
  const originalFindUnique = prisma.user.findUnique;
  const originalTransaction = prisma.$transaction;
  const service = new ParishionerRequestService({
    findMany: async () => assert.fail("Repository must not run for staff"),
    findById: async () => assert.fail("Repository must not run for staff"),
    findByTrackingNumber: async () => assert.fail("Repository must not run for staff"),
  });

  try {
    for (const roleName of ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]) {
      const staffUser = { id: 90, roleId: 2, role: { roleName }, fullName: "Staff", contactNumber: "123" };
      prisma.user.findUnique = async () => staffUser;
      prisma.$transaction = async (callback) => callback({ user: { findUnique: async () => staffUser } });

      const operations = [
        () => service.createDraft(90, { parishId: 1, documentType: "BAPTISMAL_CERTIFICATE", applicantName: "Test User" }),
        () => service.submitDraft(1, 90),
        () => service.cancelRequest(1, 90),
        () => service.getRequestById(1, 90),
        () => service.getRequestByTrackingNumber("DOC-1", 90),
        () => service.listRequests(90, {}),
        () => service.resubmitCorrections(1, 90),
        () => ReceiptVerificationService.processReceipt(1, 90, { buffer: Buffer.from("x") }),
      ];
      for (const operation of operations) {
        await assert.rejects(operation, (error) => error.statusCode === 403 && error.code === "FORBIDDEN");
      }
    }

    await assert.rejects(
      () => assertParishionerOwnerRole(90, {
        user: { findUnique: async () => ({ id: 90, roleId: null, role: { roleName: "PRIEST" } }) },
      }),
      (error) => error.statusCode === 403
    );

    const parishioner = { id: 91, roleId: 1, role: { roleName: "PARISHIONER" } };
    assert.equal(
      await assertParishionerOwnerRole(91, { user: { findUnique: async () => parishioner } }),
      parishioner
    );
  } finally {
    prisma.user.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  }
});

test("M-01/M-03: canonical parish projection returns designation, active personnel, and stable lowest-id primary", async () => {
  const makeParish = (isMotherParish) => ({
    id: 7,
    parishName: "Canonical Parish",
    isMotherParish,
    users: [
      { id: 40, fullName: "Later Primary", isAssistant: false, role: { roleName: "PRIEST" } },
      { id: 12, fullName: "First Primary", isAssistant: false, role: { roleName: "PRIEST" } },
      { id: 21, fullName: "Assistant", isAssistant: true, role: { roleName: "PRIEST" } },
    ],
  });
  let storedDesignation = true;
  const service = new ParishService({ findById: async () => makeParish(storedDesignation) });

  const setDto = await service.getCanonicalParishDto(7);
  assert.equal(setDto.isMotherParish, true);
  assert.equal(setDto.priestId, "12");
  assert.equal(setDto.priest, "First Primary");
  assert.equal(setDto.priestName, "First Primary");

  storedDesignation = false;
  const clearDto = await service.getCanonicalParishDto(7);
  assert.equal(clearDto.isMotherParish, false);

  const reversedDto = service.mapToDto({ ...makeParish(true), users: [...makeParish(false).users].reverse() });
  assert.equal(reversedDto.priestId, "12");

  const originalFindUnique = prisma.parish.findUnique;
  let canonicalQuery = null;
  try {
    prisma.parish.findUnique = async (args) => {
      canonicalQuery = args;
      return makeParish(true);
    };
    await new ParishRepository().findById(7);
    assert.deepEqual(canonicalQuery.include.users.where, { status: "ACTIVE" });
    assert.equal("motherParish" in canonicalQuery.include, false);
  } finally {
    prisma.parish.findUnique = originalFindUnique;
  }
});

test("NF-02: create rejects an assistant primary and accepts an active non-assistant primary", async () => {
  const originalParishFindUnique = prisma.parish.findUnique;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAuditLog = AuditLogService.log;
  const assignedUserIds = [];
  let selectedUser = null;
  const repository = {
    mapTypeToEnum: (type) => type,
    findById: async () => ({
      id: 7,
      parishName: "Primary-Safe Parish",
      isMotherParish: false,
      users: selectedUser ? [{ ...selectedUser, parishId: 7 }] : [],
    }),
  };
  const tx = {
    parish: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 7, ...data }),
    },
    parishWeekdayRule: { createMany: async () => ({ count: 7 }) },
    parishServiceWeekdayRule: { createMany: async () => ({ count: 3 }) },
    massScheduleTemplate: { create: async () => ({ id: 1 }) },
    parishCouncilConfiguration: { create: async () => ({ id: 1 }) },
    user: {
      update: async ({ where }) => {
        assignedUserIds.push(where.id);
        return { id: where.id };
      },
    },
  };

  try {
    prisma.parish.findUnique = async () => null;
    AuditLogService.log = async () => undefined;

    selectedUser = {
      id: 20,
      fullName: "Assistant Priest",
      status: "ACTIVE",
      parishId: null,
      isAssistant: true,
      role: { roleName: "PRIEST" },
    };
    prisma.user.findUnique = async () => selectedUser;
    await assert.rejects(
      () => new ParishService(repository).createParish({
        parishInfo: { name: "Rejected Assistant Parish", type: "PARISH" },
        priest: { mode: "existing", existingUserId: 20 },
      }, 5),
      (error) => error.statusCode === 400 && /assistant/i.test(error.message)
    );
    assert.deepEqual(assignedUserIds, []);

    selectedUser = {
      id: 30,
      fullName: "Primary Priest",
      status: "ACTIVE",
      parishId: null,
      isAssistant: false,
      role: { roleName: "PRIEST" },
    };
    prisma.user.findUnique = async () => selectedUser;
    prisma.$transaction = async (callback) => callback(tx);
    const dto = await new ParishService(repository).createParish({
      parishInfo: {
        name: "Primary-Safe Parish",
        type: "PARISH",
        address: "Dumaguete City, Negros Oriental",
        isMotherParish: false,
      },
      priest: { mode: "existing", existingUserId: 30 },
    }, 5, "DIOCESE_COORDINATOR");
    assert.deepEqual(assignedUserIds, [30]);
    assert.equal(dto.priestId, "30");
  } finally {
    prisma.parish.findUnique = originalParishFindUnique;
    prisma.user.findUnique = originalUserFindUnique;
    prisma.$transaction = originalTransaction;
    AuditLogService.log = originalAuditLog;
  }
});

test("NF-02: reassignment detaches the lowest-id active primary and preserves assistants", async () => {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAuditLog = AuditLogService.log;
  const originalCleanup = PriestAssignmentHandler.cleanupPriestAssignmentsFromParish;
  const cleanupIds = [];
  const userUpdates = [];
  const existingUsers = [
    { id: 5, fullName: "Assistant", status: "ACTIVE", isAssistant: true, role: { roleName: "PRIEST" } },
    { id: 40, fullName: "Later Primary", status: "ACTIVE", isAssistant: false, role: { roleName: "PRIEST" } },
    { id: 2, fullName: "Inactive Primary", status: "INACTIVE", isAssistant: false, role: { roleName: "PRIEST" } },
    { id: 12, fullName: "First Primary", status: "ACTIVE", isAssistant: false, role: { roleName: "PRIEST" } },
  ];
  const newPrimary = {
    id: 30,
    fullName: "New Primary",
    status: "ACTIVE",
    parishId: null,
    isAssistant: false,
    role: { roleName: "PRIEST" },
  };
  const currentParish = {
    id: 1,
    parishName: "Test Parish",
    schedulingConfigVersion: 1,
    users: existingUsers,
  };
  const tx = {
    $queryRaw: async () => [{}],
    parish: {
      findUnique: async () => currentParish,
      update: async () => currentParish,
    },
    user: {
      findUnique: async () => newPrimary,
      update: async ({ where, data }) => {
        userUpdates.push({ id: where.id, parishId: data.parishId });
        return { id: where.id, ...data };
      },
    },
  };
  const repository = {
    findById: async () => ({
      ...currentParish,
      users: [existingUsers[0], newPrimary],
    }),
  };

  try {
    prisma.user.findUnique = async () => ({ parishId: null });
    prisma.$transaction = async (callback, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback(tx);
    };
    AuditLogService.log = async () => undefined;
    PriestAssignmentHandler.cleanupPriestAssignmentsFromParish = async (priestId) => {
      cleanupIds.push(priestId);
    };

    const dto = await new ParishService(repository).editParish(1, { priestId: 30 }, 5, "DIOCESE_COORDINATOR");
    assert.deepEqual(cleanupIds, [12]);
    assert.deepEqual(userUpdates, [
      { id: 12, parishId: null },
      { id: 30, parishId: 1 },
    ]);
    assert.equal(userUpdates.some(({ id }) => id === 5), false, "Assistant must remain assigned");
    assert.equal(userUpdates.some(({ id }) => id === 40), false, "Only the deterministic lowest-id primary is replaced");
    assert.equal(dto.priestId, "30");
    assert.deepEqual(dto.assistantPriests, [{ id: "5", name: "Assistant" }]);
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.$transaction = originalTransaction;
    AuditLogService.log = originalAuditLog;
    PriestAssignmentHandler.cleanupPriestAssignmentsFromParish = originalCleanup;
  }
});

test("NF-02: assignable primary-priest queries exclude assistants without changing general priest listings", async () => {
  const originalFindMany = prisma.user.findMany;
  const originalCount = prisma.user.count;
  const queries = [];
  try {
    prisma.user.findMany = async (args) => {
      queries.push(args);
      return [];
    };
    prisma.user.count = async () => 0;
    const repository = new UserRepository();
    await repository.findMany({ role: "PRIEST", assignableForParishId: "" });
    await repository.findMany({ role: "PRIEST", parishId: 1 });

    assert.equal(queries[0].where.AND.some((condition) => condition.isAssistant === false), true);
    assert.equal(queries[1].where.AND.some((condition) => condition.isAssistant === false), false);
  } finally {
    prisma.user.findMany = originalFindMany;
    prisma.user.count = originalCount;
  }
});

test("M-01: createParish persists explicit OFF and ON designations", async () => {
  const originalFindUnique = prisma.parish.findUnique;
  const originalTransaction = prisma.$transaction;
  const originalAuditLog = AuditLogService.log;
  let nextId = 7;
  let canonicalParish = null;
  const createdData = [];
  const repository = {
    mapTypeToEnum: (type) => type,
    findById: async (id) => {
      assert.equal(id, canonicalParish.id);
      return { ...canonicalParish, users: [] };
    },
  };
  const tx = {
    parish: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }) => {
        createdData.push(data);
        canonicalParish = { id: nextId++, ...data };
        return canonicalParish;
      },
    },
    parishWeekdayRule: { createMany: async () => ({ count: 7 }) },
    parishServiceWeekdayRule: { createMany: async () => ({ count: 3 }) },
    massScheduleTemplate: { create: async () => ({ id: 1 }) },
    parishCouncilConfiguration: { create: async () => ({ id: 1 }) },
  };

  try {
    prisma.parish.findUnique = async () => null;
    prisma.$transaction = async (callback) => callback(tx);
    AuditLogService.log = async () => undefined;

    const service = new ParishService(repository);
    const offDto = await service.createParish({
      parishInfo: {
        name: "Ordinary Parish",
        type: "PARISH",
        address: "Dumaguete City, Negros Oriental",
        isMotherParish: false,
      },
    }, 5, "DIOCESE_COORDINATOR");
    assert.equal(offDto.isMotherParish, false);

    const onDto = await service.createParish({
      parishInfo: {
        name: "Designated Parish",
        type: "PARISH",
        address: "Dumaguete City, Negros Oriental",
        isMotherParish: true,
      },
    }, 5, "DIOCESE_COORDINATOR");
    assert.equal(onDto.isMotherParish, true);
    assert.deepEqual(createdData.map((data) => data.isMotherParish), [false, true]);
    assert.equal(createdData.some((data) => "motherParishId" in data), false);
  } finally {
    prisma.parish.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
    AuditLogService.log = originalAuditLog;
  }
});

test("M-02: edit toggles and reopens the persisted Mother Parish designation", async () => {
  const originalTransaction = prisma.$transaction;
  const originalAuditLog = AuditLogService.log;
  let transactionCount = 0;
  let storedDesignation = false;
  let updateCount = 0;

  const tx = {
    parish: {
      findUnique: async () => ({ id: 1, parishName: "Toggle Parish", isMotherParish: storedDesignation, users: [], schedulingConfigVersion: 1 }),
      findFirst: async () => null,
      update: async ({ data }) => {
        updateCount += 1;
        storedDesignation = data.isMotherParish;
        return { id: 1, parishName: "Toggle Parish", isMotherParish: storedDesignation, users: [] };
      },
    },
  };
  const repository = {
    findById: async () => ({
      id: 1,
      parishName: "Toggle Parish",
      isMotherParish: storedDesignation,
      users: [],
    }),
  };
  const service = new ParishService(repository);

  try {
    AuditLogService.log = async () => undefined;
    prisma.$transaction = async (callback, options) => {
      transactionCount += 1;
      assert.equal(options.isolationLevel, "Serializable");
      return callback(tx);
    };

    const enabledDto = await service.editParish(1, { isMotherParish: true }, 5, "DIOCESE_COORDINATOR");
    assert.equal(enabledDto.isMotherParish, true);
    assert.equal((await service.getCanonicalParishDto(1)).isMotherParish, true);

    const disabledDto = await service.editParish(1, { isMotherParish: false }, 5, "DIOCESE_COORDINATOR");
    assert.equal(disabledDto.isMotherParish, false);
    assert.equal((await service.getCanonicalParishDto(1)).isMotherParish, false);
    assert.equal(transactionCount, 2);
    assert.equal(updateCount, 2);
  } finally {
    prisma.$transaction = originalTransaction;
    AuditLogService.log = originalAuditLog;
  }
});

test("M-03: signing resolver explicitly orders duplicate primary priests by ascending id", async () => {
  let query = null;
  const resolved = await RecipientResolver.getPrimaryPriest(1, {
    user: {
      findFirst: async (args) => {
        query = args;
        return { id: 12 };
      },
    },
  });
  assert.equal(resolved, 12);
  assert.deepEqual(query.orderBy, { id: "asc" });
  const dto = parishService.mapToDto({
    id: 1,
    parishName: "Test Parish",
    users: [
      { id: 40, fullName: "Later Primary", isAssistant: false, role: { roleName: "PRIEST" } },
      { id: 12, fullName: "First Primary", isAssistant: false, role: { roleName: "PRIEST" } },
      { id: 5, fullName: "Assistant", isAssistant: true, role: { roleName: "PRIEST" } },
    ],
  });
  assert.equal(dto.priestId, String(resolved), "DTO and RecipientResolver must agree on the primary priest");
});

test("M-05: READY_FOR_SIGNING participates in pending counts and analytics validation", async () => {
  const originalCount = prisma.documentRequest.count;
  const originalFindMany = prisma.parish.findMany;
  const capturedCounts = [];
  try {
    prisma.documentRequest.count = async ({ where }) => {
      capturedCounts.push(where);
      return 1;
    };
    await new DocumentRequestRepository().countStats(1);
    await new DioceseRepository().countPendingDocumentRequests();
    assert.equal(capturedCounts[0].status.in.includes("READY_FOR_SIGNING"), true);
    assert.equal(capturedCounts[2].status.in.includes("READY_FOR_SIGNING"), true);

    let parishQuery = null;
    prisma.parish.findMany = async (args) => { parishQuery = args; return []; };
    await new DioceseRepository().findParishesWithPendingCount();
    assert.equal(
      parishQuery.include._count.select.documentRequests.where.status.in.includes("READY_FOR_SIGNING"),
      true
    );

    assert.equal(
      descriptiveAnalyticsQuerySchema.parse({ status: "READY_FOR_SIGNING" }).status,
      "READY_FOR_SIGNING"
    );
  } finally {
    prisma.documentRequest.count = originalCount;
    prisma.parish.findMany = originalFindMany;
  }
});

test("M-06: Caloy collapses READY_FOR_SIGNING to the public Processing stage everywhere", () => {
  assert.equal(humanizeDocumentStatus("READY_FOR_SIGNING"), "Processing");
  const registry = new LiveToolRegistry({ prismaClient: {}, scheduleService: {}, requestRepository: {} });
  const result = registry.formatSingleRequestStatus({
    documentType: "BAPTISMAL_CERTIFICATE",
    status: "READY_FOR_SIGNING",
    trackingNumber: "DOC-1",
    parishId: 1,
    parish: { parishName: "Test Parish" },
    dateRequested: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(result.structuredFacts.safeStatus, "Processing");
  assert.doesNotMatch(result.answer, /Ready for signing|READY_FOR_SIGNING/i);
  assert.doesNotMatch(result.fallbackAnswer, /Ready for signing|READY_FOR_SIGNING/i);
});

function makeStatusTransitionTx({ claimCount = 1, latestStatus = "READY_FOR_SIGNING", notificationCreateMany } = {}) {
  let findCount = 0;
  return {
    counts: { history: 0, claim: 0 },
    documentRequest: {
      findUnique: async () => {
        findCount += 1;
        if (findCount === 1) {
          return {
            id: 100,
            userId: 7,
            parishId: 1,
            status: "PROCESSING",
            remarks: null,
            trackingNumber: "DOC-100",
            documentType: "BAPTISMAL_CERTIFICATE",
          };
        }
        return {
          id: 100,
          userId: 7,
          parishId: 1,
          status: latestStatus,
          remarks: null,
          trackingNumber: "DOC-100",
          documentType: "BAPTISMAL_CERTIFICATE",
        };
      },
      updateMany: async () => {
        return { count: claimCount };
      },
    },
    requestHistory: {
      create: async () => ({ id: 55 }),
    },
    user: {
      findFirst: async () => ({ id: 12 }),
    },
    notification: {
      createMany: notificationCreateMany || (async () => ({ count: 1 })),
    },
  };
}

test("M-07: atomic status claim gives the winner one history and one signing notification; loser is a no-op", async () => {
  const originalTransaction = prisma.$transaction;
  const originalNotifyStatus = RequestNotificationService.notifyStatusChange;
  const originalNotifySigning = NotificationDispatcher.notifyPriestReadyForSigning;
  const originalAudit = AuditLogService.log;
  let historyCount = 0;
  let signingCount = 0;

  try {
    RequestNotificationService.notifyStatusChange = async () => undefined;
    NotificationDispatcher.notifyPriestReadyForSigning = async () => { signingCount += 1; };
    AuditLogService.log = async () => undefined;

    const winner = makeStatusTransitionTx({ claimCount: 1 });
    winner.requestHistory.create = async () => { historyCount += 1; return { id: 55 }; };
    prisma.$transaction = async (callback) => callback(winner);
    const winnerResult = await documentRequestService.updateStatus(100, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1);
    assert.equal(winnerResult.status, "READY_FOR_SIGNING");
    assert.equal(historyCount, 1);
    assert.equal(signingCount, 1);

    const loser = makeStatusTransitionTx({ claimCount: 0, latestStatus: "READY_FOR_SIGNING" });
    loser.requestHistory.create = async () => { historyCount += 1; return { id: 56 }; };
    prisma.$transaction = async (callback) => callback(loser);
    const loserResult = await documentRequestService.updateStatus(100, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1);
    assert.equal(loserResult.status, "READY_FOR_SIGNING");
    assert.equal(historyCount, 1);
    assert.equal(signingCount, 1);
  } finally {
    prisma.$transaction = originalTransaction;
    RequestNotificationService.notifyStatusChange = originalNotifyStatus;
    NotificationDispatcher.notifyPriestReadyForSigning = originalNotifySigning;
    AuditLogService.log = originalAudit;
  }
});

test("M-08: strict signing notification failure rejects the transaction path, while no-primary remains successful", async () => {
  const originalTransaction = prisma.$transaction;
  const originalNotifyStatus = RequestNotificationService.notifyStatusChange;
  const originalAudit = AuditLogService.log;
  try {
    RequestNotificationService.notifyStatusChange = async () => undefined;
    AuditLogService.log = async () => undefined;

    const failingTx = makeStatusTransitionTx({
      claimCount: 1,
      notificationCreateMany: async () => { throw new Error("notification insert failed"); },
    });
    prisma.$transaction = async (callback) => callback(failingTx);
    await assert.rejects(
      () => documentRequestService.updateStatus(100, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1),
      /notification insert failed/
    );

    const noPrimaryTx = makeStatusTransitionTx({ claimCount: 1 });
    noPrimaryTx.user.findFirst = async () => null;
    prisma.$transaction = async (callback) => callback(noPrimaryTx);
    await assert.doesNotReject(
      () => documentRequestService.updateStatus(100, "READY_FOR_SIGNING", "", 5, "SECRETARY", 1)
    );
  } finally {
    prisma.$transaction = originalTransaction;
    RequestNotificationService.notifyStatusChange = originalNotifyStatus;
    AuditLogService.log = originalAudit;
  }
});
