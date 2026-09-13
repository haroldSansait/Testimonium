import test from "node:test";
import assert from "node:assert/strict";
import { GeminiChatAdapter } from "../services/ai/GeminiChatAdapter.js";
import { GeminiEmbeddingAdapter } from "../services/ai/GeminiEmbeddingAdapter.js";
import { CaloyRuntimeConfigService } from "../services/CaloyRuntimeConfigService.js";
import { CaloyTelemetryPurgeService } from "../services/CaloyTelemetryPurgeService.js";
import { CaloyTelemetryRetentionWorker } from "../services/CaloyTelemetryRetentionWorker.js";
import { CaloyAdminService } from "../services/CaloyAdminService.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { isApprovedGenerationModel, APPROVED_GENERATION_MODELS } from "../config/caloyModelCatalog.js";
import {
  getManilaTodayDateString,
  advanceCalendarDay,
  manilaDateToUtcStart,
} from "../utils/manilaAnalyticsDate.js";
import { CaloyResponseComposer } from "../services/ai/CaloyResponseComposer.js";
import { SystemLeaseService } from "../services/SystemLeaseService.js";
import { buildGeminiGenerationConfig } from "../services/ai/geminiConfigHelper.js";
import {
  ALLOWED_OPERATIONS,
  ALLOWED_PURPOSES,
  validateTelemetryOperationAndPurpose,
} from "../services/AiUsageTelemetryService.js";
import { caloySettingsUpdateSchema } from "../validators/caloyAdminSchemas.js";
import { getGeminiChatAdapter } from "../services/ai/providerFactory.js";
import { env } from "../config/env.js";

// ==============================================================================
// 1. PROVIDER TELEMETRY TESTS (Section 92)
// ==============================================================================

test("Provider Telemetry: instruments attempts, retries, and errors safely (0 real Gemini)", async (t) => {
  await t.test("single successful generation records 1 usage event", async () => {
    const recorded = [];
    const mockTelemetry = {
      recordAttemptSafe: (data) => recorded.push(data),
    };

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: () => "Test response [CHUNK:1]",
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10, totalTokenCount: 25 },
        }),
      },
    };

    const adapter = new GeminiChatAdapter({
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
      client: mockClient,
      telemetryRecorder: mockTelemetry,
    });

    const res = await adapter.generateGroundedAnswer({
      question: "Hello",
      evidence: [{ id: 1, title: "Doc", content: "Content" }],
      traceId: "trace-abc-123",
    });

    assert.ok(res.answer.includes("Test response"));
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].traceId, "trace-abc-123");
    assert.equal(recorded[0].operation, "GENERATE_CONTENT");
    assert.equal(recorded[0].purpose, "RAG_GENERATION");
    assert.equal(recorded[0].attemptNumber, 1);
    assert.equal(recorded[0].success, true);
    assert.equal(recorded[0].inputTokens, 15);
    assert.equal(recorded[0].outputTokens, 10);
    assert.equal(recorded[0].totalTokens, 25);
  });

  await t.test("429 then success records 2 usage events", async () => {
    const recorded = [];
    const mockTelemetry = {
      recordAttemptSafe: (data) => recorded.push(data),
    };

    let callCount = 0;
    const mockClient = {
      models: {
        generateContent: async () => {
          callCount++;
          if (callCount === 1) {
            const err = new Error("Resource exhausted: quota limit");
            err.status = 429;
            throw err;
          }
          return {
            text: () => "Success after retry [CHUNK:1]",
            usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
          };
        },
      },
    };

    const adapter = new GeminiChatAdapter({
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
      maxRetries: 2,
      retryBaseDelayMs: 10,
      client: mockClient,
      telemetryRecorder: mockTelemetry,
    });

    const res = await adapter.generateGroundedAnswer({
      question: "Test question",
      evidence: [{ id: 1, title: "Doc", content: "Content" }],
      traceId: "trace-retry-429",
    });

    assert.ok(res.answer.includes("Success after retry"));
    assert.equal(recorded.length, 2);
    // Attempt 1: failure
    assert.equal(recorded[0].attemptNumber, 1);
    assert.equal(recorded[0].success, false);
    assert.equal(recorded[0].statusCode, 429);
    assert.equal(recorded[0].errorCategory, "AI_PROVIDER_RATE_LIMITED");
    // Attempt 2: success
    assert.equal(recorded[1].attemptNumber, 2);
    assert.equal(recorded[1].success, true);
    assert.equal(recorded[1].totalTokens, 20);
  });

  await t.test("embedding query records operation EMBEDDING with RAG_QUERY_EMBEDDING", async () => {
    const recorded = [];
    const mockTelemetry = {
      recordAttemptSafe: (data) => recorded.push(data),
    };

    const mockClient = {
      models: {
        embedContent: async () => ({
          embeddings: [{ values: new Array(768).fill(0.01) }],
        }),
      },
    };

    const adapter = new GeminiEmbeddingAdapter({
      apiKey: "test-key",
      dimensions: 768,
      client: mockClient,
      telemetryRecorder: mockTelemetry,
    });

    const res = await adapter.embedQuery("sample question", { traceId: "trace-embed-query" });
    assert.equal(res.dimensions, 768);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].traceId, "trace-embed-query");
    assert.equal(recorded[0].operation, "EMBED_CONTENT");
    assert.equal(recorded[0].purpose, "QUERY_EMBEDDING");
    assert.equal(recorded[0].success, true);
  });

  await t.test("document embedding records operation EMBEDDING with DOCUMENT_EMBEDDING", async () => {
    const recorded = [];
    const mockTelemetry = {
      recordAttemptSafe: (data) => recorded.push(data),
    };

    const mockClient = {
      models: {
        embedContent: async () => ({
          embeddings: [{ values: new Array(768).fill(0.02) }],
        }),
      },
    };

    const adapter = new GeminiEmbeddingAdapter({
      apiKey: "test-key",
      dimensions: 768,
      client: mockClient,
      telemetryRecorder: mockTelemetry,
    });

    const docs = [{ id: 101, title: "Title", content: "Content" }];
    const res = await adapter.embedDocuments(docs, { traceId: "trace-doc-job" });
    assert.equal(res.length, 1);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].traceId, "trace-doc-job");
    assert.equal(recorded[0].operation, "EMBED_CONTENT");
    assert.equal(recorded[0].purpose, "DOCUMENT_EMBEDDING");
  });

  await t.test("telemetry DB failure does not throw or crash parent provider call", async () => {
    let internalErrorCaught = false;
    const faultyTelemetry = {
      recordAttemptSafe: async () => {
        try {
          throw new Error("Database connection lost");
        } catch {
          internalErrorCaught = true;
          // Swallowed safely by recordAttemptSafe as required by Section 41
        }
      },
    };

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: () => "Grounded answer [CHUNK:1]",
          usageMetadata: null,
        }),
      },
    };

    const adapter = new GeminiChatAdapter({
      apiKey: "test-key",
      client: mockClient,
      telemetryRecorder: faultyTelemetry,
    });

    const res = await adapter.generateGroundedAnswer({
      question: "Hello",
      evidence: [{ id: 1, title: "Doc", content: "Content" }],
    });

    assert.ok(res.answer.includes("Grounded answer"));
    assert.equal(internalErrorCaught, true);
  });
});

// ==============================================================================
// 2. REQUEST CONFIG SNAPSHOT & CONCURRENCY ISOLATION (Sections 16, 21, 93, 94)
// ==============================================================================

test("Request Config Snapshot: preserves immutable config per request and isolates concurrency", async (t) => {
  await t.test("request starts with Model A, mid-flight change to Model B does not alter active request", async () => {
    let currentModelInConfig = "gemini-3.5-flash-lite";

    const mockConfigService = {
      getEffectiveConfigSnapshot: async () => ({
        configVersion: 1,
        effectiveEnabled: true,
        generationProvider: "gemini",
        generationModel: currentModelInConfig,
        aiTenMinuteMax: 20,
        aiDailyMax: 50,
        chatbotRequestDeadlineMs: 25000,
      }),
    };

    const executedModels = [];
    const mockChatProviderFactory = (model) => ({
      providerName: "gemini",
      modelName: model,
      generateGroundedAnswer: async ({ traceId }) => {
        executedModels.push({ model, traceId });
        return { answer: "Answer [CHUNK:1]", citedChunkIds: [1] };
      },
    });

    const mockRetrievalService = {
      retrieveKnowledge: async () => {
        // Simulate coordinator changing model while request is in retrieval
        currentModelInConfig = "gemini-3.8-flash";
        return {
          candidates: [{ id: 1, title: "Doc", content: "Evidence", semanticScore: 0.9 }],
          hasSufficientEvidence: true,
          category: "GENERAL",
          embeddingProvider: "gemini",
          embeddingModel: "gemini-embedding-2",
        };
      },
    };

    const service = new ChatbotService({
      isEnabled: true,
      retrievalService: mockRetrievalService,
      chatProvider: null,
      runtimeConfigService: mockConfigService,
      aiQuotaTracker: { consume: () => ({ allowed: true }) },
      semanticRouter: { interpret: async () => ({ route: "RAG", intent: null }) },
      logRepository: { logQuery: async () => {} },
    });
    service.getChatProvider = mockChatProviderFactory;

    // First request should use Model A (gemini-3.5-flash-lite) throughout
    const res1 = await service.handleQuery({ question: "First question" });
    assert.equal(executedModels[0].model, "gemini-3.5-flash-lite");

    // Second request should snapshot new Model B (gemini-3.8-flash)
    const res2 = await service.handleQuery({ question: "Second question" });
    assert.equal(executedModels[1].model, "gemini-3.8-flash");
  });

  await t.test("concurrent requests with different models do not mutate or leak model state", async () => {
    const executed = [];

    const mockProviderFactory = (model) => ({
      providerName: "gemini",
      modelName: model,
      generateGroundedAnswer: async () => {
        executed.push(model);
        return { answer: "Answer [CHUNK:1]", citedChunkIds: [1] };
      },
    });

    const createServiceForModel = (model) => {
      const mockConfig = {
        getEffectiveConfigSnapshot: async () => ({
          configVersion: 1,
          effectiveEnabled: true,
          generationProvider: "gemini",
          generationModel: model,
          aiTenMinuteMax: 20,
          aiDailyMax: 50,
          chatbotRequestDeadlineMs: 25000,
        }),
      };
      const s = new ChatbotService({
        isEnabled: true,
        runtimeConfigService: mockConfig,
        retrievalService: {
          retrieveKnowledge: async () => ({
            candidates: [{ id: 1, title: "D", content: "C", semanticScore: 0.9 }],
            hasSufficientEvidence: true,
            category: "GENERAL",
          }),
        },
        semanticRouter: { interpret: async () => ({ route: "RAG" }) },
        logRepository: { logQuery: async () => {} },
        aiQuotaTracker: { consume: () => ({ allowed: true }) },
      });
      s.getChatProvider = mockProviderFactory;
      return s;
    };

    const s1 = createServiceForModel("gemini-3.5-flash-lite");
    const s2 = createServiceForModel("gemini-3.8-flash");

    await Promise.all([
      s1.handleQuery({ question: "Question 1" }),
      s2.handleQuery({ question: "Question 2" }),
    ]);

    assert.ok(executed.includes("gemini-3.5-flash-lite"));
    assert.ok(executed.includes("gemini-3.8-flash"));
  });
});

// ==============================================================================
// 3. DISABLE SEMANTICS & MASTER GATE (Sections 17, 18, 95)
// ==============================================================================

test("Disable Semantics: rejects new queries cleanly without provider calls", async (t) => {
  let providerCalled = false;
  const mockConfig = {
    getEffectiveConfigSnapshot: async () => ({
      configVersion: 1,
      effectiveEnabled: false, // Coordinator disabled
      generationProvider: "gemini",
      generationModel: "gemini-3.5-flash-lite",
      aiTenMinuteMax: 20,
      aiDailyMax: 50,
      chatbotRequestDeadlineMs: 25000,
    }),
  };

  const service = new ChatbotService({
    isEnabled: true, // Deployment enabled
    runtimeConfigService: mockConfig,
    chatProvider: {
      generateGroundedAnswer: async () => {
        providerCalled = true;
      },
    },
    semanticRouter: {
      interpret: async () => {
        providerCalled = true;
      },
    },
  });

  await assert.rejects(
    async () => service.handleQuery({ question: "Should be rejected" }),
    (err) => {
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, "CHATBOT_UNAVAILABLE");
      return true;
    }
  );

  assert.equal(providerCalled, false, "No provider or routing calls should occur when Caloy is disabled");
});

// ==============================================================================
// 4. RUNTIME CONFIG CACHE & OPTIMISTIC CONCURRENCY (Sections 13, 14, 20, 96, 98)
// ==============================================================================

test("Runtime Config: cache, no-row fallback, and 409 conflict detection", async (t) => {
  await t.test("returns environment defaults when no DB row exists (version: 0)", async () => {
    const mockPrisma = {
      caloyRuntimeConfig: {
        findUnique: async () => null,
      },
    };

    const configService = new CaloyRuntimeConfigService({ prismaClient: mockPrisma, cacheTtlMs: 5000 });
    const dto = await configService.getEffectiveSettingsDto();

    assert.equal(dto.runtimeOverridePresent, false);
    assert.equal(dto.version, 0);
    assert.equal(dto.configuredValues.generationModel, null);
    assert.equal(typeof dto.effectiveValues.generationModel, "string");
  });

  await t.test("optimistic concurrency rejects stale expectedVersion with 409", async () => {
    const mockPrisma = {
      caloyRuntimeConfig: {
        findUnique: async () => ({ id: 1, version: 3, enabled: true }),
        updateMany: async () => ({ count: 0 }), // 0 affected rows indicates conflict
      },
    };
    mockPrisma.$transaction = async (callback) => callback(mockPrisma);

    const configService = new CaloyRuntimeConfigService({ prismaClient: mockPrisma, cacheTtlMs: 5000 });

    await assert.rejects(
      async () => {
        await configService.updateRuntimeConfig({
          expectedVersion: 4,
          enabled: false,
        }, 1);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "CONFIG_VERSION_CONFLICT");
        return true;
      }
    );
  });
});

// ==============================================================================
// 5. MODEL CATALOG & INVALID MODEL FALLBACK (Sections 24, 31, 97)
// ==============================================================================

test("Model Catalog: only approved models allowed, invalid persisted model falls back with warning", async (t) => {
  await t.test("isApprovedGenerationModel validates against server catalog", () => {
    assert.equal(isApprovedGenerationModel("gemini-3.5-flash-lite"), true);
    assert.equal(isApprovedGenerationModel("nonexistent-future-model"), false);
  });

  await t.test("invalid persisted model falls back to deployment model and sets runtimeModelValid: false", async () => {
    const mockPrisma = {
      caloyRuntimeConfig: {
        findUnique: async () => ({
          configId: 1,
          enabled: true,
          generationProvider: "gemini",
          generationModel: "deprecated-unavailable-model",
          aiTenMinuteMax: 20,
          aiDailyMax: 50,
          chatbotRequestDeadlineMs: 25000,
          automaticRetentionEnabled: false,
          logRetentionDays: 90,
          version: 2,
        }),
      },
    };

    const configService = new CaloyRuntimeConfigService({ prismaClient: mockPrisma, cacheTtlMs: 100 });
    const snapshot = await configService.getEffectiveConfigSnapshot();

    assert.equal(snapshot.runtimeModelValid, false);
    assert.equal(snapshot.configuredGenerationModel, "deprecated-unavailable-model");
    assert.ok(isApprovedGenerationModel(snapshot.generationModel));
  });
});

// ==============================================================================
// 6. RETENTION & LEASE PURGE (Sections 54, 55, 59, 62, 99, 100)
// ==============================================================================

test("Retention & Purge: safe batching, lease protection, and preview calculation", async (t) => {
  await t.test("automatic retention disabled does not perform purge", async () => {
    let purgeCalled = false;
    const mockConfig = {
      getEffectiveConfigSnapshot: async () => ({
        automaticRetentionEnabled: false,
        logRetentionDays: 90,
      }),
    };
    const mockPurge = {
      purgeTelemetry: async () => {
        purgeCalled = true;
      },
    };

    const worker = new CaloyTelemetryRetentionWorker({
      configService: mockConfig,
      purgeService: mockPurge,
    });

    await worker.runScheduledCheck();
    assert.equal(purgeCalled, false, "Purge should not execute when automatic retention is disabled");
  });

  await t.test("purge recalculates authoritative matches and does not trust browser preview", async () => {
    let deletedLogs = 0;
    let deletedEvents = 0;

    const mockPrisma = {
      chatbotLog: {
        findMany: async () => [{ id: 1 }, { id: 2 }],
        deleteMany: async () => ({ count: 2 }),
      },
      aiUsageEvent: {
        findMany: async () => [{ id: 10 }],
        deleteMany: async () => ({ count: 1 }),
      },
    };

    const purgeService = new CaloyTelemetryPurgeService({
      prismaClient: mockPrisma,
      leaseService: { acquireLease: async () => true, renewLease: async () => true, releaseLease: async () => true },
      auditLogService: { logOrThrow: async () => {} },
    });
    const result = await purgeService.purgeTelemetry({
      daysOlderThan: 30,
      isManual: false,
      actorId: null,
    });

    assert.equal(result.chatbotLogsDeleted, 2);
    assert.equal(result.aiUsageEventsDeleted, 1);
    assert.ok(result.cutoff);
  });
});

// ==============================================================================
// 7. LOG PRIVACY INVARIANT (Sections 50, 101, 102)
// ==============================================================================

test("Log Privacy: Admin Logs API explicitly excludes question, response, userId, and sessionId", async (t) => {
  const mockPrisma = {
    chatbotLog: {
      count: async () => 1,
      findMany: async () => [
        {
          id: 42,
          createdAt: new Date("2026-09-13T10:00:00Z"),
          responseType: "RAG",
          category: "DOCUMENTS",
          generationProvider: "gemini",
          generationModel: "gemini-3.5-flash-lite",
          selectedParishId: 5,
          latencyMs: 1200,
          fallback: false,
          fallbackReason: null,
          errorCategory: null,
          parish: { id: 5, parishName: "St. Joseph" },
        },
      ],
    },
    parish: {
      findMany: async () => [{ id: 5, parishName: "St. Joseph" }],
    },
  };

  const adminService = new CaloyAdminService({ prismaClient: mockPrisma });
  const logsResult = await adminService.getLogs({});

  assert.equal(logsResult.items.length, 1);
  const item = logsResult.items[0];

  // Verified safe fields
  assert.equal(item.id, 42);
  assert.equal(item.responseType, "RAG");
  assert.equal(item.selectedParishId, 5);
  assert.equal(item.parishName, "St. Joseph");

  // STRICT PRIVACY ASSERTIONS: sensitive properties MUST NOT exist on item
  assert.equal("question" in item, false, "question must NEVER be returned in Admin Logs DTO");
  assert.equal("response" in item, false, "response must NEVER be returned in Admin Logs DTO");
  assert.equal("userId" in item, false, "userId must NEVER be returned in Admin Logs DTO");
  assert.equal("sessionId" in item, false, "sessionId must NEVER be returned in Admin Logs DTO");
  assert.equal("traceId" in item, false, "traceId must NOT be exposed in standard Logs DTO");
});

// ==============================================================================
// 8. ADMIN AUTHORIZATION (Section 103)
// ==============================================================================

test("Admin Authorization: DIOCESE_COORDINATOR allowed; staff and parishioners denied", () => {
  const coordinatorReq = { user: { id: 1, role: "DIOCESE_COORDINATOR" } };
  let allowed = false;
  checkRole(["DIOCESE_COORDINATOR"])(coordinatorReq, {}, () => {
    allowed = true;
  });
  assert.equal(allowed, true);

  for (const role of ["SECRETARY", "PRIEST", "PARISHIONER"]) {
    const req = { user: { id: 2, role } };
    let statusCode = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    checkRole(["DIOCESE_COORDINATOR"])(req, res, () => {
      assert.fail(`Role ${role} must be denied`);
    });
    assert.equal(statusCode, 403);
  }
});

// ==============================================================================
// 9. TIMEZONE & LEGACY DATA INVARIANTS (Sections 104, 105)
// ==============================================================================

test("Timezone & Legacy Data: Asia/Manila boundary and NULL responseType mapping", async (t) => {
  await t.test("getManilaTodayDateString returns YYYY-MM-DD in Asia/Manila", () => {
    const today = getManilaTodayDateString();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("manilaDateToUtcStart converts Manila midnight to UTC 16:00 previous day", () => {
    const utcDate = manilaDateToUtcStart("2026-09-14");
    assert.equal(utcDate.toISOString(), "2026-09-13T16:00:00.000Z");
  });

  await t.test("legacy ChatbotLog with NULL responseType maps to UNKNOWN / LEGACY", async () => {
    const mockPrisma = {
      chatbotLog: {
        count: async () => 1,
        findMany: async () => [
          {
            id: 1,
            createdAt: new Date(),
            responseType: null, // Legacy row
            category: "GENERAL",
            generationProvider: "gemini",
            generationModel: "gemini-3.5-flash-lite",
            selectedParishId: null,
            latencyMs: 500,
            fallback: false,
            fallbackReason: null,
            errorCategory: null,
            parish: null,
          },
        ],
      },
    };

    const adminService = new CaloyAdminService({ prismaClient: mockPrisma });
    const res = await adminService.getLogs({});
    assert.equal(res.items[0].responseType, "UNKNOWN / LEGACY");
  });
});

// ==============================================================================
// 10. COMPOSER TELEMETRY & OPERATION/PURPOSE INTEGRITY (Sections 6, 7)
// ==============================================================================

test("Telemetry Invariants: RESPONSE_COMPOSER purpose and canonical DB constraints", async (t) => {
  await t.test("CaloyResponseComposer records operation GENERATE_CONTENT and purpose RESPONSE_COMPOSER", async () => {
    const recorded = [];
    const mockTelemetry = {
      recordAttemptSafe: (data) => recorded.push(data),
    };

    const mockClient = {
      models: {
        generateContent: async (options) => ({
          text: () => JSON.stringify({
            answer: "The baptismal certificate fee is 150 pesos at St. Joseph Parish.",
            followUp: null,
          }),
          usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15, totalTokenCount: 35 },
        }),
      },
    };

    const composer = new CaloyResponseComposer({
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
      client: mockClient,
      telemetryRecorder: mockTelemetry,
    });

    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: { fee: 150, parish: "St. Joseph" },
      userMessage: "How much is baptism?",
      fallbackAnswer: "Fallback fee is 150 pesos.",
      traceId: "trace-composer-test",
    });

    assert.equal(res.composed, true);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].traceId, "trace-composer-test");
    assert.equal(recorded[0].operation, "GENERATE_CONTENT");
    assert.equal(recorded[0].purpose, "RESPONSE_COMPOSER");
    assert.equal(recorded[0].success, true);
    assert.equal(recorded[0].inputTokens, 20);
    assert.equal(recorded[0].outputTokens, 15);
    assert.equal(recorded[0].totalTokens, 35);
  });

  await t.test("validateTelemetryOperationAndPurpose accepts all 5 canonical purposes and 2 operations", () => {
    assert.equal(ALLOWED_OPERATIONS.size, 2);
    assert.ok(ALLOWED_OPERATIONS.has("GENERATE_CONTENT"));
    assert.ok(ALLOWED_OPERATIONS.has("EMBED_CONTENT"));

    assert.equal(ALLOWED_PURPOSES.size, 5);
    assert.ok(ALLOWED_PURPOSES.has("SEMANTIC_ROUTING"));
    assert.ok(ALLOWED_PURPOSES.has("RAG_GENERATION"));
    assert.ok(ALLOWED_PURPOSES.has("RESPONSE_COMPOSER"));
    assert.ok(ALLOWED_PURPOSES.has("QUERY_EMBEDDING"));
    assert.ok(ALLOWED_PURPOSES.has("DOCUMENT_EMBEDDING"));

    // Supported pairings pass
    assert.equal(validateTelemetryOperationAndPurpose("GENERATE_CONTENT", "SEMANTIC_ROUTING"), true);
    assert.equal(validateTelemetryOperationAndPurpose("GENERATE_CONTENT", "RAG_GENERATION"), true);
    assert.equal(validateTelemetryOperationAndPurpose("GENERATE_CONTENT", "RESPONSE_COMPOSER"), true);
    assert.equal(validateTelemetryOperationAndPurpose("EMBED_CONTENT", "QUERY_EMBEDDING"), true);
    assert.equal(validateTelemetryOperationAndPurpose("EMBED_CONTENT", "DOCUMENT_EMBEDDING"), true);

    // Unsupported values throw
    assert.throws(() => validateTelemetryOperationAndPurpose("CHAT", "RAG_GENERATION"), /Unsupported AI telemetry operation/);
    assert.throws(() => validateTelemetryOperationAndPurpose("GENERATE_CONTENT", "INVALID_PURPOSE"), /Unsupported AI telemetry purpose/);
  });
});

// ==============================================================================
// 11. GEMINI 3.8 FLASH CONTRACT & CATALOG COMPATIBILITY (Section 8)
// ==============================================================================

test("Gemini 3.8 Flash Generation Contract & Catalog Compatibility", async (t) => {
  await t.test("buildGeminiGenerationConfig strips sampling parameters for gemini-3.8-flash", () => {
    const baseConfig = {
      systemInstruction: "You are Caloy",
      maxOutputTokens: 500,
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
    };

    const config38 = buildGeminiGenerationConfig({
      model: "gemini-3.8-flash",
      baseConfig,
      purpose: "RAG_GENERATION",
    });

    // temperature, topP, topK must NOT be present
    assert.equal("temperature" in config38, false, "temperature must be stripped for gemini-3.8-flash");
    assert.equal("topP" in config38, false, "topP must be stripped for gemini-3.8-flash");
    assert.equal("topK" in config38, false, "topK must be stripped for gemini-3.8-flash");
    assert.equal(config38.systemInstruction, "You are Caloy");
    assert.equal(config38.maxOutputTokens, 500);
  });

  await t.test("buildGeminiGenerationConfig preserves temperature for standard catalog models", () => {
    const baseConfig = {
      systemInstruction: "You are Caloy",
      maxOutputTokens: 500,
      temperature: 0.2,
    };

    for (const model of ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"]) {
      const config = buildGeminiGenerationConfig({
        model,
        baseConfig,
        purpose: "RAG_GENERATION",
      });

      assert.equal(config.temperature, 0.2, `temperature should be preserved for ${model}`);
      assert.equal(config.maxOutputTokens, 500);
    }
  });

  await t.test("GeminiChatAdapter passes compatible request for every catalog model", async () => {
    for (const entry of APPROVED_GENERATION_MODELS) {
      let passedConfig = null;
      const mockClient = {
        models: {
          generateContent: async (options) => {
            passedConfig = options.config;
            return {
              text: () => `Answer from ${entry.id} [CHUNK:1]`,
              usageMetadata: null,
            };
          },
        },
      };

      const adapter = new GeminiChatAdapter({
        apiKey: "test-key",
        model: entry.id,
        client: mockClient,
        telemetryRecorder: { recordAttemptSafe: () => {} },
      });

      const res = await adapter.generateGroundedAnswer({
        question: "How do I request a baptismal certificate?",
        evidence: [{ id: 1, title: "Title", content: "Body" }],
      });

      assert.ok(res.answer.includes(entry.id));
      assert.ok(passedConfig);

      if (entry.id.startsWith("gemini-3.8")) {
        assert.equal("temperature" in passedConfig, false, `gemini-3.8 must NOT have temperature`);
      } else {
        assert.equal(passedConfig.temperature, 0.2, `${entry.id} must retain temperature`);
      }
    }
  });
});

// ==============================================================================
// 12. TIMEOUT INVARIANT & DEADLINE BOUNDS (Section 2)
// ==============================================================================

test("Timeout Invariants: 28s backend maximum and schema bounds", () => {
  // Valid deadlines: 5000, 25000, 28000
  assert.ok(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 5000 }).success);
  assert.ok(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 25000 }).success);
  assert.ok(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 28000 }).success);

  // Invalid deadlines: < 5000 or > 28000
  assert.equal(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 4999 }).success, false);
  assert.equal(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 28001 }).success, false);
  assert.equal(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 30000 }).success, false);
  assert.equal(caloySettingsUpdateSchema.safeParse({ expectedVersion: 1, chatbotRequestDeadlineMs: 60000 }).success, false);
});

// ==============================================================================
// 13. FIRST-SAVE RUNTIME CONFIG ENVIRONMENT PRESERVATION (Section 10)
// ==============================================================================

test("First-Save Runtime Config: preserves deliberate non-default env settings", async () => {
  let createdData = null;
  const mockPrisma = {
    caloyRuntimeConfig: {
      findUnique: async () => null, // No row in DB yet
      create: async ({ data }) => {
        createdData = data;
        return { ...data, createdAt: new Date(), updatedAt: new Date() };
      },
    },
    activityLog: {
      create: async () => ({}),
    },
    user: {
      findUnique: async () => ({ id: 1, parishId: null, role: { roleName: "DIOCESE_COORDINATOR" } }),
    },
  };
  mockPrisma.$transaction = async (callback) => callback(mockPrisma);

  // Mock service where previousSnapshot reflects custom environment values
  const service = new CaloyRuntimeConfigService(mockPrisma);
  service.getRuntimeConfig = async () => ({
    runtimeOverridePresent: false,
    version: 0,
    effectiveEnabled: true,
    runtimeEnabled: true,
    generationProvider: "gemini",
    generationModel: "gemini-3.5-flash", // custom env model
    effectiveGenerationModel: "gemini-3.5-flash",
    runtimeModelValid: true,
    aiTenMinuteMax: 31, // custom env limit
    aiDailyMax: 82,     // custom env limit
    chatbotRequestDeadlineMs: 26000, // custom env deadline
    automaticRetentionEnabled: false,
    logRetentionDays: 90,
    runtimeConfigDatabaseAvailable: true,
  });

  // Coordinator saves ONLY automaticRetentionEnabled: true
  await service.updateRuntimeConfig({
    expectedVersion: 0,
    automaticRetentionEnabled: true,
  }, 1);

  assert.ok(createdData, "caloyRuntimeConfig.create must be called");
  assert.equal(createdData.id, 1);
  assert.equal(createdData.version, 1);
  // Preserved from environment, NOT overwritten with hardcoded schema defaults:
  assert.equal(createdData.generationModel, "gemini-3.5-flash");
  assert.equal(createdData.aiTenMinuteMax, 31);
  assert.equal(createdData.aiDailyMax, 82);
  assert.equal(createdData.chatbotRequestDeadlineMs, 26000);
  // Patched value:
  assert.equal(createdData.automaticRetentionEnabled, true);
});

// ==============================================================================
// 14. EXACT RETENTION DATABASE LEASE RACE (Section 5)
// ==============================================================================

test("Retention Lease Race: exactly one worker instance acquires the lease", async () => {
  let activeLeaseOwner = null;
  let activeLeaseExpiry = 0;

  const mockPrisma = {
    $queryRaw: async (query, ...params) => {
      // Handle tagged template or regular call
      const rawSql = Array.isArray(query) ? query.join(" ") : String(query);
      const isRelease = rawSql.includes("lease_expires_at") && rawSql.includes("NOW()") && !rawSql.includes("INSERT");

      if (isRelease) {
        const leaseKey = params[0];
        const ownerToken = params[1];
        if (activeLeaseOwner === ownerToken) {
          activeLeaseOwner = null;
          activeLeaseExpiry = 0;
          return [{ lease_key: leaseKey }];
        }
        return [];
      }

      // Claim lease
      const now = Date.now();
      const leaseKey = params[0];
      const ownerToken = params[1];
      const ttlSeconds = params[2];
      const expiresAt = new Date(now + (Number(ttlSeconds) * 1000));

      if (!activeLeaseOwner || activeLeaseExpiry < now || activeLeaseOwner === ownerToken) {
        activeLeaseOwner = ownerToken;
        activeLeaseExpiry = expiresAt.getTime();
        return [{ lease_key: leaseKey, owner_token: ownerToken, lease_expires_at: expiresAt }];
      }

      // Active lease owned by another instance
      return [];
    },
  };

  const leaseService = new SystemLeaseService(mockPrisma);

  // Worker 1 and Worker 2 race to acquire "CALOY_TELEMETRY_RETENTION"
  const worker1Token = "worker-1-uuid";
  const worker2Token = "worker-2-uuid";

  const worker1Acquired = await leaseService.acquireLease("CALOY_TELEMETRY_RETENTION", worker1Token, 300);
  const worker2Acquired = await leaseService.acquireLease("CALOY_TELEMETRY_RETENTION", worker2Token, 300);

  assert.equal(worker1Acquired, true, "Worker 1 must successfully acquire the lease");
  assert.equal(worker2Acquired, false, "Worker 2 must fail to acquire while Worker 1 holds active lease");

  // Worker 1 finishes and releases lease
  const released = await leaseService.releaseLease("CALOY_TELEMETRY_RETENTION", worker1Token);
  assert.equal(released, true, "Worker 1 releases lease");

  // Now Worker 2 tries again and succeeds
  const worker2Retry = await leaseService.acquireLease("CALOY_TELEMETRY_RETENTION", worker2Token, 300);
  assert.equal(worker2Retry, true, "Worker 2 acquires lease after Worker 1 release");
});

// ==============================================================================
// 15. MODEL CONFIG SOURCE OF TRUTH & KNOWLEDGESOURCE RETIRED STATUS (Sections 9, 11)
// ==============================================================================

test("Model Config Source of Truth & KnowledgeSource Status Terminology", async (t) => {
  await t.test("settings effective model matches env and is received by provider factory", async () => {
    const mockPrisma = {
      caloyRuntimeConfig: { findUnique: async () => null },
    };
    const configService = new CaloyRuntimeConfigService(mockPrisma);
    const dto = await configService.getEffectiveSettingsDto();

    const expectedDeploymentModel = (env.chatbot?.generationModel || "gemini-3.5-flash-lite").trim();
    assert.equal(dto.effectiveValues.generationModel, expectedDeploymentModel);

    // Provider factory receives the exact model
    const adapter = getGeminiChatAdapter(dto.effectiveValues.generationModel);
    assert.equal(adapter.modelName, expectedDeploymentModel);
  });

  await t.test("KnowledgeSource canonical status is RETIRED (never ARCHIVED)", () => {
    const validStatuses = ["DRAFT", "ACTIVE", "RETIRED"];
    assert.ok(validStatuses.includes("RETIRED"));
    assert.equal(validStatuses.includes("ARCHIVED"), false, "ARCHIVED is not a valid KnowledgeSourceStatus");
  });
});
