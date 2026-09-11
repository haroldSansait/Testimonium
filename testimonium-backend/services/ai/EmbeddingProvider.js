/**
 * Base abstract interface for embedding providers.
 */
export class EmbeddingProvider {
  constructor(providerName = "base", modelName = "unknown", dimensions = 768) {
    this.providerName = providerName;
    this.modelName = modelName;
    this.dimensions = dimensions;
  }

  /**
   * Embeds a single query string for semantic retrieval.
   * @param {string} text
   * @param {object} [options]
   * @returns {Promise<{ vector: number[], dimensions: number, provider: string, model: string }>}
   */
  async embedQuery(text, options = {}) {
    throw new Error("embedQuery must be implemented by subclass");
  }

  /**
   * Embeds a batch of documents/chunks.
   * @param {Array<{ id: number|string, title: string, content: string }>} documents
   * @param {object} [options]
   * @returns {Promise<Array<{ id: number|string, vector: number[], dimensions: number, provider: string, model: string }>>}
   */
  async embedDocuments(documents, options = {}) {
    throw new Error("embedDocuments must be implemented by subclass");
  }

  /**
   * Helper to validate that a vector has exact expected dimensions and all finite numbers.
   * @param {number[]} vector
   * @param {number} [expectedDim]
   */
  validateVector(vector, expectedDim = this.dimensions) {
    if (!Array.isArray(vector)) {
      const err = new Error(`Invalid embedding vector: expected array, got ${typeof vector}`);
      err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
      throw err;
    }
    if (vector.length !== expectedDim) {
      const err = new Error(`Embedding dimension mismatch: expected ${expectedDim}, got ${vector.length}`);
      err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
      throw err;
    }
    for (let i = 0; i < vector.length; i++) {
      if (typeof vector[i] !== "number" || !Number.isFinite(vector[i])) {
        const err = new Error(`Embedding vector contains non-finite value at index ${i}: ${vector[i]}`);
        err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
        throw err;
      }
    }
  }
}
