import crypto from "node:crypto";
import { EmbeddingProvider } from "./EmbeddingProvider.js";

export class FakeEmbeddingProvider extends EmbeddingProvider {
  constructor(dimensions = 768) {
    super("fake", "fake-embedding-model", dimensions);
    this.calls = [];
    this.simulateError = null;
    this.simulateDimensions = null;
    this.simulateNonFinite = false;
  }

  _generateDeterministicVector(text, dim = this.dimensions) {
    if (this.simulateNonFinite) {
      const vec = new Array(dim).fill(0.1);
      vec[5] = NaN;
      return vec;
    }

    const effectiveDim = this.simulateDimensions || dim;
    const hash = crypto.createHash("sha256").update(String(text || "")).digest();
    const vector = new Array(effectiveDim);

    for (let i = 0; i < effectiveDim; i++) {
      const byteVal = hash[i % hash.length];
      const val = (byteVal / 127.5) - 1.0;
      vector[i] = Number(val.toFixed(6));
    }

    // Normalize to unit vector for cosine similarity
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }

  async embedQuery(text, options = {}) {
    this.calls.push({ type: "query", text, options });

    if (this.simulateError) {
      const err = new Error(this.simulateError.message || "Simulated embedding failure");
      err.code = this.simulateError.code || "CHATBOT_EMBEDDING_UNAVAILABLE";
      throw err;
    }

    const vector = this._generateDeterministicVector(text);
    this.validateVector(vector);

    return {
      vector,
      dimensions: vector.length,
      provider: this.providerName,
      model: this.modelName,
    };
  }

  async embedDocuments(documents, options = {}) {
    this.calls.push({ type: "documents", documents, options });

    if (this.simulateError) {
      const err = new Error(this.simulateError.message || "Simulated embedding failure");
      err.code = this.simulateError.code || "CHATBOT_EMBEDDING_UNAVAILABLE";
      throw err;
    }

    return documents.map((doc) => {
      const vector = this._generateDeterministicVector(`${doc.title} ${doc.content}`);
      this.validateVector(vector);
      return {
        id: doc.id,
        vector,
        dimensions: vector.length,
        provider: this.providerName,
        model: this.modelName,
      };
    });
  }
}
