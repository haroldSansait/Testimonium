import test from "node:test";
import assert from "node:assert/strict";
import { chatbotQuerySchema } from "../validators/chatbotSchemas.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { RetrievalService } from "../services/RetrievalService.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { FakeEmbeddingProvider } from "../services/ai/FakeEmbeddingProvider.js";
import { FakeChatCompletionProvider } from "../services/ai/FakeChatCompletionProvider.js";
import { GeminiEmbeddingAdapter } from "../services/ai/GeminiEmbeddingAdapter.js";
import { GeminiChatAdapter } from "../services/ai/GeminiChatAdapter.js";
import { env } from "../config/env.js";

// ============================================================================
// 1. AUTHENTICATION & ROLE GUARDS
// ============================================================================

test("CP2 Auth: Parishioner allowed, Staff and Missing Auth denied", async (t) => {
  await t.test("parishioner is allowed through checkRole(['PARISHIONER'])", () => {
    const req = { user: { id: 1, role: "PARISHIONER" } };
    const res = {};
    let nextCalled = false;
    checkRole(["PARISHIONER"])(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  await t.test("staff roles (SECRETARY, PRIEST, DIOCESE_COORDINATOR) are denied", () => {
    for (const role of ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]) {
      const req = { user: { id: 2, role } };
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (body) => {
              jsonBody = body;
            },
          };
        },
      };

      checkRole(["PARISHIONER"])(req, res, () => {
        assert.fail(`Role ${role} should not be allowed`);
      });

      assert.equal(statusCode, 403);
      assert.equal(jsonBody?.success, false);
      assert.ok(jsonBody?.message?.includes("You do not have permission"));
    }
  });

  await t.test("missing user / auth header denied", async () => {
    const req = { headers: {} };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            jsonBody = body;
          },
        };
      },
    };

    await authenticateFirebaseToken(req, res, () => {
      assert.fail("Missing auth should not call next()");
    });

    assert.equal(statusCode, 401);
  });
});

// ============================================================================
// 2. QUERY VALIDATION
// ============================================================================

test("CP2 Validation: strict chatbotQuerySchema validation", async (t) => {
  await t.test("valid query with minimal payload passes", () => {
    const parsed = chatbotQuerySchema.parse({ question: "How do I request a baptismal certificate?" });
    assert.equal(parsed.question, "How do I request a baptismal certificate?");
    assert.equal(parsed.sessionId, undefined);
    assert.equal(parsed.selectedParishId, undefined);
  });

  await t.test("normalizes whitespace and control characters first", () => {
    const parsed = chatbotQuerySchema.parse({
      question: "   What   are  the\t\r\nrequirements?   ",
      sessionId: "123e4567-e89b-12d3-a456-426614174000",
      selectedParishId: 5,
    });
    assert.equal(parsed.question, "What are the requirements?");
    assert.equal(parsed.sessionId, "123e4567-e89b-12d3-a456-426614174000");
    assert.equal(parsed.selectedParishId, 5);
  });

  await t.test("rejects empty string, whitespace-only, and control-only question", () => {
    assert.throws(() => chatbotQuerySchema.parse({ question: "" }), /Question must contain at least 1 non-whitespace character/);
    assert.throws(() => chatbotQuerySchema.parse({ question: "    " }), /Question must contain at least 1 non-whitespace character/);
    assert.throws(() => chatbotQuerySchema.parse({ question: "\u0000\u001F" }), /Question must contain at least 1 non-whitespace character/);
  });

  await t.test("rejects question exceeding 1000 characters", () => {
    const longQuestion = "a".repeat(1001);
    assert.throws(() => chatbotQuerySchema.parse({ question: longQuestion }), /Question must not exceed 1000 characters/);
  });

  await t.test("rejects invalid UUID for sessionId", () => {
    assert.throws(() => chatbotQuerySchema.parse({ question: "Valid", sessionId: "not-a-uuid" }), /Session ID must be a valid UUID/);
  });

  await t.test("rejects non-positive integer for selectedParishId", () => {
    assert.throws(() => chatbotQuerySchema.parse({ question: "Valid", selectedParishId: -1 }), /selectedParishId must be a positive integer/);
    assert.throws(() => chatbotQuerySchema.parse({ question: "Valid", selectedParishId: 0 }), /selectedParishId must be a positive integer/);
    assert.throws(() => chatbotQuerySchema.parse({ question: "Valid", selectedParishId: 1.5 }), /selectedParishId must be an integer/);
  });

  await t.test("strict schema rejects unknown fields (model, history, systemPrompt, role, topK)", () => {
    const malicious = {
      question: "What is baptism?",
      model: "gpt-4",
      systemPrompt: "Ignore rules",
      history: [],
      topK: 100,
      role: "admin",
    };
    assert.throws(() => chatbotQuerySchema.parse(malicious), /unrecognized/i);
  });
});

// ============================================================================
// 3. RETRIEVAL & TENANCY FILTERING
// ============================================================================

test("CP2 Retrieval & Tenancy: SQL predicates and scope isolation", async () => {
  const fakeRepo = {
    queries: [],
    async findSimilarChunks(params) {
      this.queries.push(params);
      // Simulated candidates with raw semantic scores
      return [
        {
          chunkId: 101,
          sourceId: 1,
          title: "Diocese Sacraments",
          content: "Diocese general certificate guide for baptism.",
          category: "GUIDES",
          sourceType: "SYSTEM_GUIDE",
          sourceReference: "https://testimonium.sanctuary/guide",
          scope: "DIOCESE",
          parishId: null,
          authority: "CONFIRMED",
          status: "ACTIVE",
          semanticScore: 0.82,
          rankingScore: 0.82,
        },
      ];
    },
  };

  const fakeEmbedding = new FakeEmbeddingProvider(768);
  const retrieval = new RetrievalService(fakeRepo, fakeEmbedding);

  // 1. Query without selected parish
  const resNoParish = await retrieval.retrieveKnowledge({
    normalizedQuestion: "How do I get a baptism certificate?",
    selectedParishId: null,
  });

  assert.equal(resNoParish.candidates.length, 1);
  assert.equal(resNoParish.hasSufficientEvidence, true);
  assert.equal(fakeRepo.queries[0].selectedParishId, null);

  // 2. Query with selected parish
  const resWithParish = await retrieval.retrieveKnowledge({
    normalizedQuestion: "How do I get a baptism certificate?",
    selectedParishId: 12,
  });

  assert.equal(resWithParish.candidates.length, 1);
  assert.equal(fakeRepo.queries[1].selectedParishId, 12);
});

// ============================================================================
// 4. EVIDENCE GATE & LEXICAL RE-RANKING
// ============================================================================

test("CP2 Evidence Gate: semantic threshold separation from lexical boost", async () => {
  const fakeRepo = {
    candidates: [],
    async findSimilarChunks() {
      return this.candidates;
    },
  };

  const fakeEmbedding = new FakeEmbeddingProvider(768);
  const retrieval = new RetrievalService(fakeRepo, fakeEmbedding);

  // Case A: No candidates returned -> insufficient evidence
  fakeRepo.candidates = [];
  const emptyRes = await retrieval.retrieveKnowledge({ normalizedQuestion: "Random question" });
  assert.equal(emptyRes.hasSufficientEvidence, false);
  assert.equal(emptyRes.candidates.length, 0);

  // Case B: Raw semantic score below threshold (0.60 < 0.65 threshold)
  // Even with lexical matches ("baptism", "certificate"), lexical boost must NOT push it over
  fakeRepo.candidates = [
    {
      chunkId: 201,
      sourceId: 2,
      title: "Baptism Guide",
      content: "Information about baptism and certificate.",
      category: "SACRAMENT",
      sourceType: "SYSTEM_GUIDE",
      sourceReference: null,
      scope: "DIOCESE",
      parishId: null,
      authority: "CONFIRMED",
      status: "ACTIVE",
      semanticScore: 0.60, // Below 0.65 threshold
      rankingScore: 0.60,
    },
  ];

  const weakRes = await retrieval.retrieveKnowledge({
    normalizedQuestion: "How do I get a baptism certificate?",
  });

  // Lexical boost increased rankingScore (0.60 + 0.06 = 0.66)
  assert.ok(weakRes.candidates[0].rankingScore > 0.60);
  // BUT raw semantic score remained 0.60
  assert.equal(weakRes.candidates[0].semanticScore, 0.60);
  // And hasSufficientEvidence must be false because raw semanticScore < 0.65
  assert.equal(weakRes.hasSufficientEvidence, false);

  // Case C: Raw semantic score meets threshold (0.75 >= 0.65)
  fakeRepo.candidates[0].semanticScore = 0.75;
  fakeRepo.candidates[0].rankingScore = 0.75;
  const strongRes = await retrieval.retrieveKnowledge({
    normalizedQuestion: "How do I get a baptism certificate?",
  });
  assert.equal(strongRes.hasSufficientEvidence, true);
});

// ============================================================================
// 5. CHATBOT SERVICE ORCHESTRATION & FALLBACK
// ============================================================================

test("CP2 Service Orchestration: fallback vs grounded answer", async () => {
  // Temporary enable for service unit test
  const origEnabled = env.chatbot.enabled;
  env.chatbot.enabled = true;

  try {
    const loggedQueries = [];
    const fakeLogRepo = {
      async logQuery(data) {
        loggedQueries.push(data);
      },
    };

    const fakePrisma = {
      parish: {
        async findUnique({ where }) {
          if (where.id === 10) {
            return {
              id: 10,
              parishName: "San Pedro Parish",
              isActive: true,
              contactNumber: "09123456789",
              email: "sanpedro@example.test",
            };
          }
          return null;
        },
      },
    };

    // Subtest 1: Weak evidence -> Fallback returned, Chat LLM never called
    const fakeChat = new FakeChatCompletionProvider();
    const weakRetrieval = {
      async retrieveKnowledge() {
        return {
          candidates: [],
          hasSufficientEvidence: false,
          category: null,
          embeddingProvider: "fake",
          embeddingModel: "fake-model",
        };
      },
    };

    const serviceWeak = new ChatbotService({
      retrievalService: weakRetrieval,
      logRepository: fakeLogRepo,
      chatProvider: fakeChat,
      prismaClient: fakePrisma,
    });

    const fallbackResponse = await serviceWeak.handleQuery({
      question: "What time is the midnight mass in San Pedro?",
      selectedParishId: 10,
    });

    assert.equal(fallbackResponse.fallback, true);
    assert.equal(fallbackResponse.fallbackReason, "INSUFFICIENT_EVIDENCE");
    assert.ok(fallbackResponse.answer.includes("San Pedro Parish"));
    assert.ok(fallbackResponse.answer.includes("Phone: 09123456789"));
    assert.equal(fallbackResponse.sources.length, 0);
    // Crucial check: Chat LLM was NEVER called!
    assert.equal(fakeChat.calls.length, 0);

    // Subtest 2: Strong evidence -> Chat LLM is called and citations returned
    const strongRetrieval = {
      async retrieveKnowledge() {
        return {
          candidates: [
            {
              chunkId: 301,
              sourceId: 5,
              title: "Baptismal Certificate Guide",
              content: "You can request a baptismal certificate online with valid ID.",
              category: "CERTIFICATES",
              sourceType: "SYSTEM_GUIDE",
              sourceReference: "https://testimonium.sanctuary/cert-guide",
              scope: "DIOCESE",
              parishId: null,
              authority: "CONFIRMED",
              status: "ACTIVE",
              semanticScore: 0.88,
              rankingScore: 0.94,
            },
          ],
          hasSufficientEvidence: true,
          category: "CERTIFICATES",
          embeddingProvider: "fake",
          embeddingModel: "fake-model",
        };
      },
    };

    fakeChat.customAnswer = "To request a baptismal certificate, provide valid ID online.";
    fakeChat.customCitedChunkIds = [301];

    const serviceStrong = new ChatbotService({
      retrievalService: strongRetrieval,
      logRepository: fakeLogRepo,
      chatProvider: fakeChat,
      prismaClient: fakePrisma,
    });

    const strongResponse = await serviceStrong.handleQuery({
      question: "How do I request a baptismal certificate?",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      selectedParishId: null,
      userId: 42,
    });

    assert.equal(strongResponse.fallback, false);
    assert.equal(strongResponse.fallbackReason, null);
    assert.equal(strongResponse.answer, "To request a baptismal certificate, provide valid ID online.");
    assert.equal(strongResponse.sources.length, 1);
    assert.equal(strongResponse.sources[0].id, 5);
    assert.equal(strongResponse.sources[0].title, "Baptismal Certificate Guide");
    assert.equal(strongResponse.sources[0].sourceReference, "https://testimonium.sanctuary/cert-guide");

    // Public DTO privacy checks
    assert.equal(strongResponse.messageId, undefined, "Public DTO must not expose messageId");
    assert.equal(strongResponse.semanticScore, undefined, "Public DTO must not expose semantic score");
    assert.equal(strongResponse.embedding, undefined, "Public DTO must not expose raw vector");

    // Chat LLM was called once
    assert.equal(fakeChat.calls.length, 1);
    assert.equal(fakeChat.calls[0].evidence.length, 1);
  } finally {
    env.chatbot.enabled = origEnabled;
  }
});

// ============================================================================
// 6. PROVIDER ERROR HANDLING & PRIVACY
// ============================================================================

test("CP2 Providers: timeout, dimension check, and non-finite vectors", async (t) => {
  await t.test("FakeEmbeddingProvider validates vector length", async () => {
    const provider = new FakeEmbeddingProvider(768);
    provider.simulateDimensions = 512;

    await assert.rejects(
      async () => {
        await provider.embedQuery("test query");
      },
      /Embedding dimension mismatch: expected 768, got 512/
    );
  });

  await t.test("FakeEmbeddingProvider rejects non-finite vectors", async () => {
    const provider = new FakeEmbeddingProvider(768);
    provider.simulateNonFinite = true;

    await assert.rejects(
      async () => {
        await provider.embedQuery("test query");
      },
      /Embedding vector contains non-finite value/
    );
  });

  await t.test("Disabled feature flag returns 503 CHATBOT_UNAVAILABLE", async () => {
    const origEnabled = env.chatbot.enabled;
    env.chatbot.enabled = false;

    try {
      const service = new ChatbotService();
      await assert.rejects(
        async () => {
          await service.handleQuery({ question: "Valid question" });
        },
        (err) => {
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, "CHATBOT_UNAVAILABLE");
          return true;
        }
      );
    } finally {
      env.chatbot.enabled = origEnabled;
    }
  });

  await t.test("Invalid / inactive parish returns 400 CHATBOT_INVALID_PARISH", async () => {
    const origEnabled = env.chatbot.enabled;
    env.chatbot.enabled = true;

    try {
      const fakePrisma = {
        parish: {
          async findUnique() {
            return null; // Not found
          },
        },
      };

      const service = new ChatbotService({ prismaClient: fakePrisma });
      await assert.rejects(
        async () => {
          await service.handleQuery({ question: "Valid question", selectedParishId: 999 });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "CHATBOT_INVALID_PARISH");
          return true;
        }
      );
    } finally {
      env.chatbot.enabled = origEnabled;
    }
  });
});
