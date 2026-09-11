import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectSocialIntent } from "../services/ai/socialIntentClassifier.js";
import { detectClarificationNeeded } from "../services/ai/clarificationDetector.js";
import { ChatbotService } from "../services/ChatbotService.js";

describe("CP6 Physical QA Targeted Improvements - Backend Suite", () => {
  describe("Social Intent Classifier (Zero API Calls)", () => {
    it("classifies simple greetings accurately", () => {
      const inputs = ["hello", "hello caloy", "Hi", "hey caloy", "Good morning", "good afternoon!"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "GREETING");
        assert.ok(res.answer.includes("Caloy") || res.answer.includes("TESTIMONIUM"));
      }
    });

    it("classifies gratitude accurately", () => {
      const inputs = ["thanks", "thank you", "thanks caloy!", "thank you very much"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "THANKS");
      }
    });

    it("classifies goodbye accurately", () => {
      const inputs = ["bye", "goodbye caloy", "bye bye", "see you later"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "GOODBYE");
      }
    });

    it("classifies how_are_you accurately", () => {
      const inputs = ["how are you?", "how are you caloy", "how r u?"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "HOW_ARE_YOU");
      }
    });

    it("classifies identity (who are you) accurately", () => {
      const inputs = ["who are you?", "who are you caloy", "what is your name?"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "WHO_ARE_YOU");
      }
    });

    it("classifies capabilities (what can you do) accurately", () => {
      const inputs = ["what can you do?", "what can you do caloy", "help me", "how can you help me?"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected social intent for: ${q}`);
        assert.equal(res.intent, "CAPABILITIES");
      }
    });

    it("redirects out of scope casual requests politely", () => {
      const inputs = ["write me a love poem", "tell me a joke", "who is the president?"];
      for (const q of inputs) {
        const res = detectSocialIntent(q);
        assert.ok(res, `Expected out-of-scope intent for: ${q}`);
        assert.equal(res.intent, "OUT_OF_SCOPE_CASUAL");
        assert.ok(res.answer.includes("TESTIMONIUM"));
      }
    });

    it("DOES NOT classify substantive questions with greetings as social-only", () => {
      const substantiveQueries = [
        "Hi Caloy, how do I request a baptism certificate?",
        "Hello Caloy, can I request a certificate for my brother?",
        "Good morning, what documents can I request?",
        "Hi, is my GCash payment verified automatically?",
        "Hello, what time does the parish office close?",
      ];
      for (const q of substantiveQueries) {
        const res = detectSocialIntent(q);
        assert.equal(res, null, `Substantive question "${q}" should NOT be trapped as social`);
      }
    });
  });

  describe("Clarification Detector (Zero API Calls)", () => {
    it("detects parish clarification needed when no parish is selected", () => {
      const parishQuestions = [
        "How much is a baptismal certificate?",
        "How much does a marriage certificate cost?",
        "What are the office hours?",
        "What time does the parish office close?",
        "What are the fees for confirmation certificate?",
      ];
      for (const q of parishQuestions) {
        const res = detectClarificationNeeded(q, null);
        assert.ok(res, `Expected parish clarification for: ${q}`);
        assert.equal(res.clarificationType, "PARISH");
        assert.ok(res.answer.toLowerCase().includes("parish"));
      }
    });

    it("DOES NOT trigger parish clarification when a parish is already selected", () => {
      const res = detectClarificationNeeded("How much is a baptismal certificate?", 2);
      assert.equal(res, null, "Should not clarify when selectedParishId is provided");
    });

    it("DOES NOT trigger parish clarification for general DIOCESE questions", () => {
      const generalQueries = [
        "What documents can I request through TESTIMONIUM?",
        "What certificates does TESTIMONIUM support?",
        "Can I request a certificate for my brother?",
        "Is my GCash payment verified automatically?",
        "How do I upload payment proof?",
      ];
      for (const q of generalQueries) {
        const res = detectClarificationNeeded(q, null);
        assert.equal(res, null, `General query "${q}" should NOT trigger parish clarification`);
      }
    });
  });

  describe("ChatbotService Routing Integration", () => {
    it("routes greeting to social without calling retrieval or chat provider", async () => {
      let retrievalCalled = false;
      let generationCalled = false;

      const mockRetrieval = {
        retrieveKnowledge: async () => {
          retrievalCalled = true;
          return { candidates: [], hasSufficientEvidence: false };
        },
      };

      const mockChat = {
        generateGroundedAnswer: async () => {
          generationCalled = true;
          return { answer: "Mock" };
        },
      };

      const mockLogRepo = {
        logQuery: async () => {},
      };

      const service = new ChatbotService({
        retrievalService: mockRetrieval,
        chatProvider: mockChat,
        logRepository: mockLogRepo,
        isEnabled: true,
      });

      const res = await service.handleQuery({
        question: "Hello Caloy",
        sessionId: "test-sess",
        selectedParishId: null,
      });

      assert.equal(retrievalCalled, false, "Retrieval should NOT be called for social intent");
      assert.equal(generationCalled, false, "Generation should NOT be called for social intent");
      assert.equal(res.responseType, "SOCIAL");
      assert.equal(res.fallback, false);
      assert.deepEqual(res.sources, []);
    });

    it("routes fee question without parish to clarification without calling retrieval", async () => {
      let retrievalCalled = false;
      let generationCalled = false;

      const mockRetrieval = {
        retrieveKnowledge: async () => {
          retrievalCalled = true;
          return { candidates: [], hasSufficientEvidence: false };
        },
      };

      const mockChat = {
        generateGroundedAnswer: async () => {
          generationCalled = true;
          return { answer: "Mock" };
        },
      };

      const mockLogRepo = {
        logQuery: async () => {},
      };

      const service = new ChatbotService({
        retrievalService: mockRetrieval,
        chatProvider: mockChat,
        logRepository: mockLogRepo,
        isEnabled: true,
      });

      const res = await service.handleQuery({
        question: "How much is a baptismal certificate?",
        sessionId: "test-sess",
        selectedParishId: null,
      });

      assert.equal(retrievalCalled, false, "Retrieval should NOT be called for parish clarification");
      assert.equal(generationCalled, false, "Generation should NOT be called for parish clarification");
      assert.equal(res.responseType, "CLARIFICATION");
      assert.equal(res.clarificationType, "PARISH");
      assert.equal(res.fallback, false);
      assert.deepEqual(res.sources, []);
    });
  });
});
