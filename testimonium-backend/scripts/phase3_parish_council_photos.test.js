import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ParishCouncilService } from "../services/ParishCouncilService.js";
import { ParishCouncilRepository } from "../repositories/ParishCouncilRepository.js";
import { saveCouncilSchema } from "../validators/councilSchemas.js";
import { ParishService } from "../services/ParishService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { FileValidator } from "../utils/fileValidator.js";
import { prisma } from "../config/db.js";

// Ensure AuditLogService does not make remote database calls during unit test executions
AuditLogService.log = async () => {};

// Helper dummy buffers with valid magic bytes
const VALID_JPEG_BUF = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const VALID_PNG_BUF = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const VALID_WEBP_BUF = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const INVALID_MAGIC_BUF = Buffer.from("Not a real image file binary at all");

// ============================================================================
// BACKEND SAVECouncil TESTS (8 - 20)
// ============================================================================

test("8. Existing ID updates in place", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const updatedRows = [];
  const createdRows = [];
  const deletedRows = [];

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            {
              id: 101,
              councilType: "PASTORAL",
              positionTitle: "Old Chair",
              memberName: "Maria Santos",
              sortOrder: 0,
              photoUrl: "https://r2.testimonium.ph/photo1.jpg",
              photoObjectKey: "key1.jpg",
            },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          {
            id: 101,
            councilConfigurationId: 10,
            councilType: "PASTORAL",
            positionTitle: "Old Chair",
            memberName: "Maria Santos",
            sortOrder: 0,
            photoUrl: "https://r2.testimonium.ph/photo1.jpg",
            photoObjectKey: "key1.jpg",
          },
        ],
        update: async (args) => {
          updatedRows.push(args);
          return args.data;
        },
        create: async (args) => {
          createdRows.push(args);
          return { id: 999, ...args.data };
        },
        deleteMany: async (args) => {
          deletedRows.push(args);
        },
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 101, positionTitle: "Updated Chair", memberName: "Maria Santos Updated" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.equal(updatedRows.length, 1);
    assert.equal(updatedRows[0].where.id, 101);
    assert.equal(updatedRows[0].data.positionTitle, "Updated Chair");
    assert.equal(updatedRows[0].data.memberName, "Maria Santos Updated");
    assert.equal(createdRows.length, 0, "No row should be created for existing ID");
    assert.equal(deletedRows.length, 0, "No row should be deleted");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("9. Existing photoUrl/photoObjectKey survive text edit", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  let updatedData = null;

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            {
              id: 101,
              councilType: "PASTORAL",
              positionTitle: "Old Position",
              memberName: "Member Name",
              sortOrder: 0,
              photoUrl: "https://r2.testimonium.ph/councils/parish_1/officers/photo.jpg",
              photoObjectKey: "councils/parish_1/officers/photo.jpg",
            },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          {
            id: 101,
            councilConfigurationId: 10,
            councilType: "PASTORAL",
            positionTitle: "Old Position",
            memberName: "Member Name",
            sortOrder: 0,
            photoUrl: "https://r2.testimonium.ph/councils/parish_1/officers/photo.jpg",
            photoObjectKey: "councils/parish_1/officers/photo.jpg",
          },
        ],
        update: async (args) => {
          updatedData = args.data;
          return args.data;
        },
        create: async () => ({ id: 1 }),
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 101, positionTitle: "New Position Title", memberName: "Member Name" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.ok(updatedData);
    assert.equal(updatedData.positionTitle, "New Position Title");
    assert.equal(updatedData.photoUrl, undefined, "photoUrl must not be overwritten or nulled");
    assert.equal(updatedData.photoObjectKey, undefined, "photoObjectKey must not be overwritten or nulled");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("10. Foreign parish member ID rejected", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", memberName: "Local", positionTitle: "Chair" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          {
            id: 999,
            councilConfigurationId: 99, // Belongs to parish 2 config!
            councilType: "PASTORAL",
            positionTitle: "Hacker",
            memberName: "Foreigner",
          },
        ],
      },
    });
  };

  try {
    await assert.rejects(
      async () => {
        await service.saveCouncil(1, {
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [
            { id: 999, positionTitle: "Hacker", memberName: "Foreigner" },
          ],
          financeCouncilMembers: [],
        }, 1);
      },
      (err) => err.code === "COUNCIL_MEMBER_STALE" && err.statusCode === 409
    );
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("11. Wrong council/config member ID rejected", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: true,
          members: [
            { id: 201, councilType: "FINANCE", memberName: "Finance Guy", positionTitle: "Treasurer" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          {
            id: 201,
            councilConfigurationId: 10,
            councilType: "FINANCE", // FINANCE member cannot be submitted as PASTORAL
            positionTitle: "Treasurer",
            memberName: "Finance Guy",
          },
        ],
      },
    });
  };

  try {
    await assert.rejects(
      async () => {
        await service.saveCouncil(1, {
          expectedVersion: 1,
          financeCouncilEnabled: true,
          pastoralCouncilMembers: [
            { id: 201, positionTitle: "Treasurer", memberName: "Finance Guy" },
          ],
          financeCouncilMembers: [
            { positionTitle: "Auditor", memberName: "Other" },
          ],
        }, 1);
      },
      (err) => err.code === "COUNCIL_MEMBER_STALE" && err.statusCode === 409
    );
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("12. Duplicate submitted member IDs rejected", () => {
  assert.throws(
    () => {
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [
          { id: 101, positionTitle: "Chair", memberName: "Alice" },
          { id: 101, positionTitle: "Vice Chair", memberName: "Bob" },
        ],
        financeCouncilMembers: [],
      });
    },
    (err) => err.name === "ZodError" && /duplicate/i.test(err.message)
  );
});

test("13. sortOrder remains contiguous after update/create/delete", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const recordedSortOrders = [];

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0 },
            { id: 102, councilType: "PASTORAL", positionTitle: "P2", memberName: "M2", sortOrder: 1 },
            { id: 103, councilType: "PASTORAL", positionTitle: "P3", memberName: "M3", sortOrder: 2 },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          { id: 101, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0 },
          { id: 102, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "P2", memberName: "M2", sortOrder: 1 },
        ],
        update: async (args) => {
          recordedSortOrders.push({ id: args.where.id, sortOrder: args.data.sortOrder, type: "update" });
          return args.data;
        },
        create: async (args) => {
          recordedSortOrders.push({ id: "new", sortOrder: args.data.sortOrder, type: "create" });
          return { id: 200, ...args.data };
        },
        createMany: async (args) => {
          for (const item of args.data) {
            recordedSortOrders.push({ id: "new", sortOrder: item.sortOrder, type: "create" });
          }
          return { count: args.data.length };
        },
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 102, positionTitle: "P2", memberName: "M2" },
        { positionTitle: "Brand New", memberName: "New Person" },
        { id: 101, positionTitle: "P1", memberName: "M1" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.equal(recordedSortOrders.length, 3);
    const m102 = recordedSortOrders.find((r) => r.id === 102);
    const mNew = recordedSortOrders.find((r) => r.id === "new");
    const m101 = recordedSortOrders.find((r) => r.id === 101);

    assert.equal(m102.sortOrder, 0, "Member 102 submitted first must have sortOrder 0");
    assert.equal(mNew.sortOrder, 1, "New member submitted second must have sortOrder 1");
    assert.equal(m101.sortOrder, 2, "Member 101 submitted third must have sortOrder 2");
    assert.deepEqual(
      recordedSortOrders.map((r) => r.sortOrder).sort((a, b) => a - b),
      [0, 1, 2]
    );
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("14. Deleted member identified correctly", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const deletedMemberIds = [];

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0 },
            { id: 102, councilType: "PASTORAL", positionTitle: "P2", memberName: "M2", sortOrder: 1 },
            { id: 103, councilType: "PASTORAL", positionTitle: "P3", memberName: "M3", sortOrder: 2 },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          { id: 101, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0 },
        ],
        update: async () => ({ id: 1 }),
        create: async () => ({ id: 1 }),
        deleteMany: async (args) => {
          if (args.where?.id?.in) {
            deletedMemberIds.push(...args.where.id.in);
          }
        },
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 101, positionTitle: "P1", memberName: "M1" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.ok(deletedMemberIds.includes(102), "Member 102 must be identified for deletion");
    assert.ok(deletedMemberIds.includes(103), "Member 103 must be identified for deletion");
    assert.ok(!deletedMemberIds.includes(101), "Member 101 must NOT be deleted");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("15. Truly deleted member photo cleanup occurs post-commit", async () => {
  const deletedR2Keys = [];
  const mockRepo = new ParishCouncilRepository();
  mockRepo.isPhotoKeyReferenced = async () => false;

  const mockR2 = {
    delete: async (key) => {
      deletedR2Keys.push(key);
    },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0, photoObjectKey: "surviving.jpg" },
            { id: 102, councilType: "PASTORAL", positionTitle: "P2", memberName: "M2", sortOrder: 1, photoObjectKey: "deleted-member.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          { id: 101, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0, photoObjectKey: "surviving.jpg" },
        ],
        update: async () => ({ id: 1 }),
        create: async () => ({ id: 1 }),
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 101, positionTitle: "P1", memberName: "M1" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.ok(deletedR2Keys.includes("deleted-member.jpg"), "Old photo of truly deleted member must be cleaned up post-commit");
    assert.ok(!deletedR2Keys.includes("surviving.jpg"), "Photo of surviving member must not be deleted");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("16. Transaction rollback performs no old-photo cleanup", async () => {
  const deletedR2Keys = [];
  const mockRepo = new ParishCouncilRepository();
  const mockR2 = {
    delete: async (key) => {
      deletedR2Keys.push(key);
    },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async () => {
    throw new Error("Simulated Database Rollback");
  };

  try {
    await assert.rejects(
      async () => {
        await service.saveCouncil(1, {
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [{ positionTitle: "Chair", memberName: "Maria" }],
          financeCouncilMembers: [],
        }, 1);
      },
      (err) => err.message === "Simulated Database Rollback"
    );

    assert.equal(deletedR2Keys.length, 0, "No R2 photo cleanup must occur if transaction fails or rolls back");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("17. Cleanup never deletes an object referenced by a surviving member", async () => {
  const deletedR2Keys = [];
  const mockRepo = new ParishCouncilRepository();
  mockRepo.isPhotoKeyReferenced = async (key) => {
    return key === "shared-key.jpg";
  };

  const mockR2 = {
    delete: async (key) => {
      deletedR2Keys.push(key);
    },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0, photoObjectKey: "shared-key.jpg" },
            { id: 102, councilType: "PASTORAL", positionTitle: "P2", memberName: "M2", sortOrder: 1, photoObjectKey: "shared-key.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        findMany: async () => [
          { id: 101, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "P1", memberName: "M1", sortOrder: 0, photoObjectKey: "shared-key.jpg" },
        ],
        update: async () => ({ id: 1 }),
        create: async () => ({ id: 1 }),
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 101, positionTitle: "P1", memberName: "M1" },
      ],
      financeCouncilMembers: [],
    }, 1);

    assert.equal(deletedR2Keys.length, 0, "Shared photo key must NOT be deleted while referenced by surviving member");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("18. No legacy fallback can reuse-and-delete the same key", async () => {
  const serviceCode = fs.readFileSync(
    path.join(process.cwd(), "services/ParishCouncilService.js"),
    "utf-8"
  );
  assert.doesNotMatch(serviceCode, /deleteAndRecreateMembers/i);
  assert.doesNotMatch(serviceCode, /fallbackToRecreation/i);
  assert.match(serviceCode, /tx\.parishCouncilMember\.update/);
  assert.match(serviceCode, /photoUrl:\s*null/);
  assert.match(serviceCode, /photoObjectKey:\s*null/);
  assert.match(serviceCode, /orphanedPhotoKeys/);
});

test("19. PFC disable/re-enable execution preserves same member IDs/photos", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  let pfcMembersDeleted = false;

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      user: { findUnique: async () => ({ id: 1, role: { roleName: "SECRETARY" } }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: true,
          members: [
            { id: 201, councilType: "FINANCE", memberName: "PFC Member", positionTitle: "Auditor", sortOrder: 0, photoObjectKey: "pfc.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        deleteMany: async (args) => {
          if (args?.where?.councilType === "FINANCE" || (args?.where?.id?.in && args.where.id.in.includes(201))) {
            pfcMembersDeleted = true;
          }
        },
        createMany: async () => ({ count: 1 }),
        update: async () => ({ id: 1 }),
        create: async () => ({ id: 1 }),
        findMany: async () => [],
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [{ positionTitle: "Chair", memberName: "Juan" }],
      financeCouncilMembers: [],
    }, 1);

    assert.equal(pfcMembersDeleted, false, "Dormant PFC member rows must NOT be deleted when PFC is disabled");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("20. Enabled PFC zero-member validation remains intact", () => {
  assert.throws(
    () => {
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: true,
        pastoralCouncilMembers: [{ positionTitle: "Chair", memberName: "Juan" }],
        financeCouncilMembers: [],
      });
    },
    (err) => err.name === "ZodError"
  );
});

// ============================================================================
// CONCURRENCY / R2 TESTS (21 - 27)
// ============================================================================

test("21. replace → replace race cannot leave DB pointing to deleted object", async () => {
  let currentDbState = {
    id: 101,
    photoUrl: "https://r2/key0.jpg",
    photoObjectKey: "key0.jpg",
    councilConfigurationId: 10,
    councilConfiguration: { parishId: 1 },
  };
  const deletedKeys = [];

  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => currentDbState,
    isPhotoKeyReferenced: async (k) => currentDbState.photoObjectKey === k,
    executeLockedPhotoUpdate: async (memberId, parishId, updateData) => {
      const oldKey = currentDbState.photoObjectKey;
      currentDbState = { ...currentDbState, ...updateData };
      return { updatedMember: currentDbState, oldKey };
    },
  };

  const mockR2 = {
    upload: async ({ key }) => `https://r2/${key}`,
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const file1 = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "1.jpg" };
  const file2 = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "2.jpg" };

  await service.uploadOfficerPhoto(1, 101, file1, 1);
  const keyAfterA = currentDbState.photoObjectKey;

  await service.uploadOfficerPhoto(1, 101, file2, 1);
  const keyAfterB = currentDbState.photoObjectKey;

  assert.notEqual(keyAfterA, keyAfterB);
  assert.equal(currentDbState.photoObjectKey, keyAfterB);
  assert.ok(deletedKeys.includes("key0.jpg"), "Key 0 must be deleted");
  assert.ok(deletedKeys.includes(keyAfterA), "Key 1 must be deleted after replacement by Key 2");
  assert.ok(!deletedKeys.includes(keyAfterB), "Current key in DB must NOT be deleted");
});

test("22. replace → replace loser cleans its orphan", async () => {
  const deletedKeys = [];
  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => ({
      id: 101,
      councilConfiguration: { parishId: 1 },
      photoObjectKey: "old.jpg",
    }),
    executeLockedPhotoUpdate: async () => {
      const err = new Error("Council member was updated or removed concurrently.");
      err.code = "COUNCIL_MEMBER_STALE";
      err.statusCode = 409;
      throw err;
    },
  };

  let uploadedKey = null;
  const mockR2 = {
    upload: async ({ key }) => {
      uploadedKey = key;
      return `https://r2/${key}`;
    },
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  const file = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "a.jpg" };

  await assert.rejects(
    async () => service.uploadOfficerPhoto(1, 101, file, 1),
    (err) => err.code === "COUNCIL_MEMBER_STALE"
  );

  assert.ok(uploadedKey);
  assert.ok(deletedKeys.includes(uploadedKey), "Loser's newly uploaded orphan key must be cleaned up from R2");
});

test("23. replace → remove race leaves authoritative final state only", async () => {
  let currentDbState = {
    id: 101,
    photoUrl: "https://r2/initial.jpg",
    photoObjectKey: "initial.jpg",
    councilConfigurationId: 10,
    councilConfiguration: { parishId: 1 },
  };
  const deletedKeys = [];

  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => currentDbState,
    isPhotoKeyReferenced: async (k) => currentDbState.photoObjectKey === k,
    executeLockedPhotoUpdate: async (memberId, parishId, updateData) => {
      const oldKey = currentDbState.photoObjectKey;
      currentDbState = { ...currentDbState, ...updateData };
      return { updatedMember: currentDbState, oldKey };
    },
  };

  const mockR2 = {
    upload: async ({ key }) => `https://r2/${key}`,
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const file = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "rep.jpg" };
  await service.uploadOfficerPhoto(1, 101, file, 1);
  const replacedKey = currentDbState.photoObjectKey;

  await service.removeOfficerPhoto(1, 101, 1);

  assert.equal(currentDbState.photoUrl, null);
  assert.equal(currentDbState.photoObjectKey, null);
  assert.ok(deletedKeys.includes("initial.jpg"));
  assert.ok(deletedKeys.includes(replacedKey));
});

test("24. remove does not delete a newer replacement object", async () => {
  const deletedKeys = [];
  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => ({
      id: 101,
      councilConfiguration: { parishId: 1 },
      photoObjectKey: "stale-key0.jpg",
    }),
    executeLockedPhotoUpdate: async () => {
      return {
        updatedMember: { id: 101, photoUrl: null, photoObjectKey: null },
        oldKey: null,
      };
    },
  };

  const mockR2 = {
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  await service.removeOfficerPhoto(1, 101, 1);

  assert.equal(deletedKeys.length, 0, "Remove must not delete any key when authoritative oldKey was null");
});

test("25. replace → member-delete race does not orphan or resurrect", async () => {
  let uploadedKey = null;
  const deletedKeys = [];

  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => ({
      id: 101,
      councilConfiguration: { parishId: 1 },
      photoObjectKey: "old.jpg",
    }),
    executeLockedPhotoUpdate: async () => {
      const err = new Error("Council member was not found or was removed by another session.");
      err.statusCode = 404;
      err.code = "COUNCIL_MEMBER_STALE";
      throw err;
    },
  };

  const mockR2 = {
    upload: async ({ key }) => {
      uploadedKey = key;
      return `https://r2/${key}`;
    },
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  const file = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "pic.jpg" };

  await assert.rejects(
    async () => service.uploadOfficerPhoto(1, 101, file, 1),
    (err) => err.code === "COUNCIL_MEMBER_STALE" && err.statusCode === 404
  );

  assert.ok(uploadedKey);
  assert.ok(deletedKeys.includes(uploadedKey), "Newly uploaded object must be deleted when member was deleted concurrently");
});

test("26. stale member after upload causes new-object cleanup", async () => {
  let uploadedKey = null;
  const deletedKeys = [];

  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => ({
      id: 101,
      councilConfiguration: { parishId: 1 },
      photoObjectKey: null,
    }),
    executeLockedPhotoUpdate: async () => {
      const err = new Error("Stale member ID");
      err.statusCode = 404;
      err.code = "COUNCIL_MEMBER_STALE";
      throw err;
    },
  };

  const mockR2 = {
    upload: async ({ key }) => {
      uploadedKey = key;
      return `https://r2/${key}`;
    },
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  const file = { mimetype: "image/png", size: 1000, buffer: VALID_PNG_BUF, originalname: "officer.png" };

  await assert.rejects(
    async () => service.uploadOfficerPhoto(1, 101, file, 1),
    (err) => err.code === "COUNCIL_MEMBER_STALE"
  );

  assert.ok(deletedKeys.includes(uploadedKey), "New upload must be cleaned up on stale member error");
});

test("27. post-commit old cleanup failure does not corrupt DB", async () => {
  const mockRepo = {
    findParishById: async () => ({ id: 1, isActive: true }),
    findMemberById: async () => ({
      id: 101,
      councilConfiguration: { parishId: 1 },
      photoObjectKey: "old-key.jpg",
    }),
    isPhotoKeyReferenced: async () => false,
    executeLockedPhotoUpdate: async (memberId, parishId, updateData) => {
      return {
        updatedMember: { id: memberId, ...updateData },
        oldKey: "old-key.jpg",
      };
    },
  };

  const mockR2 = {
    upload: async ({ key }) => `https://r2/${key}`,
    delete: async () => {
      throw new Error("R2 503 Service Unavailable");
    },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  const file = { mimetype: "image/webp", size: 1000, buffer: VALID_WEBP_BUF, originalname: "officer.webp" };

  const res = await service.uploadOfficerPhoto(1, 101, file, 1);
  assert.equal(res.memberId, "101");
  assert.match(res.photoUrl, /^https:\/\/r2\//);
});

// ============================================================================
// EXISTING PHOTO & POLICY TESTS (28 - 35)
// ============================================================================

test("28. JPEG valid", () => {
  const file = {
    mimetype: "image/jpeg",
    size: 500000,
    buffer: VALID_JPEG_BUF,
    originalname: "officer.jpg",
  };
  assert.doesNotThrow(() => {
    FileValidator.validateCouncilOfficerPhoto(file);
  });
});

test("29. PNG valid", () => {
  const file = {
    mimetype: "image/png",
    size: 800000,
    buffer: VALID_PNG_BUF,
    originalname: "officer.png",
  };
  assert.doesNotThrow(() => {
    FileValidator.validateCouncilOfficerPhoto(file);
  });
});

test("30. WebP valid", () => {
  const file = {
    mimetype: "image/webp",
    size: 600000,
    buffer: VALID_WEBP_BUF,
    originalname: "officer.webp",
  };
  assert.doesNotThrow(() => {
    FileValidator.validateCouncilOfficerPhoto(file);
  });
});

test("31. invalid magic bytes rejected", () => {
  const fakeImageFile = {
    mimetype: "image/jpeg",
    size: 2000,
    buffer: INVALID_MAGIC_BUF,
    originalname: "fake.jpg",
  };

  assert.throws(
    () => {
      FileValidator.validateCouncilOfficerPhoto(fakeImageFile);
    },
    (err) => err.code === "COUNCIL_IMAGE_TYPE_INVALID" && err.statusCode === 400
  );
});

test("32. >2MB rejected", () => {
  const oversizedFile = {
    mimetype: "image/png",
    size: 2.5 * 1024 * 1024,
    buffer: VALID_PNG_BUF,
    originalname: "huge.png",
  };

  assert.throws(
    () => {
      FileValidator.validateCouncilOfficerPhoto(oversizedFile);
    },
    (err) => err.code === "COUNCIL_IMAGE_TOO_LARGE" && err.statusCode === 413
  );
});

test("33. role/tenant restrictions", async () => {
  // Coordinator may access all parishes
  const coordinatorReq = {
    user: { id: 101, role: "DIOCESE_COORDINATOR", parish: null },
  };
  assert.equal(await validateParishAccess(coordinatorReq, 5), true);
  assert.equal(await validateParishAccess(coordinatorReq, 99), true);

  // Secretary may access own parish only
  const secretaryReq = {
    user: { id: 201, role: "SECRETARY", parish: { id: 5 } },
  };
  assert.equal(await validateParishAccess(secretaryReq, 5), true);
  await assert.rejects(
    async () => validateParishAccess(secretaryReq, 6),
    (err) => err.statusCode === 403
  );

  // Priest forbidden from mutating council
  const priestMiddleware = checkRole(["DIOCESE_COORDINATOR", "SECRETARY"]);
  let priestStatus = null;
  priestMiddleware(
    { user: { id: 301, role: "PRIEST", parish: { id: 5 } } },
    { status: (s) => ({ json: () => { priestStatus = s; } }) },
    () => {}
  );
  assert.equal(priestStatus, 403);

  // Parishioner forbidden from mutating council
  let parishionerStatus = null;
  priestMiddleware(
    { user: { id: 401, role: "PARISHIONER", parish: { id: 5 } } },
    { status: (s) => ({ json: () => { parishionerStatus = s; } }) },
    () => {}
  );
  assert.equal(parishionerStatus, 403);
});

test("34. PFC `relative` test", () => {
  const pfcEditorPath = path.resolve(
    process.cwd(),
    "../testimonium-admin-portal/src/components/settings/ParishFinanceCouncilEditor.tsx"
  );
  assert.ok(fs.existsSync(pfcEditorPath), "PFC editor component file must exist");
  const pfcContent = fs.readFileSync(pfcEditorPath, "utf-8");

  // Invariant: label must include relative class and peer checkbox
  assert.match(
    pfcContent,
    /<label className="relative flex items-center/,
    "PFC toggle label must preserve 'relative' class"
  );
  assert.match(
    pfcContent,
    /className="sr-only peer"/,
    "PFC toggle input must preserve 'sr-only peer'"
  );
});

test("35. public DTO excludes photoObjectKey", () => {
  const rawParish = {
    id: 1,
    parishName: "St. John the Baptist Parish",
    type: "PARISH",
    address: "123 Catholic Way",
    municipalityCity: "Canlaon City",
    province: "Negros Oriental",
    latitude: 10.3,
    longitude: 123.2,
    coverImage: "https://example.com/cover.jpg",
    gallery: [],
    contactNumber: "09123456789",
    email: "stjohn@example.com",
    officeHours: null,
    patronSaint: "St. John the Baptist",
    feastDay: "June 24",
    directoryDescription: "Catholic parish",
    users: [],
    councilConfiguration: {
      id: 10,
      parishId: 1,
      version: 1,
      financeCouncilEnabled: true,
      members: [
        {
          councilType: "PASTORAL",
          positionTitle: "Chairperson",
          memberName: "Juan Dela Cruz",
          sortOrder: 0,
          photoUrl: "https://r2.testimonium.ph/councils/parish_1/officers/test.jpg",
          photoObjectKey: "councils/parish_1/officers/test.jpg",
        },
        {
          councilType: "FINANCE",
          positionTitle: "Auditor",
          memberName: "Clara Garcia",
          sortOrder: 0,
          photoUrl: null,
          photoObjectKey: null,
        },
      ],
    },
  };

  const parishService = new ParishService();
  const dto = parishService.mapToDto(rawParish);

  assert.ok(dto.councils);
  assert.equal(dto.councils.pastoral.members[0].photoUrl, "https://r2.testimonium.ph/councils/parish_1/officers/test.jpg");
  assert.equal(dto.councils.pastoral.members[0].photoObjectKey, undefined, "photoObjectKey MUST NOT be exposed in public DTO");
  assert.equal(dto.councils.finance.members[0].photoUrl, null);
  assert.equal(dto.councils.finance.members[0].photoObjectKey, undefined);
});

// ============================================================================
// PHASE 3 FINAL CORRECTION: 10 FOCUSED TESTS (BLOCKER 1 & BLOCKER 2)
// ============================================================================

test("36. Blocker 1: absent ID creates new member", async () => {
  const parsed = saveCouncilSchema.parse({
    expectedVersion: 1,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [
      { positionTitle: "Secretary", memberName: "Juan Dela Cruz" },
    ],
    financeCouncilMembers: [],
  });
  assert.equal(parsed.pastoralCouncilMembers[0].id, undefined);

  let insertedData = [];
  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({ id: 10, parishId: 1, version: 1, financeCouncilEnabled: false, members: [] }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        deleteMany: async () => {},
        createMany: async ({ data }) => {
          insertedData = data;
        },
      },
    });
  };

  try {
    const service = new ParishCouncilService();
    await service.saveCouncil(1, parsed, 1);
    assert.equal(insertedData.length, 1);
    assert.equal(insertedData[0].memberName, "Juan Dela Cruz");
    assert.equal(insertedData[0].positionTitle, "Secretary");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("37. Blocker 1: malformed ID rejected (not-an-id, empty string, zero, negative, decimal, null, abc)", async () => {
  const malformedIds = ["not-an-id", "", 0, -1, 1.5, null, "abc", "0", "-1"];
  const service = new ParishCouncilService();

  for (const badId of malformedIds) {
    // 1. Schema must reject
    assert.throws(
      () => {
        saveCouncilSchema.parse({
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [
            { id: badId, positionTitle: "Chair", memberName: "Test" },
          ],
          financeCouncilMembers: [],
        });
      },
      (err) => err.name === "ZodError",
      `saveCouncilSchema must reject badId: ${badId}`
    );

    // 2. Direct service call must also reject with 400 INVALID_COUNCIL_PAYLOAD
    await assert.rejects(
      async () => {
        await service.saveCouncil(1, {
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [
            { id: badId, positionTitle: "Chair", memberName: "Test" },
          ],
          financeCouncilMembers: [],
        }, 1);
      },
      (err) => err.code === "INVALID_COUNCIL_PAYLOAD" && err.statusCode === 400,
      `service.saveCouncil must reject badId: ${badId}`
    );
  }
});

test("38. Blocker 1: partial numeric ID rejected (123junk, 12.3)", async () => {
  const partialIds = ["123junk", "12.3", " 123 ", "123a"];
  const service = new ParishCouncilService();

  for (const badId of partialIds) {
    // 1. Schema must reject
    assert.throws(
      () => {
        saveCouncilSchema.parse({
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [
            { id: badId, positionTitle: "Chair", memberName: "Test" },
          ],
          financeCouncilMembers: [],
        });
      },
      (err) => err.name === "ZodError",
      `saveCouncilSchema must reject partialId: ${badId}`
    );

    // 2. Service call must reject with 400
    await assert.rejects(
      async () => {
        await service.saveCouncil(1, {
          expectedVersion: 1,
          financeCouncilEnabled: false,
          pastoralCouncilMembers: [
            { id: badId, positionTitle: "Chair", memberName: "Test" },
          ],
          financeCouncilMembers: [],
        }, 1);
      },
      (err) => err.code === "INVALID_COUNCIL_PAYLOAD" && err.statusCode === 400,
      `service.saveCouncil must reject partialId: ${badId}`
    );
  }
});

test("39. Blocker 1: valid persisted ID accepted (numeric and whole-string numeric)", async () => {
  // Numeric 101
  const parsedNum = saveCouncilSchema.parse({
    expectedVersion: 1,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [
      { id: 101, positionTitle: "Chair", memberName: "Test" },
    ],
    financeCouncilMembers: [],
  });
  assert.equal(parsedNum.pastoralCouncilMembers[0].id, 101);

  // String "101"
  const parsedStr = saveCouncilSchema.parse({
    expectedVersion: 1,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [
      { id: "101", positionTitle: "Chair", memberName: "Test" },
    ],
    financeCouncilMembers: [],
  });
  assert.equal(parsedStr.pastoralCouncilMembers[0].id, 101);

  // Service execution: updates in place
  let updatedRow = null;
  let createdCount = 0;
  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "Old", memberName: "Old", sortOrder: 0 },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        update: async (args) => {
          updatedRow = args;
          return args.data;
        },
        createMany: async () => {
          createdCount++;
        },
        deleteMany: async () => {},
      },
    });
  };

  try {
    const service = new ParishCouncilService();
    await service.saveCouncil(1, parsedStr, 1);
    assert.equal(updatedRow.where.id, 101);
    assert.equal(createdCount, 0, "Valid persisted ID must update, not insert");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("40. Blocker 1: malformed ID can NEVER reach membersToInsert", async () => {
  const createdMembers = [];
  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({ id: 10, parishId: 1, version: 1, financeCouncilEnabled: false, members: [] }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        createMany: async ({ data }) => {
          createdMembers.push(...data);
        },
        deleteMany: async () => {},
      },
    });
  };

  try {
    const service = new ParishCouncilService();
    const badPayloads = [
      { id: "not-an-id", positionTitle: "Lead", memberName: "Tester" },
      { id: "123junk", positionTitle: "Lead", memberName: "Tester" },
      { id: 0, positionTitle: "Lead", memberName: "Tester" },
      { id: -1, positionTitle: "Lead", memberName: "Tester" },
      { id: 1.5, positionTitle: "Lead", memberName: "Tester" },
      { id: null, positionTitle: "Lead", memberName: "Tester" },
      { id: "", positionTitle: "Lead", memberName: "Tester" },
    ];

    for (const member of badPayloads) {
      await assert.rejects(
        async () => {
          await service.saveCouncil(1, {
            expectedVersion: 1,
            financeCouncilEnabled: false,
            pastoralCouncilMembers: [member],
            financeCouncilMembers: [],
          }, 1);
        },
        (err) => err.code === "INVALID_COUNCIL_PAYLOAD" && err.statusCode === 400
      );
    }

    assert.equal(createdMembers.length, 0, "No malformed ID payload should EVER be passed to createMany");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("41. Blocker 2 (CASE A): replace commits N before saveCouncil deletion -> saveCouncil sees N after lock -> N queued/cleaned", async () => {
  const deletedR2Keys = [];
  const mockRepo = new ParishCouncilRepository();
  mockRepo.isPhotoKeyReferenced = async () => false;

  const mockR2 = {
    delete: async (k) => { deletedR2Keys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          // Pre-lock snapshot held old key 'key-O.jpg'
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "Chair", memberName: "Maria", sortOrder: 0, photoObjectKey: "key-O.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      // When saveCouncil acquires row lock with $queryRaw FOR UPDATE,
      // it sees committed state key-N.jpg from photo replace
      $queryRaw: async () => [
        {
          id: 101,
          councilConfigurationId: 10,
          councilType: "PASTORAL",
          positionTitle: "Chair",
          memberName: "Maria",
          sortOrder: 0,
          photoUrl: "https://r2/key-N.jpg",
          photoObjectKey: "key-N.jpg",
        },
      ],
      parishCouncilMember: {
        deleteMany: async () => {},
      },
    });
  };

  try {
    // saveCouncil is deleting member 101 (payload has empty members)
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [],
      financeCouncilMembers: [],
    }, 1);

    // Must have cleaned up key-N.jpg (the post-lock authoritative key), NOT leaving it orphaned!
    assert.ok(deletedR2Keys.includes("key-N.jpg"), "Concurrent replacement key N must be cleaned up post-commit");
    assert.ok(!deletedR2Keys.includes("key-O.jpg"), "Stale pre-lock key O was already handled by replace transaction");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("42. Blocker 2 (CASE B): saveCouncil deletes first -> later replace gets stale/missing member -> uploaded new object cleaned", async () => {
  let uploadedKey = null;
  const deletedR2Keys = [];

  // Simulate repository where member was deleted by saveCouncil
  const mockRepo = new ParishCouncilRepository();
  mockRepo.findParishById = async () => ({ id: 1, isActive: true });
  mockRepo.findMemberById = async () => ({
    id: 101,
    councilConfiguration: { parishId: 1 },
    photoObjectKey: "initial.jpg",
  });
  // Inside executeLockedPhotoUpdate, row lock sees member deleted/missing
  mockRepo.executeLockedPhotoUpdate = async () => {
    const err = new Error("Council member was not found or was removed by another session.");
    err.statusCode = 404;
    err.code = "COUNCIL_MEMBER_STALE";
    throw err;
  };

  const mockR2 = {
    upload: async ({ key }) => {
      uploadedKey = key;
      return `https://r2/${key}`;
    },
    delete: async (k) => {
      deletedR2Keys.push(k);
    },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);
  const file = { mimetype: "image/jpeg", size: 1000, buffer: VALID_JPEG_BUF, originalname: "photo.jpg" };

  await assert.rejects(
    async () => service.uploadOfficerPhoto(1, 101, file, 1),
    (err) => err.code === "COUNCIL_MEMBER_STALE" && err.statusCode === 404
  );

  assert.ok(uploadedKey, "Upload occurred before row lock check");
  assert.ok(deletedR2Keys.includes(uploadedKey), "Uploaded object must be cleaned when member was already deleted");
});

test("43. Blocker 2: deletion cleanup uses post-lock authoritative key, not stale pre-lock key", async () => {
  const deletedKeys = [];
  const mockRepo = new ParishCouncilRepository();
  mockRepo.isPhotoKeyReferenced = async () => false;

  const mockR2 = {
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            // Stale pre-lock key
            { id: 101, councilType: "PASTORAL", positionTitle: "Officer", memberName: "Name", sortOrder: 0, photoObjectKey: "stale-key.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      // Authoritative post-lock row returned by SELECT ... FOR UPDATE
      $queryRaw: async () => [
        {
          id: 101,
          councilConfigurationId: 10,
          councilType: "PASTORAL",
          positionTitle: "Officer",
          memberName: "Name",
          sortOrder: 0,
          photoUrl: "https://r2/authoritative-key.jpg",
          photoObjectKey: "authoritative-key.jpg",
        },
      ],
      parishCouncilMember: {
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [], // member 101 deleted
      financeCouncilMembers: [],
    }, 1);

    assert.ok(deletedKeys.includes("authoritative-key.jpg"), "Authoritative post-lock key must be queued and cleaned");
    assert.ok(!deletedKeys.includes("stale-key.jpg"), "Stale pre-lock key must not be queued");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("44. Blocker 2: multiple saveCouncil row locks use deterministic ascending ID ordering", async () => {
  const repo = new ParishCouncilRepository();
  let capturedQuery = null;

  const mockTx = {
    $queryRaw: async (strings, ...values) => {
      // Reconstruct query text
      capturedQuery = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
      return [];
    },
  };

  await repo.lockCouncilMembersForUpdate(10, mockTx);

  assert.ok(capturedQuery, "Query must have executed");
  assert.match(capturedQuery, /ORDER BY\s+"member_id"\s+ASC/i, "Locking query must order by member_id ASC deterministically");
  assert.match(capturedQuery, /FOR UPDATE/i, "Locking query must use FOR UPDATE");
  assert.match(capturedQuery, /WHERE\s+"council_configuration_id"\s*=\s*10/i, "Must target council configuration members");
});

test("45. Blocker 2: surviving-reference check remains intact", async () => {
  const deletedKeys = [];
  const mockRepo = new ParishCouncilRepository();
  // Simulate surviving member still references the key
  mockRepo.isPhotoKeyReferenced = async (key) => key === "shared-photo.jpg";

  const mockR2 = {
    delete: async (k) => { deletedKeys.push(k); },
  };

  const service = new ParishCouncilService(mockRepo, mockR2);

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    return callback({
      parish: { findUnique: async () => ({ id: 1, isActive: true }) },
      activityLog: { create: async () => ({ id: 1 }) },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 1,
          financeCouncilEnabled: false,
          members: [
            { id: 101, councilType: "PASTORAL", positionTitle: "Officer 1", memberName: "Deleted", sortOrder: 0, photoObjectKey: "shared-photo.jpg" },
            { id: 102, councilType: "PASTORAL", positionTitle: "Officer 2", memberName: "Surviving", sortOrder: 1, photoObjectKey: "shared-photo.jpg" },
          ],
        }),
        updateMany: async () => ({ count: 1 }),
      },
      $queryRaw: async () => [
        { id: 101, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "Officer 1", memberName: "Deleted", sortOrder: 0, photoObjectKey: "shared-photo.jpg" },
        { id: 102, councilConfigurationId: 10, councilType: "PASTORAL", positionTitle: "Officer 2", memberName: "Surviving", sortOrder: 1, photoObjectKey: "shared-photo.jpg" },
      ],
      parishCouncilMember: {
        update: async () => ({ id: 1 }),
        deleteMany: async () => {},
      },
    });
  };

  try {
    await service.saveCouncil(1, {
      expectedVersion: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [
        { id: 102, positionTitle: "Officer 2", memberName: "Surviving" },
      ], // Only 102 kept, 101 deleted
      financeCouncilMembers: [],
    }, 1);

    assert.equal(deletedKeys.length, 0, "Shared photo key MUST NOT be deleted from R2 because surviving member still references it");
  } finally {
    prisma.$transaction = originalTx;
  }
});
