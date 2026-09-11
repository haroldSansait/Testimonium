import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { AiQuotaTracker } from "../services/ai/aiQuotaTracker.js";
import { detectSocialIntent } from "../services/ai/socialIntentClassifier.js";
import {
  humanizeDocumentType,
  humanizeDocumentStatus,
  humanizePaymentStatus,
  humanizeVerificationStatus,
  humanizeEventType,
  humanizeScheduleStatus,
} from "../services/ai/liveTools/enumFormatters.js";

test("Caloy Live Tools & Hybrid Routing Test Suite", async (t) => {
  // -------------------------------------------------------------
  // Section 1: Enum Humanization
  // -------------------------------------------------------------
  await t.test("1. Enum Humanization preserves underlying enums and produces readable strings", () => {
    assert.equal(humanizeDocumentType("BAPTISMAL_CERTIFICATE"), "Baptismal Certificate");
    assert.equal(humanizeDocumentType("FIRST_COMMUNION_CERTIFICATE"), "First Communion Certificate");
    assert.equal(humanizeDocumentStatus("READY_FOR_PICKUP"), "Ready for pickup");
    assert.equal(humanizeDocumentStatus("PENDING_PAYMENT"), "Pending payment");
    assert.equal(humanizePaymentStatus("PAYMENT_UNDER_REVIEW"), "Payment under review");
    assert.equal(humanizeVerificationStatus("APPROVED"), "Approved");
    assert.equal(humanizeEventType("WEDDING"), "Wedding");
    assert.equal(humanizeScheduleStatus("CONFIRMED"), "Confirmed");
    assert.equal(humanizeScheduleStatus("PENDING_STAFF_APPROVAL"), "Pending staff approval");
  });

  // -------------------------------------------------------------
  // Section 2: Expanded Capabilities & Social Classifier
  // -------------------------------------------------------------
  await t.test("2. Social classifier recognizes expanded capability queries without Gemini calls", () => {
    const capabilityQueries = [
      "What do you answer?",
      "What can I ask you?",
      "What questions can you answer?",
      "What do you usually answer?",
      "What do you usually help with?",
      "What can you help me with?",
      "What do you know?",
      "What are you for?",
      "Hello Caloy! what do you usually answer?",
      "Hi Caloy, what can you help me with?",
    ];

    for (const query of capabilityQueries) {
      const intent = detectSocialIntent(query);
      assert.ok(intent, `Expected intent for query: "${query}"`);
      assert.equal(intent.intent, "CAPABILITIES", `Expected CAPABILITIES intent for: "${query}"`);
    }

    // Conservative check: Substantive questions with greetings must NOT become greeting-only
    const substantiveWithGreeting1 = detectSocialIntent("Hi Caloy, how do I request a baptism certificate?");
    assert.equal(substantiveWithGreeting1, null, "Substantive procedural question must not be classified as social");

    const substantiveWithGreeting2 = detectSocialIntent("Hello, has my payment been verified?");
    assert.equal(substantiveWithGreeting2, null, "Substantive live tool question must not be classified as social");
  });

  // -------------------------------------------------------------
  // Section 3: Router Distinctions (RAG vs LIVE_DATA vs CLARIFICATION)
  // -------------------------------------------------------------
  await t.test("3. Router accurately separates Procedural RAG from Dynamic Live Tools", () => {
    const router = new LiveToolRouter();

    // RAG inquiries (general procedures, rules, policies)
    const rag1 = router.route({ question: "How does payment verification work?" });
    assert.equal(rag1, null, "General policy must route to RAG");

    const rag2 = router.route({ question: "How does scheduling work?" });
    assert.equal(rag2, null, "General scheduling guide must route to RAG");

    const rag3 = router.route({ question: "Can I choose a preferred priest?" });
    assert.equal(rag3, null, "General policy about preferred priest must route to RAG");

    const rag4 = router.route({ question: "What documents does TESTIMONIUM support?" });
    assert.equal(rag4, null, "System-wide supported documents must route to RAG");

    // Live tool inquiries
    const live1 = router.route({ question: "Has my payment been verified?", userId: 1 });
    assert.ok(live1);
    assert.equal(live1.toolId, TOOL_IDS.CHECK_MY_PAYMENT_STATUS);

    const live2 = router.route({ question: "What slots are available tomorrow?", selectedParishId: 2 });
    assert.ok(live2);
    assert.equal(live2.toolId, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);

    const live3 = router.route({ question: "Who are the active priests here?", selectedParishId: 3 });
    assert.ok(live3);
    assert.equal(live3.toolId, TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS);

    const live4 = router.route({ question: "Who are the priests at St. Joseph?" });
    assert.ok(live4);
    assert.equal(live4.toolId, TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS);

    // Fee without parish -> requires PARISH
    const feeNoParish = router.route({ question: "How much is a baptismal certificate?" });
    assert.ok(feeNoParish);
    assert.equal(feeNoParish.toolId, TOOL_IDS.GET_DOCUMENT_FEE);
    assert.equal(feeNoParish.nextRequired, "PARISH");

    // Fee with parish and document -> complete
    const feeComplete = router.route({ question: "How much is a baptismal certificate?", selectedParishId: 2 });
    assert.ok(feeComplete);
    assert.equal(feeComplete.toolId, TOOL_IDS.GET_DOCUMENT_FEE);
    assert.equal(feeComplete.isComplete, true);
    assert.equal(feeComplete.parameters.documentType, "BAPTISMAL_CERTIFICATE");
    assert.equal(feeComplete.parameters.parishId, 2);
  });

  // -------------------------------------------------------------
  // Section 4: Public Live Tools & Parish Freedom
  // -------------------------------------------------------------
  await t.test("4. Public Live Tools execute without parish lock (user.parishId ignored)", async () => {
    // Fake database state
    const fakeParishes = [
      { id: 1, parishName: "St. John the Baptist", isActive: true, address: "123 Main St", contactNumber: "09171234567", email: "stjohn@test.com", officeHours: "Mon-Fri 8am-5pm", availableDocuments: ["BAPTISMAL_CERTIFICATE"] },
      { id: 2, parishName: "San Sebastian Cathedral", isActive: true, address: "Cathedral Ave", contactNumber: "09189876543", email: "cathedral@test.com", officeHours: "Tue-Sat 9am-4pm", availableDocuments: ["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"] },
    ];

    const fakePrisma = {
      parish: {
        findMany: async () => fakeParishes,
        findUnique: async ({ where }) => fakeParishes.find((p) => p.id === where.id) || null,
      },
      user: {
        findMany: async ({ where }) => {
          if (where.parishId === 1) {
            return [{ id: 10, fullName: "Father Pedro", isAssistant: false }];
          }
          if (where.parishId === 2) {
            return [{ id: 20, fullName: "Monsignor Jose", isAssistant: false }];
          }
          return [];
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: fakePrisma });

    // Parishioner whose profile has parishId = 999 can query Parish 1 and Parish 2 freely!
    const contextUser = { id: 50, parishId: 999 };

    // Query priests at Parish 1
    const priests1 = await registry.execute(TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS, { parishId: 1 }, contextUser);
    assert.ok(priests1.answer.includes("Pedro"));

    // Query priests at Parish 2
    const priests2 = await registry.execute(TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS, { parishId: 2 }, contextUser);
    assert.ok(priests2.answer.includes("Jose"));

    // Office info for Parish 1
    const office1 = await registry.execute(TOOL_IDS.GET_PARISH_OFFICE_INFO, { parishId: 1 }, contextUser);
    assert.ok(office1.answer.includes("123 Main St"));
    assert.ok(office1.answer.includes("Mon-Fri 8am-5pm"));

    // Nonexistent or inactive parish -> handled safely
    const inactiveResult = await registry.execute(TOOL_IDS.GET_PARISH_OFFICE_INFO, { parishId: 9999 }, contextUser);
    assert.ok(inactiveResult.answer.includes("could not be found"));
  });

  // -------------------------------------------------------------
  // Section 5: Dynamic Data Verification (No Static RAG snapshot)
  // -------------------------------------------------------------
  await t.test("5. Dynamic Live Data updates immediately when source records change", async () => {
    let priestsList = [
      { id: 10, fullName: "Father Alpha", isAssistant: false },
    ];

    const fakePrisma = {
      parish: {
        findUnique: async () => ({ id: 1, parishName: "St. Anne Parish", isActive: true }),
      },
      user: {
        findMany: async () => priestsList,
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: fakePrisma });

    // First call: Father Alpha
    const res1 = await registry.execute(TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS, { parishId: 1 }, { id: 1 });
    assert.ok(res1.answer.includes("Alpha"));
    assert.equal(res1.answer.includes("Beta"), false);

    // Dynamic mutation in database
    priestsList = [
      { id: 11, fullName: "Father Beta", isAssistant: false },
    ];

    // Second call: reflects Father Beta immediately
    const res2 = await registry.execute(TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS, { parishId: 1 }, { id: 1 });
    assert.ok(res2.answer.includes("Beta"));
    assert.equal(res2.answer.includes("Alpha"), false);
  });

  // -------------------------------------------------------------
  // Section 6: Private Tools Authorization & Ownership
  // -------------------------------------------------------------
  await t.test("6. Private Tools strictly enforce authenticated ownership and block cross-user disclosure", async () => {
    const user1 = { id: 101 };
    const user2 = { id: 202 };

    const mockRequestRepo = {
      findByTrackingNumber: async (trackingNumber, userId) => {
        if (trackingNumber === "SR-2026-000001" && userId === 101) {
          return {
            id: "req-1",
            trackingNumber: "SR-2026-000001",
            userId: 101, // Owned by user 101!
            documentType: "BAPTISMAL_CERTIFICATE",
            status: "READY_FOR_PICKUP",
            paymentStatus: "PAYMENT_VERIFIED",
            parish: { parishName: "St. Jude" },
          };
        }
        return null;
      },
      findMany: async ({ userId }) => {
        if (userId === 101) {
          return {
            data: [
              {
                id: "req-1",
                trackingNumber: "SR-2026-000001",
                documentType: "BAPTISMAL_CERTIFICATE",
                status: "READY_FOR_PICKUP",
                parish: { parishName: "St. Jude" },
              },
            ],
            total: 1,
          };
        }
        return { data: [], total: 0 };
      },
    };

    const registry = new LiveToolRegistry({
      prismaClient: { parish: { findUnique: async () => ({ id: 1, parishName: "St. Jude", isActive: true }) } },
      requestRepository: mockRequestRepo,
    });

    // Case A: User 101 checks own tracking number -> accessible
    const ownCheck = await registry.execute(
      TOOL_IDS.CHECK_MY_REQUEST_STATUS,
      { trackingNumber: "SR-2026-000001" },
      user1
    );
    assert.ok(ownCheck.answer.includes("SR-2026-000001"));
    assert.ok(ownCheck.answer.includes("Ready for pickup"));

    // Case B: User 202 checks User 101's tracking number -> UNAUTHORIZED / NOT DISCLOSED
    const crossCheck = await registry.execute(
      TOOL_IDS.CHECK_MY_REQUEST_STATUS,
      { trackingNumber: "SR-2026-000001" },
      user2
    );
    assert.ok(!crossCheck.answer.includes("Ready for pickup"), "Must not disclose status of another user's request");
    assert.ok(crossCheck.answer.includes("couldn't find") || crossCheck.answer.includes("not find"));

    // Case C: Client tries to inject fake userId in parameters -> derived strictly from auth user
    const injectionCheck = await registry.execute(
      TOOL_IDS.CHECK_MY_REQUEST_STATUS,
      { trackingNumber: "SR-2026-000001", userId: 101 },
      user2 // Authenticated user is 202!
    );
    assert.ok(!injectionCheck.answer.includes("Ready for pickup"));

    // Case D: Unauthenticated request to private tool -> asks user to sign in
    const unauthCheck = await registry.execute(
      TOOL_IDS.CHECK_MY_REQUEST_STATUS,
      { trackingNumber: "SR-2026-000001" },
      null // No authenticated principal!
    );
    assert.ok(unauthCheck.answer.includes("sign in") || unauthCheck.answer.includes("account"));
  });

  // -------------------------------------------------------------
  // Section 7: Ambiguous Private Data (Multiple Owned Records)
  // -------------------------------------------------------------
  await t.test("7. Ambiguous requests return safe list of owned items rather than picking one arbitrarily", async () => {
    const userWithMultiple = { id: 303 };

    const mockRequestRepo = {
      findByTrackingNumber: async () => null,
      findMany: async ({ userId }) => {
        if (userId === 303) {
          return {
            data: [
              {
                id: "req-1",
                trackingNumber: "SR-2026-000001",
                documentType: "BAPTISMAL_CERTIFICATE",
                status: "READY_FOR_PICKUP",
                parish: { parishName: "St. Jude" },
              },
              {
                id: "req-2",
                trackingNumber: "SR-2026-000002",
                documentType: "MARRIAGE_CERTIFICATE",
                status: "PROCESSING",
                parish: { parishName: "Cathedral" },
              },
            ],
            total: 2,
          };
        }
        return { data: [], total: 0 };
      },
    };

    const registry = new LiveToolRegistry({ requestRepository: mockRequestRepo });

    const ambiguousCheck = await registry.execute(
      TOOL_IDS.CHECK_MY_REQUEST_STATUS,
      {}, // No tracking number specified
      userWithMultiple
    );

    // Must list both tracking numbers so user can clarify
    assert.ok(ambiguousCheck.answer.includes("SR-2026-000001"));
    assert.ok(ambiguousCheck.answer.includes("SR-2026-000002"));
    assert.ok(ambiguousCheck.answer.includes("recent document requests"));
  });

  // -------------------------------------------------------------
  // Section 8: Multi-Step Structured Clarification
  // -------------------------------------------------------------
  await t.test("8. Multi-Step clarification collects parameters step-by-step without question repetition", () => {
    const router = new LiveToolRouter();

    // Step 1: User asks "How much is the certificate?" (missing document type AND parish)
    const step1 = router.route({ question: "How much is the certificate?" });
    assert.ok(step1);
    assert.equal(step1.toolId, TOOL_IDS.GET_DOCUMENT_FEE);
    assert.equal(step1.nextRequired, "DOCUMENT_TYPE");
    assert.ok(step1.structuredClarification);

    // Step 2: User selects BAPTISMAL_CERTIFICATE -> now needs PARISH
    const step2 = router.route({
      question: "Baptismal Certificate",
      structuredClarification: {
        originalQuestion: "How much is the certificate?",
        toolId: TOOL_IDS.GET_DOCUMENT_FEE,
        collected: { documentType: "BAPTISMAL_CERTIFICATE" },
      },
    });
    assert.ok(step2);
    assert.equal(step2.toolId, TOOL_IDS.GET_DOCUMENT_FEE);
    assert.equal(step2.nextRequired, "PARISH");

    // Step 3: User selects Parish 2 -> complete!
    const step3 = router.route({
      question: "Continue",
      selectedParishId: 2,
      structuredClarification: {
        originalQuestion: "How much is the certificate?",
        toolId: TOOL_IDS.GET_DOCUMENT_FEE,
        collected: { documentType: "BAPTISMAL_CERTIFICATE", parishId: 2 },
      },
    });
    assert.ok(step3);
    assert.equal(step3.toolId, TOOL_IDS.GET_DOCUMENT_FEE);
    assert.equal(step3.isComplete, true);
    assert.equal(step3.parameters.documentType, "BAPTISMAL_CERTIFICATE");
    assert.equal(step3.parameters.parishId, 2);
  });

  // -------------------------------------------------------------
  // Section 9: ChatbotService Hybrid Pipeline & Zero-Gemini Guarantees
  // -------------------------------------------------------------
  await t.test("9. Hybrid pipeline invokes ZERO Gemini calls for Social, Clarifications, and Live Tools", async () => {
    let embeddingCalls = 0;
    let generationCalls = 0;

    const fakeChatProvider = {
      providerName: "gemini",
      modelName: "gemini-3.5-flash-lite",
      generateGroundedAnswer: async () => {
        generationCalls++;
        return { answer: "RAG Answer", citedChunkIds: [1] };
      },
    };

    const fakeRetrievalService = {
      retrieveKnowledge: async () => {
        embeddingCalls++;
        return {
          candidates: [{ chunkId: 1, title: "Verified Guide", content: "Procedural RAG content", semanticScore: 0.9 }],
          hasSufficientEvidence: true,
          category: "PROCEDURE",
          embeddingProvider: "gemini",
          embeddingModel: "gemini-embedding-2",
        };
      },
    };

    const quotaTracker = new AiQuotaTracker({ tenMinuteMax: 20, dailyMax: 50 });

    const fakePrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
          officeHours: "Mon-Sat 8am-5pm",
          contactNumber: "09171112233",
          email: "office@stjoseph.ph",
          address: "100 Church St",
        }),
      },
    };

    const chatbotService = new ChatbotService({
      retrievalService: fakeRetrievalService,
      chatProvider: fakeChatProvider,
      prismaClient: fakePrisma,
      logRepository: { logQuery: async () => {} },
      aiQuotaTracker: quotaTracker,
      isEnabled: true,
    });

    // Test A: Greeting (Social)
    const socialRes = await chatbotService.answerQuestion({
      question: "Hello Caloy!",
    });
    assert.equal(socialRes.responseType, "SOCIAL");
    assert.equal(embeddingCalls, 0, "Social must make 0 embedding calls");
    assert.equal(generationCalls, 0, "Social must make 0 generation calls");

    // Test B: Capabilities (Social)
    const capRes = await chatbotService.answerQuestion({
      question: "What questions can you answer?",
    });
    assert.equal(capRes.responseType, "SOCIAL");
    assert.equal(embeddingCalls, 0, "Capabilities must make 0 embedding calls");
    assert.equal(generationCalls, 0, "Capabilities must make 0 generation calls");

    // Test C: Live Tool (Parish Office Info)
    const liveRes = await chatbotService.answerQuestion({
      question: "What are the office hours?",
      selectedParishId: 1,
    });
    assert.equal(liveRes.responseType, "LIVE_DATA");
    assert.ok(liveRes.liveData);
    assert.ok(liveRes.answer.includes("Mon-Sat 8am-5pm"));
    assert.equal(embeddingCalls, 0, "Live Tool must make 0 embedding calls");
    assert.equal(generationCalls, 0, "Live Tool must make 0 generation calls");

    // Test D: Clarification (Parish required for fee)
    const clarifyRes = await chatbotService.answerQuestion({
      question: "How much is a baptismal certificate?",
      // no selectedParishId
    });
    assert.equal(clarifyRes.responseType, "CLARIFICATION");
    assert.equal(clarifyRes.clarificationType, "PARISH");
    assert.equal(embeddingCalls, 0, "Clarification must make 0 embedding calls");
    assert.equal(generationCalls, 0, "Clarification must make 0 generation calls");
  });

  // -------------------------------------------------------------
  // Section 10: Two-Tier Rate Limiting & Provider 429 Mapping
  // -------------------------------------------------------------
  await t.test("10. Rate limiting preserves zero-cost paths and maps provider 429 cleanly", async () => {
    const quotaTracker = new AiQuotaTracker({ tenMinuteMax: 2, dailyMax: 5 });
    const userKey = 888;

    // Zero-cost operations do not touch quota
    assert.equal(quotaTracker.isLimitExceeded(userKey), false);

    // Consume 2 AI quota tokens
    quotaTracker.consume(userKey);
    quotaTracker.consume(userKey);

    // 3rd attempt is exceeded
    assert.equal(quotaTracker.isLimitExceeded(userKey), true);

    const fakePrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
          officeHours: "Mon-Sat 8am-5pm",
        }),
      },
    };

    const chatbotService = new ChatbotService({
      prismaClient: fakePrisma,
      logRepository: { logQuery: async () => {} },
      aiQuotaTracker: quotaTracker,
      isEnabled: true,
    });

    // Zero-cost paths (trivial greetings) STILL WORK even when AI quota is exhausted!
    const greetingWhenAiExhausted = await chatbotService.answerQuestion({
      question: "Hello Caloy!",
      userId: 888,
    });
    assert.equal(greetingWhenAiExhausted.responseType, "SOCIAL");

    // Substantive queries that invoke the semantic router throw CHATBOT_AI_LIMIT_REACHED
    await assert.rejects(
      async () => {
        await chatbotService.answerQuestion({
          question: "What are the office hours?",
          selectedParishId: 1,
          userId: 888,
        });
      },
      (err) => {
        assert.equal(err.code, "CHATBOT_AI_LIMIT_REACHED");
        return true;
      }
    );

    // Substantive RAG attempt also throws CHATBOT_AI_LIMIT_REACHED
    await assert.rejects(
      async () => {
        await chatbotService.answerQuestion({
          question: "How does baptism certificate request work?",
          userId: 888,
        });
      },
      (err) => {
        assert.equal(err.code, "CHATBOT_AI_LIMIT_REACHED");
        return true;
      }
    );

    // Provider 429 error mapping test
    const mockProvider429 = {
      providerName: "gemini",
      modelName: "gemini-3.5-flash-lite",
      generateGroundedAnswer: async () => {
        const err = new Error("Resource has been exhausted (e.g. check quota)");
        err.status = 429;
        throw err;
      },
    };

    const mockRetrieval = {
      retrieveKnowledge: async () => ({
        candidates: [{ chunkId: 1, title: "Guide", content: "Some guide content", semanticScore: 0.85 }],
        hasSufficientEvidence: true,
        category: "POLICY",
        embeddingProvider: "gemini",
        embeddingModel: "gemini-embedding-2",
      }),
    };

    const quotaTrackerFresh = new AiQuotaTracker({ tenMinuteMax: 20, dailyMax: 50 });
    const serviceWith429 = new ChatbotService({
      retrievalService: mockRetrieval,
      chatProvider: mockProvider429,
      logRepository: { logQuery: async () => {} },
      aiQuotaTracker: quotaTrackerFresh,
      isEnabled: true,
      prismaClient: fakePrisma,
    });

    await assert.rejects(
      async () => {
        await serviceWith429.answerQuestion({
          question: "How does baptism certificate request work?",
          userId: 999,
        });
      },
      (err) => {
        assert.equal(err.code, "AI_PROVIDER_RATE_LIMITED");
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Section 11: Stale Parish Storage on Greeting Edge Case
  // -------------------------------------------------------------
  await t.test("11. Stale or invalid parish in storage does NOT block pure social greeting", async () => {
    const fakePrisma = {
      parish: {
        findUnique: async () => null, // Parish not found in DB (stale ID)
      },
    };

    const chatbotService = new ChatbotService({
      prismaClient: fakePrisma,
      logRepository: { logQuery: async () => {} },
      isEnabled: true,
    });

    const greetingResult = await chatbotService.answerQuestion({
      question: "Hello Caloy",
      selectedParishId: 999999, // Stale/invalid parish ID in sessionStorage
    });

    assert.equal(greetingResult.responseType, "SOCIAL");
    assert.ok(greetingResult.answer.toLowerCase().includes("caloy") || greetingResult.answer.toLowerCase().includes("testimonium"));
  });
});
