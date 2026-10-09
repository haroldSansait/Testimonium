import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  GeminiChatAdapter,
  parseGroundedGenerationResponse,
} from "../services/ai/GeminiChatAdapter.js";
import { CaloyResponseComposer } from "../services/ai/CaloyResponseComposer.js";
import { ChatbotService } from "../services/ChatbotService.js";

const OBSERVED_QUESTIONS = [
  "I'm requesting a baptismal certificate for my adult sister. Whose Government ID should I upload, mine or hers?",
  "I'm requesting my own baptismal certificate. Do I need an Authorization Letter and Government ID front and back?",
  "I'm a parent requesting my 10-year-old child's baptismal certificate. What documents do I need to upload?",
];

const RELATIONSHIP_EVIDENCE = [
  {
    id: 101,
    title: "Relationship evidence policy",
    content: "For Self requests, use the requester's existing verified profile Government ID.",
  },
  {
    id: 102,
    title: "Non-Self request evidence",
    content: "Every non-Self request requires a signed Authorization Letter and the registrant Government ID front and back.",
  },
];

function makeQueuedClient(outputs) {
  const calls = [];
  let index = 0;
  return {
    calls,
    models: {
      async generateContent(request) {
        calls.push(request);
        const output = outputs[index++];
        return { text: () => output };
      },
    },
  };
}

test("Caloy RAG: observed questions use one schema-bound call each and preserve English", async () => {
  const outputs = [
    { answer: "Upload your adult sister's Government ID front and back and a signed Authorization Letter.", citedChunkIds: [102], insufficientEvidence: false },
    { answer: "For your own request, use your existing verified profile Government ID.", citedChunkIds: [101], insufficientEvidence: false },
    { answer: "For a non-Self request, upload a signed Authorization Letter and the child's Government ID front and back.", citedChunkIds: [102], insufficientEvidence: false },
  ].map(JSON.stringify);
  const client = makeQueuedClient(outputs);
  const adapter = new GeminiChatAdapter({ apiKey: "offline-test", client, maxRetries: 0 });

  for (const question of OBSERVED_QUESTIONS) {
    const result = await adapter.generateGroundedAnswer({ question, evidence: RELATIONSHIP_EVIDENCE });
    assert.ok(result.answer);
    assert.equal(result.citationContractStatus, "STRUCTURED");
    assert.equal(result.invalidCitedChunkIds.length, 0);
  }

  assert.equal(client.calls.length, 3, "exactly one mocked generation call per question");
  for (const call of client.calls) {
    assert.equal(call.config.responseMimeType, "application/json");
    assert.deepEqual(call.config.responseJsonSchema.required, ["answer", "citedChunkIds", "insufficientEvidence"]);
    assert.match(call.config.systemInstruction, /CURRENT user message is the sole authority/i);
    assert.match(call.contents, /Evidence language never overrides the question/i);
  }
});

test("Caloy language mirroring: RAG retains Philippine languages, Taglish, and current-turn switching", async () => {
  const cases = [
    ["Ano ang kailangan kong i-upload?", "Kailangan mong i-upload ang mga kinakailangang dokumento."],
    ["Unsa ang kinahanglan nakong i-upload?", "Kinahanglan nimo i-upload ang mga dokumento."],
    ["Ano ang kinahanglan ko nga i-upload?", "Kinahanglan mo nga i-upload ang mga dokumento."],
    ["Ano yung documents na need kong i-upload?", "I-upload mo yung required documents para sa request."],
  ];
  const client = makeQueuedClient(cases.map(([, answer]) => JSON.stringify({
    answer,
    citedChunkIds: [102],
    insufficientEvidence: false,
  })));
  const adapter = new GeminiChatAdapter({ apiKey: "offline-test", client, maxRetries: 0 });

  for (const [question, expectedAnswer] of cases) {
    const result = await adapter.generateGroundedAnswer({ question, evidence: RELATIONSHIP_EVIDENCE });
    assert.equal(result.answer, expectedAnswer);
  }
  assert.equal(client.calls.length, cases.length);

  const switchingClient = makeQueuedClient([
    JSON.stringify({ answer: "Kailangan mo ang mga dokumento.", citedChunkIds: [102], insufficientEvidence: false }),
    JSON.stringify({ answer: "You need the required documents.", citedChunkIds: [102], insufficientEvidence: false }),
  ]);
  const switchingAdapter = new GeminiChatAdapter({ apiKey: "offline-test", client: switchingClient, maxRetries: 0 });
  await switchingAdapter.generateGroundedAnswer({ question: "Ano ang kailangan ko?", evidence: RELATIONSHIP_EVIDENCE });
  const englishTurn = await switchingAdapter.generateGroundedAnswer({
    question: "What do I need for the request?",
    evidence: [{ ...RELATIONSHIP_EVIDENCE[1], content: "Kailangan ang Authorization Letter at Government ID." }],
  });
  assert.equal(englishTurn.answer, "You need the required documents.");
  assert.equal(switchingClient.calls.length, 2);
});

test("Caloy language mirroring: clearly English current messages reject clearly local-language output without a retry", async () => {
  const localLanguageOutput = JSON.stringify({
      answer: "Ang kailangan mong i-upload ay ang mga dokumento para sa kahilingan.",
      citedChunkIds: [102],
      insufficientEvidence: false,
    });
  const client = makeQueuedClient(OBSERVED_QUESTIONS.map(() => localLanguageOutput));
  const adapter = new GeminiChatAdapter({ apiKey: "offline-test", client, maxRetries: 0 });

  for (const question of OBSERVED_QUESTIONS) {
    const result = await adapter.generateGroundedAnswer({ question, evidence: RELATIONSHIP_EVIDENCE });
    assert.equal(result.answer, "");
    assert.equal(result.citationContractStatus, "CURRENT_MESSAGE_LANGUAGE_MISMATCH");
  }
  assert.equal(client.calls.length, OBSERVED_QUESTIONS.length);
});

test("Caloy composer: current message overrides prior context and approved-data language", async () => {
  const client = makeQueuedClient([
    JSON.stringify({ answer: "Use the verified requirements shown for this request.", followUp: null }),
    JSON.stringify({ answer: "Ang kailangan mo ay ang mga dokumentong ito.", followUp: null }),
  ]);
  const composer = new CaloyResponseComposer({ client });
  const common = {
    responseType: "LIVE_DATA",
    structuredFacts: { publicNote: "Kailangan ang mga dokumento." },
    conversationContext: { turnCount: 2, lastIntent: "GET_DOCUMENT_REQUIREMENTS" },
    userMessage: "What documents do I need for this request?",
    fallbackAnswer: "Use the verified requirements shown for this request.",
  };

  const accepted = await composer.compose(common);
  assert.equal(accepted.composed, true);
  assert.match(client.calls[0].config.systemInstruction, /CURRENT user message is the sole authority/i);
  assert.match(client.calls[0].contents, /CURRENT <USER_MESSAGE> is the sole authority/i);

  const rejected = await composer.compose(common);
  assert.equal(rejected.composed, false);
  assert.equal(rejected.fallbackReason, "CURRENT_MESSAGE_LANGUAGE_MISMATCH");
  assert.equal(rejected.answer, common.fallbackAnswer);
  assert.equal(client.calls.length, 2, "composer never retries language correction");
});

test("Caloy citation parser: structured, multiple, legacy, malformed, missing, and invented IDs", () => {
  const allowed = new Set([101, 102]);

  const single = parseGroundedGenerationResponse(JSON.stringify({
    answer: "Supported answer.", citedChunkIds: [101], insufficientEvidence: false,
  }), allowed);
  assert.deepEqual(single.citedChunkIds, [101]);
  assert.equal(single.citationContractStatus, "STRUCTURED");

  const multiple = parseGroundedGenerationResponse(JSON.stringify({
    answer: "Supported by both passages.", citedChunkIds: [101, 102], insufficientEvidence: false,
  }), allowed);
  assert.deepEqual(multiple.citedChunkIds, [101, 102]);

  for (const legacyText of [
    "Legacy answer. [CITATIONS: 101, 102]",
    "Legacy answer. [CITATION: 101]",
    "Legacy answer. [CHUNKS: 101, 102]",
  ]) {
    const legacy = parseGroundedGenerationResponse(legacyText, allowed);
    assert.equal(legacy.answer, "Legacy answer.");
    assert.equal(legacy.citationContractStatus, "LEGACY");
  }

  const malformedJson = parseGroundedGenerationResponse('{"answer":"unsafe",', allowed);
  assert.equal(malformedJson.answer, "");
  assert.equal(malformedJson.citationContractStatus, "MALFORMED_STRUCTURED_OUTPUT");

  const malformedLegacy = parseGroundedGenerationResponse("Potential answer. [CITATIONS: nope]", allowed);
  assert.equal(malformedLegacy.answer, "Potential answer.");
  assert.equal(malformedLegacy.citationContractStatus, "MISSING_CITATIONS");

  const missing = parseGroundedGenerationResponse("Uncited answer.", allowed);
  assert.deepEqual(missing.citedChunkIds, []);
  assert.equal(missing.citationContractStatus, "MISSING_CITATIONS");

  const invented = parseGroundedGenerationResponse(JSON.stringify({
    answer: "Answer with unsupported metadata [CITATIONS: 999].",
    citedChunkIds: [101, 999],
    insufficientEvidence: false,
    internal: "must not leak",
  }), allowed);
  assert.equal(invented.answer, "Answer with unsupported metadata.");
  assert.deepEqual(invented.citedChunkIds, [101, 999]);
  assert.deepEqual(invented.invalidCitedChunkIds, [999]);

  const insufficient = parseGroundedGenerationResponse(JSON.stringify({
    answer: "ignored", citedChunkIds: [], insufficientEvidence: true,
  }), allowed);
  assert.equal(insufficient.answer, "");
  assert.equal(insufficient.citationContractStatus, "INSUFFICIENT_EVIDENCE");
});

function makeRagService(providerResult) {
  const calls = [];
  const logs = [];
  const chatProvider = {
    providerName: "fake",
    modelName: "offline-contract-test",
    async generateGroundedAnswer(args) {
      calls.push(args);
      return providerResult;
    },
  };
  const retrievalService = {
    async retrieveKnowledge() {
      return {
        candidates: RELATIONSHIP_EVIDENCE.map((item, index) => ({
          chunkId: item.id,
          sourceId: index + 1,
          title: item.title,
          content: item.content,
          sourceType: "SYSTEM_GUIDE",
          sourceReference: `policy-${index + 1}`,
          authority: "CONFIRMED",
          scope: "DIOCESE",
          parishId: null,
          semanticScore: 0.83 - index * 0.01,
          rankingScore: 0.83 - index * 0.01,
        })),
        hasSufficientEvidence: true,
        category: "CERTIFICATES",
        embeddingProvider: "fake",
        embeddingModel: "offline",
      };
    },
  };
  const semanticRouter = {
    async interpret() {
      return { route: "RAG", intent: null, entities: {}, usesPreviousContext: false };
    },
  };
  const service = new ChatbotService({
    retrievalService,
    logRepository: { async logQuery(data) { logs.push(data); } },
    chatProvider,
    prismaClient: { parish: { async findUnique() { return null; } } },
    isEnabled: true,
    semanticRouter,
    aiQuotaTracker: null,
    runtimeConfigService: {
      async getEffectiveConfigSnapshot() {
        return { effectiveEnabled: true, generationModel: "offline-contract-test", chatbotRequestDeadlineMs: 5000 };
      },
    },
  });
  return { service, calls, logs };
}

test("Caloy service: Verified Sources remain correct and unsupported IDs fail safely", async () => {
  const supported = makeRagService({
    answer: "The supported relationship-evidence answer.",
    citedChunkIds: [102],
    invalidCitedChunkIds: [],
    citationContractStatus: "STRUCTURED",
  });
  const success = await supported.service.handleQuery({ question: OBSERVED_QUESTIONS[0], sessionId: crypto.randomUUID() });
  assert.equal(success.fallback, false);
  assert.equal(success.answer, "The supported relationship-evidence answer.");
  assert.deepEqual(success.sources.map((source) => source.id), [2]);
  assert.equal(success.sources[0].title, "Non-Self request evidence");
  assert.equal(success.sources[0].sourceReference, "policy-2");
  assert.equal(supported.calls.length, 1);

  const unsupported = makeRagService({
    answer: "An answer with an invented citation.",
    citedChunkIds: [102, 999],
    invalidCitedChunkIds: [999],
    citationContractStatus: "STRUCTURED",
  });
  const rejected = await unsupported.service.handleQuery({ question: OBSERVED_QUESTIONS[1], sessionId: crypto.randomUUID() });
  assert.equal(rejected.fallback, true);
  assert.equal(rejected.fallbackReason, "UNSUPPORTED_OR_MISSING_CITATIONS");
  assert.deepEqual(rejected.sources, []);
  assert.equal(unsupported.calls.length, 1);
});

test("Caloy service: malformed citation contract is distinct from insufficient evidence", async () => {
  const malformed = makeRagService({
    answer: "",
    citedChunkIds: [],
    invalidCitedChunkIds: [],
    citationContractStatus: "MALFORMED_STRUCTURED_OUTPUT",
  });
  const malformedResult = await malformed.service.handleQuery({ question: OBSERVED_QUESTIONS[0], sessionId: crypto.randomUUID() });
  assert.equal(malformedResult.fallbackReason, "RAG_CITATION_CONTRACT_INVALID");

  const insufficient = makeRagService({
    answer: "",
    citedChunkIds: [],
    invalidCitedChunkIds: [],
    citationContractStatus: "INSUFFICIENT_EVIDENCE",
  });
  const insufficientResult = await insufficient.service.handleQuery({ question: OBSERVED_QUESTIONS[0], sessionId: crypto.randomUUID() });
  assert.equal(insufficientResult.fallbackReason, "INSUFFICIENT_EVIDENCE");
  assert.equal(malformed.calls.length, 1);
  assert.equal(insufficient.calls.length, 1);
});
