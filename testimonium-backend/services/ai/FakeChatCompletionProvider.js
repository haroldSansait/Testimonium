import { ChatCompletionProvider } from "./ChatCompletionProvider.js";

export class FakeChatCompletionProvider extends ChatCompletionProvider {
  constructor() {
    super("fake", "fake-chat-model");
    this.calls = [];
    this.customAnswer = null;
    this.customCitedChunkIds = null;
    this.simulateError = null;
    this.simulateInsufficient = false;
  }

  setMockAnswer(answer, citedChunkIds = []) {
    this.customAnswer = answer;
    this.customCitedChunkIds = citedChunkIds;
  }

  async generateGroundedAnswer({ question, evidence = [], instructions, maxOutputTokens, signal }) {
    this.calls.push({ question, evidence, instructions, maxOutputTokens });

    if (this.simulateError) {
      const err = new Error(this.simulateError.message || "Simulated chat generation failure");
      err.code = this.simulateError.code || "CHATBOT_GENERATION_UNAVAILABLE";
      throw err;
    }

    if (this.simulateInsufficient || !evidence || evidence.length === 0) {
      return {
        answer: "",
        citedChunkIds: [],
      };
    }

    const citedChunkIds = this.customCitedChunkIds !== null ? this.customCitedChunkIds : evidence.map((e) => Number(e.id));
    const answer =
      this.customAnswer !== null
        ? this.customAnswer
        : `Based on verified TESTIMONIUM records, ${evidence[0]?.content?.slice(0, 100) || "here is the answer."}`;

    return {
      answer,
      citedChunkIds,
    };
  }
}
