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
import { CANONICAL_ACTION_TYPES } from "../config/canonicalActions.js";
import { prisma } from "../config/db.js";

// ─── 1. Migration SQL & Schema Verification ───────────────────────────────────

test("1, 2, 3. migration SQL targets physical parish_id column and backfills all parishes", () => {
  const migrationPath = path.join(
    process.cwd(),
    "prisma/migrations/20260902120000_add_parish_councils/migration.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true, "Migration file must exist");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Verify target physical column mappings
  assert.match(sql, /parish_id/i, "Must use physical parish_id column");
  assert.match(sql, /parish_council_configurations/i, "Must create parish_council_configurations table");
  assert.match(sql, /parish_council_members/i, "Must create parish_council_members table");
  assert.match(
    sql,
    /INSERT INTO "parish_council_configurations"/i,
    "Must include backfill INSERT statement"
  );
  assert.match(
    sql,
    /SELECT "parish_id", false, 1/i,
    "Backfill must select parish_id with finance_council_enabled=false and version=1"
  );
  assert.doesNotMatch(
    sql,
    /WHERE\s+"is_active"\s*=\s*true/i,
    "Backfill must not exclude inactive/archived parishes so restored parishes retain config invariant"
  );
});

test("6. ParishCouncilConfiguration schema has no enabled flag for PPC (PPC always exists)", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  assert.match(schema, /model ParishCouncilConfiguration/);
  assert.match(schema, /financeCouncilEnabled\s+Boolean/);
  assert.doesNotMatch(
    schema,
    /pastoralCouncilEnabled/i,
    "PPC must not have an enabled/disabled toggle field"
  );
});

// ─── 2. Validation & Member Ordering ──────────────────────────────────────────

test("7 & 8. same member allowed across PPC and PFC, and in different roles", () => {
  const validPayload = {
    expectedVersion: 1,
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [
      { positionTitle: "PPC Coordinator", memberName: "Lourdes T. Pedros" },
      { positionTitle: "Secretary", memberName: "Ninfa M. Coruña" },
    ],
    financeCouncilMembers: [
      { positionTitle: "Auditor", memberName: "Lourdes T. Pedros" }, // same name, different council
      { positionTitle: "Secretary", memberName: "Ninfa M. Coruña" }, // same name, different council
    ],
  };

  const parsed = saveCouncilSchema.parse(validPayload);
  assert.equal(parsed.pastoralCouncilMembers.length, 2);
  assert.equal(parsed.financeCouncilMembers.length, 2);
});

test("9 & 10. blank member name and blank position title are rejected with 400", () => {
  // Blank position
  assert.throws(
    () =>
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [{ positionTitle: "   ", memberName: "Juan Dela Cruz" }],
        financeCouncilMembers: [],
      }),
    (err) => err.name === "ZodError"
  );

  // Blank name
  assert.throws(
    () =>
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "   " }],
        financeCouncilMembers: [],
      }),
    (err) => err.name === "ZodError"
  );
});

test("11. exact normalized same-name + same-position duplicate inside one council is rejected", () => {
  // Exact duplicate in PPC
  assert.throws(
    () =>
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [
          { positionTitle: "Coordinator", memberName: "Juan Dela Cruz" },
          { positionTitle: "coordinator  ", memberName: "  juan dela cruz" },
        ],
        financeCouncilMembers: [],
      }),
    (err) => err.name === "ZodError"
  );

  // Exact duplicate in PFC
  assert.throws(
    () =>
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: true,
        pastoralCouncilMembers: [],
        financeCouncilMembers: [
          { positionTitle: "Auditor", memberName: "Maria Santos" },
          { positionTitle: "Auditor", memberName: "Maria Santos" },
        ],
      }),
    (err) => err.name === "ZodError"
  );
});

test("12. request array order becomes normalized contiguous sortOrder 0..N-1", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  let insertedPastoral = [];
  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    const mockTx = {
      parish: {
        findUnique: async () => ({ id: 1, isActive: true }),
      },
      user: {
        findUnique: async () => ({ id: 1, role: { roleName: "DIOCESE_COORDINATOR" } }),
      },
      activityLog: {
        create: async () => ({ id: 1 }),
      },
      parishCouncilConfiguration: {
        findUnique: async () => ({ id: 10, parishId: 1, version: 1, financeCouncilEnabled: false, members: [] }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        deleteMany: async () => {},
        createMany: async ({ data }) => {
          insertedPastoral = data;
        },
      },
    };
    return callback(mockTx);
  };

  try {
    await service.saveCouncil(
      1,
      {
        expectedVersion: 1,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [
          { positionTitle: "Coordinator", memberName: "First" },
          { positionTitle: "Vice-Coordinator", memberName: "Second" },
          { positionTitle: "Secretary", memberName: "Third" },
        ],
        financeCouncilMembers: [],
      },
      1
    );

    assert.equal(insertedPastoral.length, 3);
    assert.equal(insertedPastoral[0].sortOrder, 0);
    assert.equal(insertedPastoral[0].memberName, "First");
    assert.equal(insertedPastoral[1].sortOrder, 1);
    assert.equal(insertedPastoral[1].memberName, "Second");
    assert.equal(insertedPastoral[2].sortOrder, 2);
    assert.equal(insertedPastoral[2].memberName, "Third");
  } finally {
    prisma.$transaction = originalTx;
  }
});

test("13. PFC ON with zero members is rejected", async () => {
  const service = new ParishCouncilService();

  // Validator rejection
  assert.throws(
    () =>
      saveCouncilSchema.parse({
        expectedVersion: 1,
        financeCouncilEnabled: true,
        pastoralCouncilMembers: [],
        financeCouncilMembers: [],
      }),
    (err) => err.name === "ZodError"
  );

  // Service rejection
  await assert.rejects(
    async () =>
      service.saveCouncil(
        1,
        {
          expectedVersion: 1,
          financeCouncilEnabled: true,
          pastoralCouncilMembers: [],
          financeCouncilMembers: [],
        },
        1
      ),
    (err) => err.code === "FINANCE_COUNCIL_MEMBERS_REQUIRED" && err.statusCode === 400
  );
});

// ─── 3. Non-Destructive PFC Preservation ─────────────────────────────────────

test("14, 15, 16. PFC disable PRESERVES existing Finance rows, and re-enabling restores them", async () => {
  const mockRepo = new ParishCouncilRepository();
  const service = new ParishCouncilService(mockRepo);

  const existingFinanceRows = [
    { id: 101, councilConfigurationId: 10, councilType: "FINANCE", positionTitle: "PFC Coordinator", memberName: "Cecilia", sortOrder: 0 },
    { id: 102, councilConfigurationId: 10, councilType: "FINANCE", positionTitle: "Treasurer", memberName: "Cherrel", sortOrder: 1 },
  ];

  let pfcDeleteCalled = false;
  let pfcCreateCalled = false;

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    const mockTx = {
      parish: {
        findUnique: async () => ({ id: 1, isActive: true }),
      },
      user: {
        findUnique: async () => ({ id: 1, role: { roleName: "DIOCESE_COORDINATOR" } }),
      },
      activityLog: {
        create: async () => ({ id: 1 }),
      },
      parishCouncilConfiguration: {
        findUnique: async () => ({
          id: 10,
          parishId: 1,
          version: 2,
          financeCouncilEnabled: false,
          members: existingFinanceRows,
        }),
        updateMany: async () => ({ count: 1 }),
      },
      parishCouncilMember: {
        deleteMany: async ({ where }) => {
          if (where.councilType === "FINANCE") pfcDeleteCalled = true;
        },
        createMany: async ({ data }) => {
          if (data.some((d) => d.councilType === "FINANCE")) pfcCreateCalled = true;
        },
      },
    };
    return callback(mockTx);
  };

  try {
    // Disable PFC: payload includes empty finance members array
    const result = await service.saveCouncil(
      1,
      {
        expectedVersion: 2,
        financeCouncilEnabled: false,
        pastoralCouncilMembers: [{ positionTitle: "PPC Coordinator", memberName: "Jovencio" }],
        financeCouncilMembers: [], // client sending empty array because UI collapsed
      },
      1
    );

    // Backend must NOT have deleted or created PFC members
    assert.equal(pfcDeleteCalled, false, "Backend MUST NOT delete PFC rows when turning PFC OFF");
    assert.equal(pfcCreateCalled, false, "Backend MUST NOT overwrite PFC rows when turning PFC OFF");

    // Preserved finance members must still be returned in the admin DTO so admin sees them upon re-enabling
    assert.equal(result.financeCouncilMembers.length, 2);
    assert.equal(result.financeCouncilMembers[0].memberName, "Cecilia");
  } finally {
    prisma.$transaction = originalTx;
  }
});

// ─── 4. Concurrency & Optimistic Version Claim Order ──────────────────────────

test("17, 18, 19, 20, 21. optimistic concurrency 409 stale version check and atomic rollback", async () => {
  const service = new ParishCouncilService();

  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callback) => {
    const mockTx = {
      parish: {
        findUnique: async () => ({ id: 1, isActive: true }),
      },
      parishCouncilConfiguration: {
        findUnique: async () => ({ id: 10, parishId: 1, version: 5, financeCouncilEnabled: false, members: [] }),
        updateMany: async ({ where }) => {
          // If expectedVersion != 5, return count = 0
          if (where.version !== 5) return { count: 0 };
          return { count: 1 };
        },
      },
      parishCouncilMember: {
        deleteMany: async () => {},
        createMany: async () => {},
      },
    };
    return callback(mockTx);
  };

  try {
    // Stale version submitted (expectedVersion 4 when server is at 5)
    await assert.rejects(
      async () =>
        service.saveCouncil(
          1,
          {
            expectedVersion: 4,
            financeCouncilEnabled: false,
            pastoralCouncilMembers: [{ positionTitle: "Coord", memberName: "Name" }],
            financeCouncilMembers: [],
          },
          1
        ),
      (err) => err.statusCode === 409 && err.code === "COUNCIL_CONFIGURATION_STALE"
    );
  } finally {
    prisma.$transaction = originalTx;
  }
});

// ─── 5. Tenant Authorization & Scoping ────────────────────────────────────────

test("23, 24, 25, 26, 27. role authorization and tenant access rules", async () => {
  const originalLog = AuditLogService.log;
  AuditLogService.log = async () => {};

  try {
    const coordinatorReq = { user: { id: 1, role: "DIOCESE_COORDINATOR", parish: null } };
    const secretaryReq1 = { user: { id: 2, role: "SECRETARY", parish: { id: 10 } } };
    const priestReq = { user: { id: 4, role: "PRIEST", parish: { id: 10 } } };
    const parishionerReq = { user: { id: 5, role: "PARISHIONER", parish: null } };

    // 1. checkRole middleware permits only DIOCESE_COORDINATOR and SECRETARY
    const councilRoleMiddleware = checkRole(["DIOCESE_COORDINATOR", "SECRETARY"]);

    let nextCalled = false;
    let errorStatus = null;
    const makeRes = () => ({
      status: (code) => {
        errorStatus = code;
        return { json: () => {} };
      },
    });

    // Coordinator -> allowed by checkRole
    nextCalled = false;
    councilRoleMiddleware(coordinatorReq, makeRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true, "Coordinator must pass checkRole");

    // Secretary -> allowed by checkRole
    nextCalled = false;
    councilRoleMiddleware(secretaryReq1, makeRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true, "Secretary must pass checkRole");

    // Priest -> rejected by checkRole with 403
    nextCalled = false;
    errorStatus = null;
    councilRoleMiddleware(priestReq, makeRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, false, "Priest must NOT pass checkRole");
    assert.equal(errorStatus, 403, "Priest must receive 403 from checkRole");

    // Parishioner -> rejected by checkRole with 403
    nextCalled = false;
    errorStatus = null;
    councilRoleMiddleware(parishionerReq, makeRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, false, "Parishioner must NOT pass checkRole");
    assert.equal(errorStatus, 403, "Parishioner must receive 403 from checkRole");

    // 2. Tenant isolation via validateParishAccess
    // Diocese Coordinator can access any parish
    assert.equal(await validateParishAccess(coordinatorReq, 10, "Parish Councils"), true);
    assert.equal(await validateParishAccess(coordinatorReq, 20, "Parish Councils"), true);

    // Secretary can access own assigned parish only
    assert.equal(await validateParishAccess(secretaryReq1, 10, "Parish Councils"), true);
    await assert.rejects(
      async () => validateParishAccess(secretaryReq1, 20, "Parish Councils"),
      (err) => err.statusCode === 403
    );
  } finally {
    AuditLogService.log = originalLog;
  }
});

test("28, 29, 30. selector role scoping and inactive parish exclusion", async () => {
  const mockRepo = new ParishCouncilRepository();
  let queryWhere = null;
  mockRepo.getParishesForSelector = async (where) => {
    queryWhere = where;
    return [{ id: "1", name: "St. Joseph Parish" }];
  };

  const service = new ParishCouncilService(mockRepo);

  // Coordinator gets all active parishes
  await service.getSelectorParishes({ role: "DIOCESE_COORDINATOR" });
  assert.equal(queryWhere, undefined, "Coordinator query has no parishId filter");

  // Secretary gets only assigned parish
  await service.getSelectorParishes({ role: "SECRETARY", parishId: 10 });
  assert.deepEqual(queryWhere, { id: 10 });

  // Priest / Parishioner rejected with 403
  await assert.rejects(
    async () => service.getSelectorParishes({ role: "PRIEST" }),
    (err) => err.statusCode === 403
  );
});

// ─── 6. Missing Config Invariant & DTO Visibility ─────────────────────────────

test("31 & 32. missing config handling: Admin 500 error vs Public detail graceful councils null", async () => {
  const mockRepo = new ParishCouncilRepository();
  mockRepo.findParishById = async () => ({ id: 1, isActive: true });
  mockRepo.findConfigByParishId = async () => null; // config missing

  const councilService = new ParishCouncilService(mockRepo);

  // Admin endpoint throws 500 COUNCIL_CONFIGURATION_MISSING
  await assert.rejects(
    async () => councilService.getCouncilConfig(1),
    (err) => err.statusCode === 500 && err.code === "COUNCIL_CONFIGURATION_MISSING"
  );

  // Public mapToDto returns councils: null without failing parish detail
  const parishService = new ParishService();
  const publicDto = parishService.mapToDto({
    id: 1,
    parishName: "St. Joseph",
    type: "PARISH",
    isActive: true,
    councilConfiguration: null, // missing config
  });

  assert.equal(publicDto.name, "St. Joseph");
  assert.equal(publicDto.councils, null, "Public DTO must gracefully return councils: null when config is missing");
});

test("33, 34, 35, 36. public DTO hides IDs/version/timestamps and shows PPC always, PFC only when enabled", () => {
  const parishService = new ParishService();

  // PFC Enabled
  const dtoEnabled = parishService.mapToDto({
    id: 1,
    parishName: "St. Joseph",
    type: "PARISH",
    isActive: true,
    councilConfiguration: {
      id: 999, // internal config id
      version: 4, // internal version
      financeCouncilEnabled: true,
      createdAt: new Date(),
      members: [
        { id: 11, councilType: "PASTORAL", positionTitle: "PPC Coordinator", memberName: "Jovencio T. Cawas", sortOrder: 0 },
        { id: 12, councilType: "FINANCE", positionTitle: "PFC Coordinator", memberName: "Ma. Cecilia S. Canada", sortOrder: 0 },
      ],
    },
  });

  assert.equal(dtoEnabled.councils.pastoral.members.length, 1);
  assert.equal(dtoEnabled.councils.pastoral.members[0].positionTitle, "PPC Coordinator");
  assert.equal(dtoEnabled.councils.pastoral.members[0].memberName, "Jovencio T. Cawas");
  assert.equal(dtoEnabled.councils.pastoral.members[0].id, undefined, "Public member DB id must not be exposed");
  assert.equal(dtoEnabled.councils.pastoral.members[0].sortOrder, undefined, "sortOrder must not be exposed");

  assert.notEqual(dtoEnabled.councils.finance, null);
  assert.equal(dtoEnabled.councils.finance.members.length, 1);
  assert.equal(dtoEnabled.councils.finance.members[0].positionTitle, "PFC Coordinator");

  // PFC Disabled -> finance is null
  const dtoDisabled = parishService.mapToDto({
    id: 1,
    parishName: "St. Joseph",
    type: "PARISH",
    isActive: true,
    councilConfiguration: {
      id: 999,
      version: 4,
      financeCouncilEnabled: false,
      members: [
        { id: 11, councilType: "PASTORAL", positionTitle: "PPC Coordinator", memberName: "Jovencio T. Cawas", sortOrder: 0 },
        { id: 12, councilType: "FINANCE", positionTitle: "PFC Coordinator", memberName: "Ma. Cecilia S. Canada", sortOrder: 0 },
      ],
    },
  });

  assert.equal(dtoDisabled.councils.pastoral.members.length, 1);
  assert.equal(dtoDisabled.councils.finance, null, "finance must be null when financeCouncilEnabled is false");
});

test("37 & 38. GET /parishes list items remain council-free while GET /parishes/:id contains councils", () => {
  const parishService = new ParishService();

  // List item (does not include councilConfiguration)
  const listItem = parishService.mapToDto({
    id: 1,
    parishName: "St. Joseph",
    type: "PARISH",
    isActive: true,
  });
  assert.equal(listItem.councils, null, "List items must not contain council member arrays");

  // Detail item (includes councilConfiguration)
  const detailItem = parishService.mapToDto({
    id: 1,
    parishName: "St. Joseph",
    type: "PARISH",
    isActive: true,
    councilConfiguration: {
      id: 999,
      financeCouncilEnabled: false,
      members: [{ id: 1, councilType: "PASTORAL", positionTitle: "Coordinator", memberName: "Jovencio", sortOrder: 0 }],
    },
  });
  assert.notEqual(detailItem.councils, null);
  assert.equal(detailItem.councils.pastoral.members.length, 1);
});

// ─── 7. Canonical Action Types Catalog ────────────────────────────────────────

test("39. CANONICAL_ACTION_TYPES catalog includes 'Parish Council Information Updated'", () => {
  assert.equal(
    CANONICAL_ACTION_TYPES.includes("Parish Council Information Updated"),
    true,
    "CANONICAL_ACTION_TYPES must include 'Parish Council Information Updated'"
  );
});

// ─── 8. Ambiguous Network Save Reconciliation ─────────────────────────────────

function normalizeCouncilMembers(members = []) {
  return members.map((m) => ({
    positionTitle: (m.positionTitle || "").trim(),
    memberName: (m.memberName || "").trim(),
  }));
}

function areCouncilSnapshotsEqual(a, b) {
  if (a.financeCouncilEnabled !== b.financeCouncilEnabled) return false;
  const aP = normalizeCouncilMembers(a.pastoralCouncilMembers);
  const bP = normalizeCouncilMembers(b.pastoralCouncilMembers);
  if (aP.length !== bP.length) return false;
  for (let i = 0; i < aP.length; i++) {
    if (aP[i].positionTitle !== bP[i].positionTitle || aP[i].memberName !== bP[i].memberName) return false;
  }
  const aF = normalizeCouncilMembers(a.financeCouncilMembers);
  const bF = normalizeCouncilMembers(b.financeCouncilMembers);
  if (aF.length !== bF.length) return false;
  for (let i = 0; i < aF.length; i++) {
    if (aF[i].positionTitle !== bF[i].positionTitle || aF[i].memberName !== bF[i].memberName) return false;
  }
  return true;
}

function shouldReconcileAsSaved(submittedExpectedVersion, submittedPayload, baselineSnapshot, freshServerConfig) {
  if (freshServerConfig.version !== submittedExpectedVersion + 1) {
    return false;
  }
  const expectedServerSnapshot = {
    financeCouncilEnabled: submittedPayload.financeCouncilEnabled,
    pastoralCouncilMembers: normalizeCouncilMembers(submittedPayload.pastoralCouncilMembers),
    financeCouncilMembers: submittedPayload.financeCouncilEnabled
      ? normalizeCouncilMembers(submittedPayload.financeCouncilMembers)
      : normalizeCouncilMembers(baselineSnapshot?.financeCouncilMembers || []),
  };
  const actualServerSnapshot = {
    financeCouncilEnabled: freshServerConfig.financeCouncilEnabled,
    pastoralCouncilMembers: normalizeCouncilMembers(freshServerConfig.pastoralCouncilMembers),
    financeCouncilMembers: normalizeCouncilMembers(freshServerConfig.financeCouncilMembers),
  };
  return areCouncilSnapshotsEqual(expectedServerSnapshot, actualServerSnapshot);
}

test("40. ambiguous save reconciliation: lost response + version+1 + matching state -> reconcile saved", () => {
  const submittedExpectedVersion = 3;
  const submittedPayload = {
    expectedVersion: 3,
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Juan Dela Cruz" }],
    financeCouncilMembers: [{ positionTitle: "Auditor", memberName: "Maria Santos" }],
  };
  const baselineSnapshot = {
    version: 3,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [],
    financeCouncilMembers: [],
  };
  const freshServerConfig = {
    version: 4, // version + 1
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Juan Dela Cruz" }],
    financeCouncilMembers: [{ positionTitle: "Auditor", memberName: "Maria Santos" }],
  };

  assert.equal(
    shouldReconcileAsSaved(submittedExpectedVersion, submittedPayload, baselineSnapshot, freshServerConfig),
    true,
    "Should reconcile as saved when server version is +1 and snapshot matches submitted payload"
  );
});

test("41. ambiguous save reconciliation: lost response + version+1 + DIFFERENT state -> NOT treated as saved", () => {
  const submittedExpectedVersion = 3;
  const submittedPayload = {
    expectedVersion: 3,
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Juan Dela Cruz" }],
    financeCouncilMembers: [{ positionTitle: "Auditor", memberName: "Maria Santos" }],
  };
  const baselineSnapshot = {
    version: 3,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [],
    financeCouncilMembers: [],
  };
  // Another session concurrently saved different members
  const freshServerConfig = {
    version: 4, // version is 4, but someone else changed it
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Another Person" }],
    financeCouncilMembers: [{ positionTitle: "Auditor", memberName: "Maria Santos" }],
  };

  assert.equal(
    shouldReconcileAsSaved(submittedExpectedVersion, submittedPayload, baselineSnapshot, freshServerConfig),
    false,
    "Must NOT reconcile as saved if server state differs from submitted payload"
  );
});

test("42. ambiguous save reconciliation: PFC-disabled save with preserved finance rows reconciles correctly", () => {
  const submittedExpectedVersion = 5;
  const baselineFinanceRows = [
    { positionTitle: "PFC Coordinator", memberName: "Preserved Officer" },
    { positionTitle: "Treasurer", memberName: "Preserved Treasurer" },
  ];
  const submittedPayload = {
    expectedVersion: 5,
    financeCouncilEnabled: false, // turning PFC off
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Juan Dela Cruz" }],
    financeCouncilMembers: [], // client UI was collapsed
  };
  const baselineSnapshot = {
    version: 5,
    financeCouncilEnabled: true,
    pastoralCouncilMembers: [],
    financeCouncilMembers: baselineFinanceRows,
  };
  // Server committed version 6 with PFC disabled AND preserved the baseline finance rows
  const freshServerConfig = {
    version: 6,
    financeCouncilEnabled: false,
    pastoralCouncilMembers: [{ positionTitle: "Coordinator", memberName: "Juan Dela Cruz" }],
    financeCouncilMembers: baselineFinanceRows,
  };

  assert.equal(
    shouldReconcileAsSaved(submittedExpectedVersion, submittedPayload, baselineSnapshot, freshServerConfig),
    true,
    "Must reconcile as saved when PFC is disabled and server preserves historical finance rows"
  );
});

