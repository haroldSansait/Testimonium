import test from "node:test";
import assert from "node:assert/strict";
import { extractCitationsAndSanitize, sanitizeCitationMarkers } from "../services/ai/citationUtils.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { FakeChatCompletionProvider } from "../services/ai/FakeChatCompletionProvider.js";
import { FakeSemanticRouter } from "../services/ai/FakeSemanticRouter.js";
import { LiveToolRegistry, resolveVicariateName } from "../services/ai/liveTools/LiveToolRegistry.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";

/**
 * Caloy QA Correctness Pass: Citation Sanitization, Vicariate Hierarchy, and Document Live-State Audit
 */
test("Caloy QA Correctness Test Suite", async (t) => {
  // =========================================================================
  // 1. Citation Sanitization & Leak Prevention Tests (Sections 6, 7, 27, 33)
  // =========================================================================

  await t.test("1.1 Single citation marker at sentence end is stripped cleanly without leftover spaces", () => {
    const raw = "Upload your proof [CITATIONS: 50].";
    const { cleanedAnswer, citedChunkIds } = extractCitationsAndSanitize(raw, [50]);

    assert.equal(cleanedAnswer, "Upload your proof.");
    assert.deepEqual(citedChunkIds, [50]);
  });

  await t.test("1.2 Multiple citation markers across paragraphs are stripped and IDs deduplicated", () => {
    const raw =
      "Proof is manually reviewed [CITATIONS: 19,20,54]. OCR does not approve payment [CITATIONS: 3,54].\n\n[CITATIONS: 19,20,3,54]";
    const validEvidence = [19, 20, 54, 3];
    const { cleanedAnswer, citedChunkIds } = extractCitationsAndSanitize(raw, validEvidence);

    assert.equal(
      cleanedAnswer,
      "Proof is manually reviewed. OCR does not approve payment."
    );
    // Preserves all unique cited chunk IDs in encounter order
    assert.deepEqual(citedChunkIds, [19, 20, 54, 3]);
  });

  await t.test("1.3 Normal brackets, Markdown links, parenthetical text, currency, and tracking numbers are preserved", () => {
    const raw =
      "For details, see [Parish Guidelines](https://example.com/guide). The document status is [PROCESSING] and the fee is ₱150.00 (payable via GCash). Your tracking number is TRK-2026-ABC12345.";
    const { cleanedAnswer, citedChunkIds } = extractCitationsAndSanitize(raw, []);

    assert.equal(cleanedAnswer, raw);
    assert.deepEqual(citedChunkIds, []);
  });

  await t.test("1.4 ChatbotService guarantees clean visible RAG answer and valid sources", async () => {
    const fakeChat = new FakeChatCompletionProvider();
    fakeChat.setMockAnswer("Payment verification is processed by parish staff [CITATIONS: 101, 102].", [101, 102]);

    const mockRetrieval = {
      retrieveKnowledge: async () => ({
        candidates: [
          { chunkId: 101, id: 101, sourceId: 1, title: "Diocesan Payment Policy", semanticScore: 0.88 },
          { chunkId: 102, id: 102, sourceId: 1, title: "Diocesan Payment Policy", semanticScore: 0.85 },
        ],
        hasSufficientEvidence: true,
        category: "PAYMENTS",
        embeddingProvider: "fake",
        embeddingModel: "fake-model",
      }),
    };

    const chatbot = new ChatbotService({
      retrievalService: mockRetrieval,
      chatProvider: fakeChat,
      semanticRouter: {
        interpret: async () => ({ route: "RAG", intent: null, entities: {} }),
      },
    });

    const result = await chatbot.handleQuery({
      question: "How do I verify my payments?",
    });

    assert.equal(result.responseType, "RAG");
    assert.equal(result.fallback, false);
    // Visible answer MUST NOT contain raw citation syntax
    assert.doesNotMatch(result.answer, /\[CITATIONS?:\s*[0-9,\s]+\]/i);
    assert.equal(result.answer, "Payment verification is processed by parish staff.");
    // Deduplication into unique source documents: chunks 101 & 102 map to 1 unique sourceId
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].title, "Diocesan Payment Policy");
  });

  await t.test("1.5 Unsupported/unapproved citation triggers standard invariant fallback", async () => {
    const fakeChat = new FakeChatCompletionProvider();
    // Model cites chunk 999 which was not provided in retrieval
    fakeChat.setMockAnswer("Some fabricated answer [CITATIONS: 999].", [999]);

    const mockRetrieval = {
      retrieveKnowledge: async () => ({
        candidates: [
          { chunkId: 101, id: 101, sourceId: 1, title: "Diocesan Policy", semanticScore: 0.88 },
        ],
        hasSufficientEvidence: true,
        category: "PAYMENTS",
        embeddingProvider: "fake",
        embeddingModel: "fake-model",
      }),
    };

    const chatbot = new ChatbotService({
      retrievalService: mockRetrieval,
      chatProvider: fakeChat,
      semanticRouter: {
        interpret: async () => ({ route: "RAG", intent: null, entities: {} }),
      },
    });

    const result = await chatbot.handleQuery({
      question: "Fabricated question",
    });

    assert.equal(result.fallback, true);
    assert.equal(result.fallbackReason, "UNSUPPORTED_OR_MISSING_CITATIONS");
    assert.deepEqual(result.sources, []);
  });

  // =========================================================================
  // 2. Vicariate Hierarchy Query & Counting (Sections 11, 15, 16, 17, 29)
  // =========================================================================

  await t.test("2.1 GET_VICARIATE_DIRECTORY: correct counting by type, active-only, inactive excluded (Section 29)", async () => {
    const mockPrisma = {
      parish: {
        findMany: async ({ where }) => {
          assert.equal(where.isActive, true, "Must strictly filter isActive: true");
          return [
            { id: 1, parishName: "St. John Parish", type: "PARISH", vicariate: "Vicariate A", municipalityCity: "City 1", province: "Province 1", isActive: true },
            { id: 2, parishName: "St. Peter Parish", type: "PARISH", vicariate: "Vicariate A", municipalityCity: "City 2", province: "Province 1", isActive: true },
            { id: 3, parishName: "Holy Cross Quasi-Parish", type: "QUASI_PARISH", vicariate: "Vicariate A", municipalityCity: "City 3", province: "Province 1", isActive: true },
            { id: 4, parishName: "St. Jude Inactive Parish", type: "PARISH", vicariate: "Vicariate A", municipalityCity: "City 4", province: "Province 1", isActive: false },
            { id: 5, parishName: "San Roque Mission Station", type: "MISSION_STATION", vicariate: "Vicariate A", municipalityCity: "City 5", province: "Province 1", isActive: true },
            { id: 6, parishName: "Other Vicariate Parish", type: "PARISH", vicariate: "Vicariate B", municipalityCity: "City 6", province: "Province 2", isActive: true },
          ];
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getVicariateDirectory({ vicariateName: "Vicariate A" });

    assert.equal(result.liveData.vicariate, "Vicariate A");
    assert.equal(result.liveData.total, 4, "Total active church units must be 4");
    assert.equal(result.liveData.counts.PARISH, 2, "Active parishes count must be 2");
    assert.equal(result.liveData.counts.QUASI_PARISH, 1, "Active quasi-parishes count must be 1");
    assert.equal(result.liveData.counts.MISSION_STATION, 1, "Active mission stations count must be 1");
    assert.equal(result.liveData.units.length, 4);

    // Inactive excluded
    assert.ok(!result.answer.includes("St. Jude Inactive Parish"), "Inactive parish must be excluded");
    // Other vicariate excluded
    assert.ok(!result.answer.includes("Other Vicariate Parish"), "Other vicariate parish must be excluded");

    // Natural breakdown in response text
    assert.ok(result.answer.includes("4 active church units"));
    assert.ok(result.answer.includes("2 Parishes"));
    assert.ok(result.answer.includes("1 Quasi-Parish"));
    assert.ok(result.answer.includes("1 Mission Station"));

    // No internal database IDs leaked in text
    assert.doesNotMatch(result.answer, /\b(id:\s*\d+|parish_id)\b/i);
    assert.equal(result.liveData.label, "Current TESTIMONIUM Data");
  });

  // =========================================================================
  // 3. Vicariate Entity Resolution (Section 14)
  // =========================================================================

  await t.test("3.1 Entity resolution matches variations of Vicariate name", () => {
    const known = ["Vicariate of Canlaon", "Vicariate of San Carlos"];

    assert.equal(resolveVicariateName("Canlaon", known), "Vicariate of Canlaon");
    assert.equal(resolveVicariateName("canlaon", known), "Vicariate of Canlaon");
    assert.equal(resolveVicariateName("Vicariate of Canlaon", known), "Vicariate of Canlaon");
    assert.equal(resolveVicariateName("Canlaon Vicariate", known), "Vicariate of Canlaon");
    assert.equal(resolveVicariateName("canlaon vicariate", known), "Vicariate of Canlaon");
    assert.equal(resolveVicariateName("San Carlos", known), "Vicariate of San Carlos");
    assert.equal(resolveVicariateName("Unknown Vicariate", known), null);
  });

  await t.test("3.2 Non-existent Vicariate returns safe clarification response with registered list", async () => {
    const mockPrisma = {
      parish: {
        findMany: async () => [
          { id: 1, parishName: "St. Joseph Parish", type: "PARISH", vicariate: "Vicariate of Canlaon", isActive: true },
        ],
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getVicariateDirectory({ vicariateName: "Vicariate of Manila" });

    assert.equal(result.fallback, true);
    assert.equal(result.fallbackReason, "INVALID_VICARIATE");
    assert.ok(result.answer.includes("couldn't find a Vicariate matching \"Vicariate of Manila\""));
    assert.ok(result.answer.includes("Vicariate of Canlaon"));
  });

  // =========================================================================
  // 4. Semantic Routing for Vicariate Queries (Section 13, 30)
  // =========================================================================

  await t.test("4.1 Conceptually different natural language queries route to GET_VICARIATE_DIRECTORY", () => {
    const fakeRouter = new FakeSemanticRouter();

    const vicariateQueries = [
      "How many parishes are in the Vicariate of Canlaon?",
      "Which churches belong to the Canlaon vicariate?",
      "Show me the member parishes of that vicariate.",
      "List all churches in the vicariate of canlaon",
      "How many church units are in Canlaon vicariate?",
    ];

    for (const query of vicariateQueries) {
      const result = fakeRouter._inferDefaultInterpretation(query);
      assert.equal(result.route, "LIVE_TOOL", `Query "${query}" must route to LIVE_TOOL`);
      assert.equal(result.intent, TOOL_IDS.GET_VICARIATE_DIRECTORY, `Query "${query}" must have intent GET_VICARIATE_DIRECTORY`);
    }
  });

  // =========================================================================
  // 5. Conversational Context Hierarchy Follow-up (Section 20, 31)
  // =========================================================================

  await t.test("5.1 Turn 1 vicariate directory -> Turn 2 'How many of those are parishes?' inherits vicariate context", async () => {
    const fakeRouter = new FakeSemanticRouter();
    const contextManager = new ConversationContextManager();

    // Turn 1
    const t1 = fakeRouter._inferDefaultInterpretation("Which churches belong to the Vicariate of Canlaon?");
    assert.equal(t1.intent, TOOL_IDS.GET_VICARIATE_DIRECTORY);
    assert.equal(t1.entities.vicariateName, "Vicariate of Canlaon");

    const sessionCtx = contextManager.updateContext("session-vic-1", {
      lastIntent: TOOL_IDS.GET_VICARIATE_DIRECTORY,
      lastVicariateName: "Vicariate of Canlaon",
      lastResponseType: "LIVE_DATA",
    });

    // Turn 2
    const t2 = fakeRouter._inferDefaultInterpretation("How many of those are parishes?", sessionCtx);
    assert.equal(t2.route, "LIVE_TOOL");
    assert.equal(t2.intent, TOOL_IDS.GET_VICARIATE_DIRECTORY);
    assert.equal(t2.entities.vicariateName, "Vicariate of Canlaon");
    assert.equal(t2.usesPreviousContext, true);
  });

  // =========================================================================
  // 6. General Directory Regression (Section 19, 32)
  // =========================================================================

  await t.test("6.1 General parish directory query preserves GET_ACTIVE_PARISHES", () => {
    const fakeRouter = new FakeSemanticRouter();

    const generalQueries = [
      "What parishes are present in TESTIMONIUM?",
      "What parishes are part of Testimonium?",
      "Can you show me all member parishes?",
    ];

    for (const query of generalQueries) {
      const result = fakeRouter._inferDefaultInterpretation(query);
      assert.equal(result.route, "LIVE_TOOL");
      assert.equal(result.intent, TOOL_IDS.GET_ACTIVE_PARISHES);
    }
  });

  // =========================================================================
  // 7. Targeted Document Live-State Audit (Section 24, 25)
  // =========================================================================

  await t.test("7.1 GET_DOCUMENT_REQUIREMENTS: distinct states A, B, D preserved", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 10) {
            // Offers only BAPTISMAL_CERTIFICATE
            return {
              id: 10,
              parishName: "Parish Ten",
              isActive: true,
              availableDocuments: ["BAPTISMAL_CERTIFICATE"],
              contactNumber: "09170000000",
              email: "ten@diocese.org",
            };
          }
          return null;
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });

    // State A: DOCUMENT_NOT_OFFERED
    const stateA = await registry.getDocumentRequirements({
      documentType: "MARRIAGE_CERTIFICATE",
      parishId: 10,
    });
    assert.equal(stateA.liveData.state, "DOCUMENT_NOT_OFFERED");
    assert.ok(stateA.answer.includes("does not currently offer"));

    // State D: DOCUMENT_OFFERED_WITH_DATA
    const stateD = await registry.getDocumentRequirements({
      documentType: "BAPTISMAL_CERTIFICATE",
      parishId: 10,
    });
    assert.equal(stateD.liveData.state, "DOCUMENT_OFFERED_WITH_DATA");
    assert.ok(stateD.answer.includes("Primary Requirements:"));
  });

  await t.test("7.2 GET_DOCUMENT_FEE: distinct states A, C, D preserved", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 20) {
            return {
              id: 20,
              parishName: "Parish Twenty",
              isActive: true,
              availableDocuments: ["BAPTISMAL_CERTIFICATE", "FIRST_COMMUNION_CERTIFICATE"],
              documentSettings: JSON.stringify({
                BAPTISMAL_CERTIFICATE: { price: 150 },
                FIRST_COMMUNION_CERTIFICATE: { price: null }, // no fee configured
              }),
              contactNumber: "09171111111",
              email: "twenty@diocese.org",
            };
          }
          return null;
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });

    // State A: DOCUMENT_NOT_OFFERED
    const stateA = await registry.getDocumentFee({
      documentType: "MARRIAGE_CERTIFICATE",
      parishId: 20,
    });
    assert.equal(stateA.liveData.state, "DOCUMENT_NOT_OFFERED");
    assert.ok(stateA.answer.includes("does not currently offer"));

    // State C: DOCUMENT_OFFERED_BUT_NO_FEE_CONFIGURED
    const stateC = await registry.getDocumentFee({
      documentType: "FIRST_COMMUNION_CERTIFICATE",
      parishId: 20,
    });
    assert.equal(stateC.liveData.state, "DOCUMENT_OFFERED_BUT_NO_FEE_CONFIGURED");
    assert.ok(stateC.answer.includes("don't have a current"));

    // State D: DOCUMENT_OFFERED_WITH_DATA
    const stateD = await registry.getDocumentFee({
      documentType: "BAPTISMAL_CERTIFICATE",
      parishId: 20,
    });
    assert.equal(stateD.liveData.state, "DOCUMENT_OFFERED_WITH_DATA");
    assert.ok(stateD.answer.includes("₱150.00"));
  });
});
