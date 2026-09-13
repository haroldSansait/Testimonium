import test from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { CaloyRuntimeConfigService } from "../services/CaloyRuntimeConfigService.js";
import { CaloyTelemetryRetentionWorker } from "../services/CaloyTelemetryRetentionWorker.js";
import { CaloyTelemetryPurgeService } from "../services/CaloyTelemetryPurgeService.js";
import { SystemLeaseService } from "../services/SystemLeaseService.js";
import { CaloyAdminController } from "../controllers/CaloyAdminController.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { CaloyAdminService } from "../services/CaloyAdminService.js";
import { caloyAdminContractFixtures } from "../../test-support/caloyAdminContractFixtures.mjs";
import { getApprovedGenerationModels } from "../config/caloyModelCatalog.js";
import { caloyPurgeExecuteSchema, caloyPurgePreviewQuerySchema } from "../validators/caloyAdminSchemas.js";
import { defaultAiUsageTelemetry } from "../services/AiUsageTelemetryService.js";
import { ChatbotLogRepository } from "../repositories/ChatbotLogRepository.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";

const validRuntimeRow = (overrides = {}) => ({
  id: 1,
  enabled: false,
  generationProvider: "gemini",
  generationModel: "gemini-3.5-flash-lite",
  aiTenMinuteMax: 20,
  aiDailyMax: 50,
  chatbotRequestDeadlineMs: 25000,
  automaticRetentionEnabled: false,
  logRetentionDays: 90,
  version: 3,
  updatedById: 7,
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
  ...overrides,
});

test("focused AI test isolation fails loudly before operational Prisma access", async () => {
  await assert.rejects(
    () => defaultAiUsageTelemetry.recordAttemptSafe({
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      operation: "GENERATE_CONTENT",
      purpose: "RAG_GENERATION",
      success: true,
      latencyMs: 1,
    }),
    (err) => err.code === "TEST_ISOLATION_VIOLATION"
  );
  await assert.rejects(
    () => new ChatbotLogRepository().logQuery({ responseType: "SOCIAL" }),
    (err) => err.code === "TEST_ISOLATION_VIOLATION"
  );
});

test("post-audit runtime config keeps immutable last-known-good and fails closed", async (t) => {
  const original = { ...env.chatbot };
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  Object.assign(env.chatbot, {
    enabled: true,
    geminiApiKey: "unit-test-key",
    generationModel: "gemini-3.5-flash-lite",
    allowedGenerationModels: [],
  });

  try {
    await t.test("stale disabled row and runtime model survive a read failure after custom TTL", async () => {
      let fail = false;
      const prisma = {
        caloyRuntimeConfig: {
          findUnique: async () => {
            if (fail) throw new Error("database unavailable");
            return validRuntimeRow({ generationModel: "gemini-3.8-flash" });
          },
        },
      };
      const service = new CaloyRuntimeConfigService({ prismaClient: prisma, cacheTtlMs: 25 });
      const first = await service.getRuntimeConfig();
      assert.equal(first.effectiveEnabled, false);
      assert.equal(first.effectiveGenerationModel, "gemini-3.8-flash");

      fail = true;
      now += 24;
      assert.equal((await service.getRuntimeConfig()).runtimeConfigSource, "DATABASE");
      now += 2;
      const stale = await service.getRuntimeConfig();
      assert.equal(stale.effectiveEnabled, false);
      assert.equal(stale.effectiveGenerationModel, "gemini-3.8-flash");
      assert.equal(stale.runtimeConfigSource, "STALE_LAST_KNOWN_GOOD");
      assert.equal(stale.runtimeConfigDatabaseAvailable, false);
      assert.equal(stale.configurationDegraded, true);
    });

    await t.test("cold database failure cannot enable chatbot or retention", async () => {
      const service = new CaloyRuntimeConfigService({
        prismaClient: { caloyRuntimeConfig: { findUnique: async () => { throw new Error("offline"); } } },
        cacheTtlMs: 25,
      });
      const snapshot = await service.getRuntimeConfig();
      assert.equal(snapshot.effectiveEnabled, false);
      assert.equal(snapshot.runtimeStateKnown, false);
      assert.equal(snapshot.runtimeConfigDatabaseAvailable, false);
      assert.equal(snapshot.automaticRetentionEnabled, false);
    });

    await t.test("successful null row remains a distinct, verified env fallback", async () => {
      const service = new CaloyRuntimeConfigService({
        prismaClient: { caloyRuntimeConfig: { findUnique: async () => null } },
      });
      const snapshot = await service.getRuntimeConfig();
      assert.equal(snapshot.runtimeOverridePresent, false);
      assert.equal(snapshot.runtimeStateKnown, true);
      assert.equal(snapshot.runtimeConfigDatabaseAvailable, true);
      assert.equal(snapshot.runtimeConfigSource, "DEPLOYMENT_ENV");
      assert.equal(snapshot.effectiveEnabled, true);
    });
  } finally {
    Date.now = originalNow;
    Object.assign(env.chatbot, original);
  }
});

test("model readiness distinguishes known compatibility, deployment configuration, runtime override, and credentials", async () => {
  const original = { ...env.chatbot };
  try {
    env.chatbot.allowedGenerationModels = ["gemini-3.5-flash-lite", "unknown-deployment-model"];
    assert.deepEqual(getApprovedGenerationModels().map((entry) => entry.id), ["gemini-3.5-flash-lite"]);

    const cases = [
      { name: "deployment disabled", envEnabled: false, envModel: "gemini-3.5-flash-lite", credentials: "key", row: validRuntimeRow({ enabled: true }), status: "DISABLED_BY_DEPLOYMENT", enabled: false },
      { name: "coordinator disabled", envEnabled: true, envModel: "gemini-3.5-flash-lite", credentials: "key", row: validRuntimeRow({ enabled: false }), status: "DISABLED_BY_COORDINATOR", enabled: false },
      { name: "valid runtime and fallback", envEnabled: true, envModel: "gemini-3.5-flash-lite", credentials: "key", row: validRuntimeRow({ enabled: true }), status: "ACTIVE", enabled: true, model: "gemini-3.5-flash-lite" },
      { name: "invalid runtime with valid fallback", envEnabled: true, envModel: "gemini-3.5-flash-lite", credentials: "key", row: validRuntimeRow({ enabled: true, generationModel: "invalid-runtime" }), status: "CONFIGURATION_WARNING", enabled: true, model: "gemini-3.5-flash-lite" },
      { name: "invalid fallback with valid runtime", envEnabled: true, envModel: "invalid-deployment", credentials: "key", row: validRuntimeRow({ enabled: true }), status: "ACTIVE", enabled: true, model: "gemini-3.5-flash-lite" },
      { name: "both models invalid", envEnabled: true, envModel: "invalid-deployment", credentials: "key", row: validRuntimeRow({ enabled: true, generationModel: "invalid-runtime" }), status: "CONFIGURATION_ERROR", enabled: false, model: null },
      { name: "missing credentials", envEnabled: true, envModel: "gemini-3.5-flash-lite", credentials: "", row: validRuntimeRow({ enabled: true }), status: "CONFIGURATION_ERROR", enabled: false, model: "gemini-3.5-flash-lite" },
    ];

    for (const scenario of cases) {
      Object.assign(env.chatbot, {
        enabled: scenario.envEnabled,
        generationModel: scenario.envModel,
        geminiApiKey: scenario.credentials,
        allowedGenerationModels: [],
      });
      const service = new CaloyRuntimeConfigService({
        prismaClient: { caloyRuntimeConfig: { findUnique: async () => scenario.row } },
      });
      const snapshot = await service.getEffectiveConfigSnapshot();
      assert.equal(snapshot.configurationStatus, scenario.status, scenario.name);
      assert.equal(snapshot.effectiveEnabled, scenario.enabled, scenario.name);
      if (Object.hasOwn(scenario, "model")) assert.equal(snapshot.effectiveGenerationModel, scenario.model, scenario.name);
    }
  } finally {
    Object.assign(env.chatbot, original);
  }
});

test("retention is Manila-window gated, once per day, and skips unverifiable config", async () => {
  const held = new Set();
  const lease = {
    acquireLease: async (key) => held.has(key) ? false : (held.add(key), true),
    releaseLease: async (key) => held.delete(key),
  };
  let purgeCount = 0;
  const purge = { purgeTelemetry: async () => { purgeCount += 1; return { chatbotLogsDeleted: 0, aiUsageEventsDeleted: 0 }; } };
  const config = {
    getEffectiveConfigSnapshot: async () => ({
      runtimeConfigDatabaseAvailable: true,
      runtimeStateKnown: true,
      automaticRetentionEnabled: true,
      logRetentionDays: 90,
    }),
  };

  const at = (iso) => new CaloyTelemetryRetentionWorker({ configService: config, purgeService: purge, leaseService: lease, now: () => new Date(iso) });
  await at("2026-09-13T18:59:00.000Z").runCycle();
  await at("2026-09-13T19:00:00.000Z").runCycle();
  await at("2026-09-13T19:30:00.000Z").runCycle();
  await at("2026-09-13T19:59:00.000Z").runCycle();
  await at("2026-09-13T20:00:00.000Z").runCycle();
  await at("2026-09-14T06:00:00.000Z").runCycle();
  await at("2026-09-14T19:00:00.000Z").runCycle();
  assert.equal(purgeCount, 2);

  const startupAtFourteenHundred = at("2026-09-15T06:00:00.000Z");
  startupAtFourteenHundred.start();
  await startupAtFourteenHundred.activeRun;
  await startupAtFourteenHundred.stop();
  assert.equal(purgeCount, 2, "server startup at 14:00 Manila must not purge");

  const unavailable = new CaloyTelemetryRetentionWorker({
    configService: { getEffectiveConfigSnapshot: async () => ({ runtimeConfigDatabaseAvailable: false, runtimeStateKnown: false, automaticRetentionEnabled: true }) },
    purgeService: purge,
    leaseService: lease,
    now: () => new Date("2026-09-15T19:00:00.000Z"),
  });
  await unavailable.runCycle();
  assert.equal(purgeCount, 2);
});

const makePurgePrisma = ({ chatbotIds = [], usageIds = [] } = {}) => ({
  chatbotLog: {
    count: async () => chatbotIds.length,
    findMany: async () => chatbotIds.map((id) => ({ id })),
    deleteMany: async ({ where }) => ({ count: where.id.in.length }),
  },
  aiUsageEvent: {
    count: async () => usageIds.length,
    findMany: async () => usageIds.map((id) => ({ id })),
    deleteMany: async ({ where }) => ({ count: where.id.in.length }),
  },
});

test("purge contract is bounded, serialized, renewable, and durably audited", async (t) => {
  await t.test("preview echoes only server-owned days/cutoff/count fields", async () => {
    const service = new CaloyTelemetryPurgeService({
      prismaClient: makePurgePrisma({ chatbotIds: [1, 2], usageIds: [3] }),
      leaseService: {},
      auditLogService: {},
      now: () => Date.parse("2026-09-13T00:00:00.000Z"),
    });
    for (const daysOlderThan of [14, 30, 60, 90, 180, 365]) {
      const preview = await service.previewPurge({ daysOlderThan });
      assert.deepEqual(Object.keys(preview).sort(), ["aiUsageEventsMatched", "chatbotLogsMatched", "cutoff", "daysOlderThan"]);
      assert.equal(preview.daysOlderThan, daysOlderThan);
      assert.equal(preview.chatbotLogsMatched, 2);
      assert.equal(preview.aiUsageEventsMatched, 1);
    }
    assert.throws(() => service._resolvePurgeWindow({ daysOlderThan: 13 }), /between 14 and 365/);
    assert.throws(() => service._resolvePurgeWindow({ daysOlderThan: 366 }), /between 14 and 365/);
    assert.equal(caloyPurgeExecuteSchema.safeParse({ daysOlderThan: 13 }).success, false);
    assert.equal(caloyPurgeExecuteSchema.safeParse({ daysOlderThan: 14 }).success, true);
    assert.equal(caloyPurgeExecuteSchema.safeParse({ daysOlderThan: 365 }).success, true);
    assert.equal(caloyPurgeExecuteSchema.safeParse({ daysOlderThan: 366 }).success, false);
    assert.equal(caloyPurgeExecuteSchema.safeParse({ daysOlderThan: 90, cutoff: "2099-01-01T00:00:00.000Z" }).success, false);
    assert.equal(caloyPurgePreviewQuerySchema.safeParse({ daysOlderThan: "180", cutoff: "2099-01-01T00:00:00.000Z" }).success, false);
  });

  await t.test("manual and automatic callers share one lease and conflicts delete nothing", async () => {
    let deletes = 0;
    const prisma = makePurgePrisma({ chatbotIds: [1] });
    prisma.chatbotLog.deleteMany = async () => { deletes += 1; return { count: 1 }; };
    const service = new CaloyTelemetryPurgeService({
      prismaClient: prisma,
      leaseService: { acquireLease: async () => false },
      auditLogService: { logOrThrow: async () => {} },
    });
    await assert.rejects(() => service.purgeTelemetry({ daysOlderThan: 90, isManual: true, actorId: 7 }), (err) => err.code === "CALOY_PURGE_IN_PROGRESS");
    assert.equal(deletes, 0);
  });

  await t.test("initial audit failure aborts before the first irreversible delete", async () => {
    let deletes = 0;
    let releases = 0;
    const prisma = makePurgePrisma({ chatbotIds: [1], usageIds: [2] });
    prisma.chatbotLog.deleteMany = async () => { deletes += 1; return { count: 1 }; };
    prisma.aiUsageEvent.deleteMany = async () => { deletes += 1; return { count: 1 }; };
    const service = new CaloyTelemetryPurgeService({
      prismaClient: prisma,
      leaseService: { acquireLease: async () => true, renewLease: async () => true, releaseLease: async () => { releases += 1; return true; } },
      auditLogService: { logOrThrow: async () => { throw new Error("audit unavailable"); } },
    });
    await assert.rejects(() => service.purgeTelemetry({ daysOlderThan: 90, isManual: true, actorId: 7 }), /audit unavailable/);
    assert.equal(deletes, 0);
    assert.equal(releases, 1);
  });

  await t.test("lost renewal stops future batches and reports committed counts", async () => {
    const auditActions = [];
    let renewals = 0;
    let usageDeletes = 0;
    const prisma = makePurgePrisma({ chatbotIds: [1], usageIds: [2] });
    prisma.aiUsageEvent.deleteMany = async () => { usageDeletes += 1; return { count: 1 }; };
    const service = new CaloyTelemetryPurgeService({
      prismaClient: prisma,
      leaseService: {
        acquireLease: async () => true,
        renewLease: async () => ++renewals === 1,
        releaseLease: async () => true,
      },
      auditLogService: { logOrThrow: async (_actor, action) => { auditActions.push(action); } },
      createOperationId: () => "operation-1",
    });
    await assert.rejects(
      () => service.purgeTelemetry({ daysOlderThan: 90, isManual: true, actorId: 7 }),
      (err) => {
        assert.equal(err.code, "CALOY_PURGE_LEASE_LOST");
        assert.equal(err.purgeResult.status, "PARTIAL");
        assert.equal(err.purgeResult.chatbotLogsDeleted, 1);
        assert.equal(err.purgeResult.aiUsageEventsDeleted, 0);
        return true;
      }
    );
    assert.equal(usageDeletes, 0);
    assert.deepEqual(auditActions, ["CALOY_LOG_PURGE_STARTED", "CALOY_LOG_PURGE_FAILED"]);
  });

  await t.test("final audit failure does not misreport successful deletion", async () => {
    let auditCalls = 0;
    const service = new CaloyTelemetryPurgeService({
      prismaClient: makePurgePrisma({ chatbotIds: [1], usageIds: [2] }),
      leaseService: { acquireLease: async () => true, renewLease: async () => true, releaseLease: async () => true },
      auditLogService: {
        logOrThrow: async () => {
          auditCalls += 1;
          if (auditCalls === 2) throw new Error("audit unavailable");
        },
      },
      createOperationId: () => "operation-2",
    });
    const result = await service.purgeTelemetry({ daysOlderThan: 90, isManual: true, actorId: 7 });
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.chatbotLogsDeleted, 1);
    assert.equal(result.aiUsageEventsDeleted, 1);
    assert.equal(result.auditFinalizationWarning, true);
  });
});

test("SystemLeaseService uses database clock and owner-token guarded SQL", async () => {
  const statements = [];
  const prisma = {
    $queryRaw: async (strings, ...values) => {
      statements.push({ sql: strings.join("?"), values });
      return [{ lease_key: "key" }];
    },
  };
  const service = new SystemLeaseService(prisma);
  assert.equal(await service.acquireLease("key", "owner", 300), true);
  assert.equal(await service.renewLease("key", "owner", 300), true);
  assert.equal(await service.releaseLease("key", "owner"), true);
  assert.match(statements[0].sql, /NOW\(\) \+ \(\? \* INTERVAL '1 second'\)/);
  assert.match(statements[1].sql, /owner_token/);
  assert.match(statements[1].sql, /lease_expires_at.*> NOW\(\)/s);
  assert.match(statements[2].sql, /owner_token/);
  assert.equal(statements.flatMap((entry) => entry.values).some((value) => value instanceof Date), false);
});

test("controller serializes every Caloy Admin endpoint with the shared frontend fixture contracts", async () => {
  const fixtures = caloyAdminContractFixtures;
  const controller = new CaloyAdminController({
    configService: {
      updateRuntimeConfig: async () => ({}),
      getEffectiveSettingsDto: async () => fixtures.settings,
    },
    adminService: {
      getOverview: async () => fixtures.overview,
      getAnalytics: async () => fixtures.analytics,
      getLogs: async () => fixtures.logs,
      getPurgePreview: async () => fixtures.purgePreview,
      executePurge: async () => fixtures.purgeExecute,
      getKnowledgeStats: async () => fixtures.knowledgeStats,
    },
  });
  const response = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const cases = [
    ["overview", controller.getOverview, { query: {} }, fixtures.overview],
    ["analytics", controller.getAnalytics, { query: { preset: "30d" } }, fixtures.analytics],
    ["settings-get", controller.getSettings, {}, fixtures.settings],
    ["settings-patch", controller.updateSettings, { body: { expectedVersion: 3 }, user: { id: 7 }, get: () => null }, fixtures.settings],
    ["logs", controller.getLogs, { query: {} }, fixtures.logs],
    ["purge-preview", controller.getPurgePreview, { query: { daysOlderThan: 180 } }, fixtures.purgePreview],
    ["purge", controller.executePurge, { body: { daysOlderThan: 180 }, user: { id: 7 } }, fixtures.purgeExecute],
    ["knowledge-stats", controller.getKnowledgeStats, {}, fixtures.knowledgeStats],
  ];
  for (const [name, handler, req, fixture] of cases) {
    const res = response();
    await handler(req, res, assert.fail);
    assert.equal(res.statusCode, 200, name);
    assert.equal(res.body.success, true, name);
    assert.deepEqual(res.body.data, fixture, name);
    assert.deepEqual(Object.keys(res.body.data).sort(), Object.keys(fixture).sort(), `${name} exact top-level keys`);
  }

  const partial = { ...fixtures.purgeExecute, status: "PARTIAL", chatbotLogsDeleted: 1, aiUsageEventsDeleted: 0 };
  const partialError = Object.assign(new Error("Purge stopped after lease ownership was lost"), {
    statusCode: 409,
    code: "CALOY_PURGE_LEASE_LOST",
    purgeResult: partial,
  });
  controller.adminService.executePurge = async () => { throw partialError; };
  const partialRes = response();
  await controller.executePurge({ body: { daysOlderThan: 180 }, user: { id: 7 } }, partialRes, assert.fail);
  assert.equal(partialRes.statusCode, 409);
  assert.equal(partialRes.body.success, false);
  assert.deepEqual(partialRes.body.data, partial);
});

test("CaloyAdminService maps actual Prisma-shaped rows into canonical overview, analytics, logs, and knowledge DTOs", async () => {
  const recentError = {
    id: 10,
    createdAt: new Date("2026-09-13T01:00:00.000Z"),
    responseType: "RAG",
    generationModel: "gemini-3.5-flash-lite",
    category: "DOCUMENTS",
    fallbackReason: "INSUFFICIENT_EVIDENCE",
    errorCategory: "EVIDENCE",
    latencyMs: 500,
  };
  const logRow = {
    id: 42,
    createdAt: new Date("2026-09-13T01:00:00.000Z"),
    responseType: "RAG",
    category: "DOCUMENTS",
    generationProvider: "gemini",
    generationModel: "gemini-3.5-flash-lite",
    selectedParishId: 5,
    latencyMs: 420,
    fallback: false,
    fallbackReason: null,
    errorCategory: null,
  };
  const prisma = {
    chatbotLog: {
      count: async ({ where = {} } = {}) => where.errorCategory ? 2 : where.fallback ? 2 : 20,
      aggregate: async () => ({ _avg: { latencyMs: 420 } }),
      findMany: async ({ select = {}, take } = {}) => {
        if (select.retrievalScores) return [{ retrievalScores: [0.82] }, { retrievalScores: [] }, { retrievalScores: null }, { retrievalScores: ["legacy"] }];
        if (select.latencyMs && !select.id) return [{ latencyMs: 100 }, { latencyMs: 900 }];
        if (select.createdAt && !select.id) return [{ createdAt: new Date("2026-09-13T01:00:00.000Z"), fallback: false }];
        if (take === 8) return [recentError];
        return [logRow];
      },
      groupBy: async ({ by }) => {
        if (by[0] === "responseType") return [{ responseType: "RAG", _count: { id: 12 } }];
        if (by[0] === "category") return [{ category: "DOCUMENTS", _count: { id: 8 } }];
        if (by[0] === "selectedParishId") return [{ selectedParishId: 5, _count: { id: 6 } }];
        return [{ fallbackReason: "INSUFFICIENT_EVIDENCE", _count: { id: 2 } }];
      },
    },
    aiUsageEvent: {
      count: async ({ where = {} } = {}) => where.statusCode === 429 ? 1 : where.success === false ? 3 : where.operation === "GENERATE_CONTENT" ? 11 : where.operation === "EMBED_CONTENT" ? 7 : 2,
      aggregate: async () => ({ _sum: { inputTokens: 100, outputTokens: 80, totalTokens: 180 } }),
      groupBy: async () => [{ errorCategory: "RATE_LIMIT", _count: { id: 3 } }],
      findMany: async ({ select }) => select.model
        ? [{ model: "gemini-3.5-flash-lite", success: true, latencyMs: 310 }]
        : [{ createdAt: new Date("2026-09-13T01:00:00.000Z"), operation: "GENERATE_CONTENT", success: true }],
    },
    knowledgeSource: {
      count: async ({ where } = {}) => !where ? 4 : where.status === "ACTIVE" ? 2 : 1,
    },
    knowledgeChunk: {
      groupBy: async (args) => {
        assert.deepEqual(args?.by, ["embeddingStatus"]);
        assert.ok(
          args?._count?._all === true || args?._count?.id === true,
          "KnowledgeChunk groupBy must count via schema-valid _all or id, never chunkId"
        );
        assert.equal(
          args?._count?.chunkId,
          undefined,
          "KnowledgeChunk has no chunkId field in schema"
        );
        return [
          { embeddingStatus: "READY", _count: { _all: 15 } },
          { embeddingStatus: "PENDING", _count: { _all: 2 } },
          { embeddingStatus: "FAILED", _count: { _all: 1 } },
        ];
      },
    },
    parish: { findMany: async () => [{ id: 5, parishName: "St. Joseph Parish" }] },
  };
  const configService = { getEffectiveConfigSnapshot: async () => ({
    configurationStatus: "ACTIVE",
    deploymentEnabled: true,
    runtimeEnabled: true,
    effectiveEnabled: true,
    runtimeConfigDatabaseAvailable: true,
    configurationDegraded: false,
    effectiveGenerationModel: "gemini-3.5-flash-lite",
    configuredGenerationModel: "gemini-3.5-flash-lite",
    runtimeModelValid: true,
    credentialsConfigured: true,
  }) };
  const service = new CaloyAdminService({ prismaClient: prisma, configService });

  const overview = await service.getOverview();
  assert.equal(overview.metrics.failedInteractionsToday, 2);
  assert.equal(overview.metrics.failedProviderAttemptsToday, 3);
  assert.equal(overview.status, "ACTIVE");
  assert.deepEqual(overview.knowledgeHealth, {
    totalSources: 4,
    activeSources: 2,
    draftSources: 1,
    retiredSources: 1,
    totalChunks: 18,
    readyChunks: 15,
    pendingChunks: 2,
    failedChunks: 1,
  });

  const analytics = await service.getAnalytics({ preset: "custom", from: "2026-08-15", to: "2026-09-13", parishId: 5 });
  assert.equal(analytics.summary.generationRequests, 11);
  assert.equal(analytics.summary.embeddingRequests, 7);
  assert.equal(analytics.summary.failedInteractions, 2);
  assert.equal(analytics.summary.failedProviderAttempts, 3);
  assert.equal(analytics.providerMetricsScope, "GLOBAL_DATE_AND_MODEL_FILTERED");
  assert.equal(analytics.parishContext[0].parishName, "St. Joseph Parish");

  const logs = await service.getLogs({ preset: "custom", from: "2026-08-15", to: "2026-09-13" });
  assert.equal(logs.items[0].parishName, "St. Joseph Parish");
  assert.equal("question" in logs.items[0], false);

  const knowledge = await service.getKnowledgeStats();
  assert.equal(knowledge.averageRetrievalScore, 0.82);
  assert.equal(knowledge.retrievalScoreSampleCount, 1);
  assert.equal(knowledge.embeddingConfig.readOnly, true);
  assert.deepEqual(knowledge.chunkCounts, {
    total: 18,
    ready: 15,
    pending: 2,
    failed: 1,
    stale: 0,
  });
});

test("CaloyAdminService overview & knowledge diagnostics reject invalid chunkId aggregate shape", async () => {
  let capturedOverviewArgs = null;
  let capturedStatsArgs = null;

  const mockPrisma = {
    chatbotLog: {
      count: async () => 0,
      aggregate: async () => ({ _avg: { latencyMs: null } }),
      findMany: async () => [],
    },
    aiUsageEvent: {
      count: async () => 0,
    },
    knowledgeSource: {
      count: async () => 0,
    },
    knowledgeChunk: {
      groupBy: async (args) => {
        if (!capturedOverviewArgs) {
          capturedOverviewArgs = args;
        } else {
          capturedStatsArgs = args;
        }
        assert.equal(args._count?.chunkId, undefined, "Prisma KnowledgeChunk model has no chunkId field");
        assert.ok(args._count?._all === true || args._count?.id === true, "Aggregate must select _all or id");
        return [
          { embeddingStatus: "READY", _count: { _all: 5 } },
        ];
      },
    },
  };

  const service = new CaloyAdminService({
    prismaClient: mockPrisma,
    configService: {
      getEffectiveConfigSnapshot: async () => ({
        configurationStatus: "ACTIVE",
        deploymentEnabled: true,
        runtimeEnabled: true,
        effectiveEnabled: true,
        runtimeConfigDatabaseAvailable: true,
        configurationDegraded: false,
        effectiveGenerationModel: "gemini-3.5-flash-lite",
        configuredGenerationModel: "gemini-3.5-flash-lite",
        runtimeModelValid: true,
        credentialsConfigured: true,
      }),
    },
  });

  const overview = await service.getOverview();
  assert.equal(overview.knowledgeHealth.readyChunks, 5);
  assert.equal(overview.knowledgeHealth.totalChunks, 5);
  assert.deepEqual(capturedOverviewArgs, {
    by: ["embeddingStatus"],
    _count: { _all: true },
  });

  const stats = await service.getKnowledgeStats();
  assert.equal(stats.chunkCounts.ready, 5);
  assert.equal(stats.chunkCounts.total, 5);
  assert.deepEqual(capturedStatsArgs, {
    by: ["embeddingStatus"],
    _count: { _all: true },
  });
});

const inertTimer = () => ({ unref() {} });

test("ChatbotService uses the configured root deadline and one signal across RAG providers", async () => {
  for (const deadline of [5000, 25000, 28000]) {
    const seenSignals = [];
    const timerDelays = [];
    const service = new ChatbotService({
      isEnabled: true,
      runtimeConfigService: {
        getEffectiveConfigSnapshot: async () => ({
          effectiveEnabled: true,
          effectiveGenerationModel: "gemini-3.5-flash-lite",
          chatbotRequestDeadlineMs: deadline,
        }),
      },
      semanticRouter: { interpret: async ({ signal }) => { seenSignals.push(signal); return { route: "RAG" }; } },
      retrievalService: {
        retrieveKnowledge: async ({ signal }) => {
          seenSignals.push(signal);
          return { candidates: [{ id: 1, sourceId: 1, title: "Doc", content: "Evidence", semanticScore: 0.9 }], hasSufficientEvidence: true, category: "GENERAL" };
        },
      },
      logRepository: { logQuery: async () => {} },
      aiQuotaTracker: { consume: () => ({ allowed: true }) },
      setTimeoutFn: (_callback, delay) => { timerDelays.push(delay); return inertTimer(); },
    });
    service.getChatProvider = (model) => ({
      providerName: "gemini",
      modelName: model,
      generateGroundedAnswer: async ({ signal }) => {
        seenSignals.push(signal);
        return { answer: "Grounded [CHUNK:1]", citedChunkIds: [1] };
      },
    });
    const result = await service.handleQuery({ question: "How do I request a certificate?" });
    assert.equal(result.fallback, false);
    assert.equal(timerDelays[0], deadline);
    assert.equal(seenSignals.length, 3);
    assert.ok(seenSignals.every((signal) => signal === seenSignals[0]));
  }
});

test("deadline exhaustion returns and logs canonical fallback without a TDZ error", async () => {
  const logs = [];
  const service = new ChatbotService({
    isEnabled: true,
    runtimeConfigService: { getEffectiveConfigSnapshot: async () => ({ effectiveEnabled: true, effectiveGenerationModel: "gemini-3.5-flash-lite", chatbotRequestDeadlineMs: 5000 }) },
    semanticRouter: { interpret: async () => ({ route: "RAG" }) },
    retrievalService: { retrieveKnowledge: async () => assert.fail("retrieval must not start after deadline") },
    logRepository: { logQuery: async (entry) => logs.push(entry) },
    aiQuotaTracker: { consume: () => ({ allowed: true }) },
    setTimeoutFn: (callback) => { callback(); return inertTimer(); },
  });
  const result = await service.handleQuery({ question: "How do I request a certificate?" });
  assert.equal(result.fallbackReason, "DEADLINE_EXHAUSTED");
  assert.equal(logs.at(-1).errorCategory, "DEADLINE_EXHAUSTED");
});

test("runtime model and trace flow independently to social and live composers", async () => {
  let model = "gemini-3.5-flash-lite";
  const composerCalls = [];
  const liveCalls = [];
  const service = new ChatbotService({
    isEnabled: true,
    runtimeConfigService: { getEffectiveConfigSnapshot: async () => ({ effectiveEnabled: true, effectiveGenerationModel: model, chatbotRequestDeadlineMs: 25000 }) },
    semanticRouter: { interpret: async ({ sanitizedQuestion }) => sanitizedQuestion.includes("live") ? { route: "LIVE_TOOL", intent: "GET_ACTIVE_PARISHES" } : { route: "SOCIAL", intent: "WHO_ARE_YOU" } },
    responseComposerFactory: (selectedModel) => ({
      compose: async ({ traceId, signal }) => {
        composerCalls.push({ model: selectedModel, traceId, signal });
        return { answer: "I am Caloy." };
      },
    }),
    liveToolRouter: {
      validateAndExecute: async (context) => {
        liveCalls.push(context);
        return { answer: "Live result", responseType: "LIVE_DATA", fallback: false, executedParams: {} };
      },
    },
    logRepository: { logQuery: async () => {} },
    aiQuotaTracker: { consume: () => ({ allowed: true }) },
    setTimeoutFn: inertTimer,
  });

  await service.handleQuery({ question: "Who are you?" });
  model = "gemini-3.8-flash";
  await service.handleQuery({ question: "Show live parishes" });
  assert.equal(composerCalls[0].model, "gemini-3.5-flash-lite");
  assert.ok(composerCalls[0].traceId);
  assert.ok(composerCalls[0].signal instanceof AbortSignal);
  assert.equal(liveCalls[0].generationModel, "gemini-3.8-flash");
  assert.ok(liveCalls[0].traceId);
  assert.ok(liveCalls[0].signal instanceof AbortSignal);
});

test("LiveToolRouter resolves the request model and forwards the same trace and root signal to its composer", async () => {
  const calls = [];
  const controller = new AbortController();
  const router = new LiveToolRouter({
    registry: {
      prisma: {},
      getActiveParishes: async () => ({
        fallback: false,
        fallbackAnswer: "St. Joseph Parish is active.",
        structuredFacts: { parishes: ["St. Joseph Parish"] },
        liveData: { parishes: [{ id: 5, parishName: "St. Joseph Parish" }] },
      }),
    },
    responseComposerFactory: (model) => ({
      compose: async (context) => {
        calls.push({ model, ...context });
        return { answer: "St. Joseph Parish is active." };
      },
    }),
  });
  const result = await router.validateAndExecute({
    semanticProposal: { intent: "GET_ACTIVE_PARISHES", entities: {} },
    normalizedQuestion: "Which parishes are active?",
    activeParishes: [],
    generationModel: "gemini-3.8-flash",
    traceId: "trace-live-composer",
    signal: controller.signal,
    deadline: Date.now() + 10000,
  });
  assert.equal(result.responseType, "LIVE_DATA");
  assert.equal(calls[0].model, "gemini-3.8-flash");
  assert.equal(calls[0].traceId, "trace-live-composer");
  assert.strictEqual(calls[0].signal, controller.signal);
});

test("settings validation merges quota fields and audit failure aborts the transaction", async (t) => {
  const original = { ...env.chatbot };
  Object.assign(env.chatbot, { enabled: true, geminiApiKey: "unit-test-key", generationModel: "gemini-3.5-flash-lite", allowedGenerationModels: [] });
  try {
    for (const scenario of [
      { row: validRuntimeRow({ aiTenMinuteMax: 20, aiDailyMax: 50 }), patch: { aiTenMinuteMax: 60 } },
      { row: validRuntimeRow({ aiTenMinuteMax: 80, aiDailyMax: 100 }), patch: { aiDailyMax: 70 } },
    ]) {
      let transactionCalled = false;
      const prisma = {
        caloyRuntimeConfig: { findUnique: async () => scenario.row },
        $transaction: async () => { transactionCalled = true; },
      };
      const service = new CaloyRuntimeConfigService({ prismaClient: prisma });
      await assert.rejects(
        () => service.updateRuntimeConfig({ expectedVersion: scenario.row.version, ...scenario.patch }, 7),
        (err) => err.code === "VALIDATION_ERROR" && err.statusCode === 400
      );
      assert.equal(transactionCalled, false);
    }

    await t.test("activity audit is executed inside the same Prisma transaction and is not swallowed", async () => {
      const row = validRuntimeRow({ enabled: true });
      let mutationInsideTransaction = false;
      const tx = {
        caloyRuntimeConfig: { updateMany: async () => { mutationInsideTransaction = true; return { count: 1 }; } },
        user: { findUnique: async () => ({ id: 7, parishId: null, role: { roleName: "DIOCESE_COORDINATOR" } }) },
        activityLog: { create: async () => { throw new Error("audit unavailable"); } },
      };
      const prisma = {
        caloyRuntimeConfig: { findUnique: async () => row },
        $transaction: async (callback) => callback(tx),
      };
      const service = new CaloyRuntimeConfigService({ prismaClient: prisma });
      await assert.rejects(() => service.updateRuntimeConfig({ expectedVersion: row.version, enabled: false }, 7), /audit unavailable/);
      assert.equal(mutationInsideTransaction, true);
    });
  } finally {
    Object.assign(env.chatbot, original);
  }
});
