/**
 * Base abstract interface for chat/generation providers.
 */
export class ChatCompletionProvider {
  constructor(providerName = "base", modelName = "unknown") {
    this.providerName = providerName;
    this.modelName = modelName;
  }

  /**
   * Generates a grounded response given a question, evidence, and system instructions.
   * @param {object} params
   * @param {string} params.question
   * @param {Array<{ id: number|string, title: string, content: string }>} params.evidence
   * @param {string} [params.instructions]
   * @param {number} [params.maxOutputTokens]
   * @param {AbortSignal} [params.signal]
   * @returns {Promise<{ answer: string, citedChunkIds: number[], fallback: boolean, fallbackReason?: string }>}
   */
  async generateGroundedAnswer(params) {
    throw new Error("generateGroundedAnswer must be implemented by subclass");
  }
}
