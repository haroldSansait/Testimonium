import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ParishService } from "../services/ParishService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { prisma } from "../config/db.js";

const motherConflict = () => Object.assign(new Error("unique violation"), {
  code: "P2002",
  meta: { constraint: "parishes_single_mother_parish_idx" },
});

const makeRepository = (rows) => ({
  mapTypeToEnum: (type) => type,
  findById: async (id) => ({ ...rows.find((row) => row.id === id), users: [] }),
});

const withPrismaMocks = async (transaction, rows, run) => {
  const originalTransaction = prisma.$transaction;
  const originalFindUnique = prisma.parish.findUnique;
  const originalAuditLog = AuditLogService.log;
  try {
    prisma.parish.findUnique = async ({ where }) => rows.find((row) =>
      (where.parishName && row.parishName === where.parishName) ||
      (where.slug && row.slug === where.slug)
    ) || null;
    prisma.$transaction = transaction;
    AuditLogService.log = async () => undefined;
    await run();
  } finally {
    prisma.$transaction = originalTransaction;
    prisma.parish.findUnique = originalFindUnique;
    AuditLogService.log = originalAuditLog;
  }
};

const createTx = (rows, { hideExistingMother = false } = {}) => ({
  parish: {
    findUnique: async ({ where }) => rows.find((row) =>
      (where.parishName && row.parishName === where.parishName) ||
      (where.slug && row.slug === where.slug)
    ) || null,
    findFirst: async () => hideExistingMother
      ? null
      : rows.find((row) => row.isMotherParish === true) || null,
    create: async ({ data }) => {
      if (data.isMotherParish && rows.some((row) => row.isMotherParish)) throw motherConflict();
      const row = { id: rows.length + 1, ...data };
      rows.push(row);
      return row;
    },
  },
  parishWeekdayRule: { createMany: async () => ({ count: 7 }) },
  parishServiceWeekdayRule: { createMany: async () => ({ count: 3 }) },
  massScheduleTemplate: { create: async () => ({ id: 1 }) },
  parishCouncilConfiguration: { create: async () => ({ id: 1 }) },
});

const createPayload = (name, isMotherParish) => ({
  parishInfo: {
    name,
    type: "PARISH",
    address: "Canlaon City, Negros Oriental",
    isMotherParish,
  },
});

test("single Mother Parish create behavior", async () => {
  const rows = [];
  const tx = createTx(rows);
  await withPrismaMocks(async (callback) => callback(tx), rows, async () => {
    const service = new ParishService(makeRepository(rows));
    const ordinary = await service.createParish(createPayload("Ordinary Parish", false), 1, "DIOCESE_COORDINATOR");
    assert.equal(ordinary.isMotherParish, false);

    const mother = await service.createParish(createPayload("Mother Parish", true), 1, "DIOCESE_COORDINATOR");
    assert.equal(mother.isMotherParish, true);

    await assert.rejects(
      service.createParish(createPayload("Second Mother Parish", true), 1, "DIOCESE_COORDINATOR"),
      (error) => error.statusCode === 409 && error.code === "MOTHER_PARISH_ALREADY_EXISTS"
    );
    assert.equal(rows.filter((row) => row.isMotherParish).length, 1);
  });
});

test("single Mother Parish edit behavior is explicit and idempotent", async () => {
  const rows = [
    { id: 1, parishName: "St. Joseph Parish", isMotherParish: true, users: [], schedulingConfigVersion: 1 },
    { id: 2, parishName: "Holy Child Parish", isMotherParish: false, users: [], schedulingConfigVersion: 1 },
  ];
  const tx = {
    parish: {
      findUnique: async ({ where }) => rows.find((row) => row.id === where.id) || null,
      findFirst: async ({ where }) => rows.find((row) =>
        row.isMotherParish === true && row.id !== where.id?.not
      ) || null,
      update: async ({ where, data }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };

  await withPrismaMocks(async (callback, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    return callback(tx);
  }, rows, async () => {
    const service = new ParishService(makeRepository(rows));

    await assert.rejects(
      service.editParish(2, { isMotherParish: true }, 1, "DIOCESE_COORDINATOR"),
      (error) => error.statusCode === 409 && error.code === "MOTHER_PARISH_ALREADY_EXISTS"
    );

    const idempotent = await service.editParish(1, { isMotherParish: true }, 1, "DIOCESE_COORDINATOR");
    assert.equal(idempotent.isMotherParish, true);

    const unset = await service.editParish(1, { isMotherParish: false }, 1, "DIOCESE_COORDINATOR");
    assert.equal(unset.isMotherParish, false);

    const transferred = await service.editParish(2, { isMotherParish: true }, 1, "DIOCESE_COORDINATOR");
    assert.equal(transferred.isMotherParish, true);
    assert.equal(rows.filter((row) => row.isMotherParish).length, 1);

    const ordinaryEdit = await service.editParish(1, { contactNumber: "12345" }, 1, "DIOCESE_COORDINATOR");
    assert.equal(ordinaryEdit.contactNumber, "12345");
  });
});

test("non-coordinators cannot modify the Mother Parish designation", async () => {
  const service = new ParishService(makeRepository([]));
  await assert.rejects(
    service.createParish(createPayload("Unauthorized", true), 3, "SECRETARY"),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN"
  );
  await assert.rejects(
    service.editParish(1, { isMotherParish: false }, 3, "PRIEST"),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN"
  );
});

test("partial unique index closes the simultaneous-create race", async () => {
  const rows = [];
  let waiting = 0;
  let releaseChecks;
  const checksReady = new Promise((resolve) => { releaseChecks = resolve; });
  const tx = createTx(rows, { hideExistingMother: true });
  tx.parish.findFirst = async () => {
    waiting += 1;
    if (waiting === 2) releaseChecks();
    await checksReady;
    return null;
  };

  await withPrismaMocks(async (callback) => callback(tx), rows, async () => {
    const service = new ParishService(makeRepository(rows));
    const results = await Promise.allSettled([
      service.createParish(createPayload("Concurrent A", true), 1, "DIOCESE_COORDINATOR"),
      service.createParish(createPayload("Concurrent B", true), 1, "DIOCESE_COORDINATOR"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.equal(rejected.reason.statusCode, 409);
    assert.equal(rejected.reason.code, "MOTHER_PARISH_ALREADY_EXISTS");
    assert.equal(rows.filter((row) => row.isMotherParish).length, 1);
  });
});

test("migration enforces only true rows and no hierarchy is reintroduced", () => {
  const migration = fs.readFileSync(path.join(
    process.cwd(),
    "prisma/migrations/20260928180000_enforce_single_mother_parish/migration.sql"
  ), "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX "parishes_single_mother_parish_idx"/);
  assert.match(migration, /ON "parishes" \("is_mother_parish"\)/);
  assert.match(migration, /WHERE "is_mother_parish" = true/);

  const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.match(schema, /isMotherParish\s+Boolean\s+@default\(false\)/);
  assert.doesNotMatch(schema, /motherParishId|childParishes|MotherChildParish/);
});
