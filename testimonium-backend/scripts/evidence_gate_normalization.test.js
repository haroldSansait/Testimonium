import test from "node:test";
import assert from "node:assert/strict";
import { chatbotQuerySchema } from "../validators/chatbotSchemas.js";
import { RetrievalService } from "../services/RetrievalService.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { FakeEmbeddingProvider } from "../services/ai/FakeEmbeddingProvider.js";
import { FakeChatCompletionProvider } from "../services/ai/FakeChatCompletionProvider.js";

// ============================================================================
// 1. QUESTION NORMALIZATION & VALIDATION
// ============================================================================

test("Chatbot Normalization & Schema Validation Suite", async (t) => {
  await t.test("empty string is rejected", () => {
    assert.throws(
      () => chatbotQuerySchema.parse({ question: "" }),
      (err) => {
        assert.ok(err);
        return true;
      }
    );
  });

  await t.test("spaces-only string is rejected after normalization", () => {
    assert.throws(
      () => chatbotQuerySchema.parse({ question: "     \t\t   \n\r  " }),
      (err) => {
        assert.ok(err);
        return true;
      }
    );
  });

  await t.test("control-only characters are stripped, then rejected as empty", () => {
    assert.throws(
      () => chatbotQuerySchema.parse({ question: "\x00\x08\x0B\x0C\x0E\x1F" }),
      (err) => {
        assert.ok(err);
        return true;
      }
    );
  });

  await t.test("preserves Unicode and multilingual Filipino characters", () => {
    const unicodeInput = "  Paano po ba kumuha ng sertipiko ng binyag para sa kasal sa Parokya ng San José? \u{1F64F}  ";
    const parsed = chatbotQuerySchema.parse({ question: unicodeInput });
    assert.equal(
      parsed.question,
      "Paano po ba kumuha ng sertipiko ng binyag para sa kasal sa Parokya ng San José? \u{1F64F}"
    );
  });

  await t.test("normalizes large surrounding and collapsing internal whitespace", () => {
    const padded = "\n\n   Ano   ang    mga     kailangan?   \t\t\n";
    const parsed = chatbotQuerySchema.parse({ question: padded });
    assert.equal(parsed.question, "Ano ang mga kailangan?");
  });

  await t.test("exactly 1000 normalized characters passes", () => {
    const exact1000 = "a".repeat(1000);
    const parsed = chatbotQuerySchema.parse({ question: exact1000 });
    assert.equal(parsed.question.length, 1000);
  });

  await t.test("1001 normalized characters is rejected", () => {
    const over1000 = "a".repeat(1001);
    assert.throws(
      () => chatbotQuerySchema.parse({ question: over1000 }),
      (err) => {
        assert.ok(err);
        return true;
      }
    );
  });
});

// ============================================================================
// 2. EVIDENCE PIPELINE ORDER & SCORE SEPARATION
// ============================================================================

test("Evidence Pipeline: Semantic vs Lexical Score & Context Selection", async (t) => {
  const retrieval = new RetrievalService();

  await t.test("regression: must not approve on chunk A and supply only chunk B", () => {
    // Candidate A: high semantic score 0.70, no lexical boost -> semantic 0.70, ranking 0.70
    // Candidate B: low semantic score 0.60, high lexical boost +0.15 -> semantic 0.60, ranking 0.75
    // Threshold: 0.65
    const candidates = [
      {
        id: 1,
        sourceId: 10,
        title: "Canonical Sacramental Guide",
        content: "Official procedure for baptism registration in diocese.",
        scope: "DIOCESE",
        parishId: null,
        semanticScore: 0.70,
        rankingScore: 0.70,
      },
      {
        id: 2,
        sourceId: 20,
        title: "Parish Office Schedule",
        content: "Parish office hours for certificate pickup baptism schedule.",
        scope: "PARISH",
        parishId: 5,
        semanticScore: 0.60, // Below 0.65 threshold!
        rankingScore: 0.75, // Higher ranking due to keyword boost!
      },
    ];

    const finalContext = retrieval.selectFinalContext(candidates, {
      selectedParishId: 5,
      maxChunks: 2,
      maxTokens: 3500,
      minSemanticScore: 0.65,
    });

    // Final context MUST include Candidate A because it is the semantically qualifying chunk!
    const includedIds = finalContext.map((c) => c.id);
    assert.ok(includedIds.includes(1), "Top semantically qualifying chunk A must be preserved in final context");

    // The evidence sufficiency check on final context MUST pass because A is included
    const isSufficient = retrieval.evaluateEvidenceSufficiency(finalContext, 0.65);
    assert.equal(isSufficient, true, "Final context containing candidate A must be sufficient");
  });

  await t.test("sub-threshold only candidates evaluate to insufficient", () => {
    const subThreshold = [
      {
        id: 3,
        sourceId: 30,
        title: "Irrelevant Document",
        content: "Some unrelated procedure.",
        scope: "DIOCESE",
        parishId: null,
        semanticScore: 0.55,
        rankingScore: 0.62,
      },
    ];

    const isSufficient = retrieval.evaluateEvidenceSufficiency(subThreshold, 0.65);
    assert.equal(isSufficient, false);
  });
});

// ============================================================================
// 3. CONTEXT TOKEN BUDGET & DELIMITER INTEGRITY
// ============================================================================

test("Evidence Pipeline: Context Token Budget & Complete Chunks", async (t) => {
  const retrieval = new RetrievalService();

  await t.test("enforces maxContextTokens budget without partial text truncation", () => {
    // Generate chunks of ~500 tokens each (~2000 chars)
    const longChunks = [
      { id: 10, sourceId: 1, title: "Title 1", content: "A".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.85, rankingScore: 0.85 },
      { id: 11, sourceId: 1, title: "Title 2", content: "B".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.82, rankingScore: 0.82 },
      { id: 12, sourceId: 1, title: "Title 3", content: "C".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.80, rankingScore: 0.80 },
      { id: 13, sourceId: 1, title: "Title 4", content: "D".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.78, rankingScore: 0.78 },
      { id: 14, sourceId: 1, title: "Title 5", content: "E".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.75, rankingScore: 0.75 },
      { id: 15, sourceId: 1, title: "Title 6", content: "F".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.70, rankingScore: 0.70 },
      { id: 16, sourceId: 1, title: "Title 7", content: "G".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.68, rankingScore: 0.68 },
      { id: 17, sourceId: 1, title: "Title 8", content: "H".repeat(1800), scope: "DIOCESE", parishId: null, semanticScore: 0.66, rankingScore: 0.66 },
    ];

    // Budget: 1200 tokens (approx 2 chunks max)
    const finalContext = retrieval.selectFinalContext(longChunks, {
      selectedParishId: null,
      maxChunks: 10,
      maxTokens: 1200,
      minSemanticScore: 0.65,
    });

    assert.ok(finalContext.length <= 3, `Expected at most 3 chunks within 1200 token budget, got ${finalContext.length}`);
    // Check that chunk texts were not severed in half
    for (const chunk of finalContext) {
      assert.equal(chunk.content.length, 1800, "Chunks must remain complete to preserve citation attribution");
    }
  });
});

// ============================================================================
// 4. TENANCY & CONFLICT SAFEGUARDS
// ============================================================================

test("Evidence Pipeline: Scope Tenancy & Conflict Safeguards", async (t) => {
  const retrieval = new RetrievalService();

  await t.test("DIOCESE + selected PARISH is allowed by design", () => {
    const candidates = [
      { id: 1, sourceId: 1, title: "Diocesan Norm", content: "Diocese rules", scope: "DIOCESE", parishId: null, semanticScore: 0.75, rankingScore: 0.75 },
      { id: 2, sourceId: 2, title: "Parish 5 Schedule", content: "Parish 5 fees", scope: "PARISH", parishId: 5, semanticScore: 0.72, rankingScore: 0.72 },
    ];

    const result = retrieval.selectFinalContext(candidates, {
      selectedParishId: 5,
      maxChunks: 5,
      maxTokens: 3500,
      minSemanticScore: 0.65,
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].scope, "DIOCESE");
    assert.equal(result[1].scope, "PARISH");
    assert.equal(result[1].parishId, 5);
  });

  await t.test("cross-parish chunks are rejected (parish 3 when parish 2 selected)", () => {
    const candidates = [
      { id: 1, sourceId: 1, title: "Parish 3 Rule", content: "Parish 3 text", scope: "PARISH", parishId: 3, semanticScore: 0.85, rankingScore: 0.85 },
    ];

    const result = retrieval.selectFinalContext(candidates, {
      selectedParishId: 2, // Selected parish 2!
      maxChunks: 5,
      maxTokens: 3500,
      minSemanticScore: 0.65,
    });

    // Chunk for parish 3 must be excluded when parish 2 is selected
    assert.equal(result.length, 0);
  });

  await t.test("parish chunk excluded when NO parish is selected", () => {
    const candidates = [
      { id: 1, sourceId: 1, title: "Parish 2 Rule", content: "Parish 2 text", scope: "PARISH", parishId: 2, semanticScore: 0.85, rankingScore: 0.85 },
      { id: 2, sourceId: 2, title: "Diocese Rule", content: "Diocese text", scope: "DIOCESE", parishId: null, semanticScore: 0.80, rankingScore: 0.80 },
    ];

    const result = retrieval.selectFinalContext(candidates, {
      selectedParishId: null, // No parish selected
      maxChunks: 5,
      maxTokens: 3500,
      minSemanticScore: 0.65,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 2);
    assert.equal(result[0].scope, "DIOCESE");
  });
});

// ============================================================================
// 5. SERVICE-LEVEL CITATION VALIDATION
// ============================================================================

test("ChatbotService: Service-Level Citation Invariant", async (t) => {
  await t.test("discards answers with empty or missing citations, returning deterministic fallback", async () => {
    const fakeEmbedding = new FakeEmbeddingProvider();
    const fakeChat = new FakeChatCompletionProvider();

    // Configure fake chat to return an answer without citations
    fakeChat.setMockAnswer("An unsupported answer about baptism.", []);

    const service = new ChatbotService({
      isEnabled: true,
      chatProvider: fakeChat,
      logRepository: { logQuery: async () => ({ id: 1 }) },
      prismaClient: {
        parish: { findUnique: async () => ({ id: 5, parishName: "San José", contactNumber: "123", isActive: true }) },
        chatbotLog: { create: async () => ({ id: 1 }) },
      },
    });

    // Mock retrieval to supply evidence
    service.retrievalService.retrieveKnowledge = async () => ({
      candidates: [
        { id: 101, sourceId: 1, title: "Baptism Guide", content: "Content", scope: "DIOCESE", parishId: null, semanticScore: 0.85, rankingScore: 0.85 },
      ],
      hasSufficientEvidence: true,
      topSemanticScore: 0.85,
      category: "BAPTISM",
      embeddingProvider: "fake",
      embeddingModel: "fake-model",
    });

    const res = await service.handleQuery({
      question: "How to get baptism cert?",
      selectedParishId: 5,
    });

    assert.equal(res.fallback, true);
    assert.equal(res.fallbackReason, "UNSUPPORTED_OR_MISSING_CITATIONS");
    assert.deepEqual(res.sources, []);
    assert.ok(res.answer.includes("San José"));
  });

  await t.test("discards answers citing chunks OUTSIDE final generation context", async () => {
    const fakeChat = new FakeChatCompletionProvider();

    // Fake chat cites chunk 999 which is not in final context [101]
    fakeChat.setMockAnswer("Grounded answer but fake citation.", [999]);

    const service = new ChatbotService({
      isEnabled: true,
      chatProvider: fakeChat,
      logRepository: { logQuery: async () => ({ id: 1 }) },
      prismaClient: {
        parish: { findUnique: async () => ({ id: 5, parishName: "San José", contactNumber: "123", isActive: true }) },
        chatbotLog: { create: async () => ({ id: 1 }) },
      },
    });

    service.retrievalService.retrieveKnowledge = async () => ({
      candidates: [
        { id: 101, sourceId: 1, title: "Baptism Guide", content: "Content", scope: "DIOCESE", parishId: null, semanticScore: 0.85, rankingScore: 0.85 },
      ],
      hasSufficientEvidence: true,
      topSemanticScore: 0.85,
      category: "BAPTISM",
      embeddingProvider: "fake",
      embeddingModel: "fake-model",
    });

    const res = await service.handleQuery({
      question: "How to get baptism cert?",
      selectedParishId: 5,
    });

    assert.equal(res.fallback, true);
    assert.equal(res.fallbackReason, "UNSUPPORTED_OR_MISSING_CITATIONS");
  });

  await t.test("preserves valid answer when citations match final context", async () => {
    const fakeChat = new FakeChatCompletionProvider();

    fakeChat.setMockAnswer("Verified baptism procedure from Diocesan guide.", [101]);

    const service = new ChatbotService({
      isEnabled: true,
      chatProvider: fakeChat,
      logRepository: { logQuery: async () => ({ id: 1 }) },
      prismaClient: {
        parish: { findUnique: async () => ({ id: 5, parishName: "San José", contactNumber: "123", isActive: true }) },
        chatbotLog: { create: async () => ({ id: 1 }) },
      },
    });

    service.retrievalService.retrieveKnowledge = async () => ({
      candidates: [
        { id: 101, sourceId: 1, title: "Baptism Guide", content: "Content", scope: "DIOCESE", parishId: null, semanticScore: 0.85, rankingScore: 0.85 },
      ],
      hasSufficientEvidence: true,
      topSemanticScore: 0.85,
      category: "BAPTISM",
      embeddingProvider: "fake",
      embeddingModel: "fake-model",
    });

    const res = await service.handleQuery({
      question: "How to get baptism cert?",
      selectedParishId: 5,
    });

    assert.equal(res.fallback, false);
    assert.equal(res.answer, "Verified baptism procedure from Diocesan guide.");
    assert.equal(res.sources.length, 1);
    assert.equal(res.sources[0].title, "Baptism Guide");
  });
});
