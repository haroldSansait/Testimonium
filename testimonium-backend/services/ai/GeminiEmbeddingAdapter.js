import { GoogleGenAI } from "@google/genai";
import { EmbeddingProvider } from "./EmbeddingProvider.js";
import { abortableDelay, createCallerAbortError, throwIfCallerAborted } from "./retryUtils.js";
import { defaultAiUsageTelemetry, noOpAiUsageTelemetry, isAiUnitTestRuntime } from "../AiUsageTelemetryService.js";

function isTransientError(err) {
  if (!err) return false;
  if (err.name === "AbortError" || err.code === "CHATBOT_ABORTED" || err.code === "CHATBOT_TIMEOUT") return false;
  const status = err.status || err.statusCode || err.response?.status;
  if (status) {
    const s = Number(status);
    if ([408, 429, 500, 502, 503, 504].includes(s)) return true;
    if (s >= 400 && s < 500) return false;
  }
  const code = String(err.code || "").toUpperCase();
  if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) {
    return true;
  }
  const msg = String(err.message || "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("rate limit") || msg.includes("resource exhausted") || msg.includes("network")) {
    return true;
  }
  return false;
}

export class GeminiEmbeddingAdapter extends EmbeddingProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} [config.model]
   * @param {number} [config.dimensions]
   * @param {number} [config.timeoutMs]
   * @param {number} [config.maxRetries]
   * @param {number} [config.retryBaseDelayMs]
   * @param {object} [config.telemetryRecorder]
   */
  constructor(config = {}) {
    const model = config.model || "gemini-embedding-2";
    const dimensions = config.dimensions || 768;
    super("gemini", model, dimensions);

    if (!config.apiKey && process.env.NODE_ENV !== "test") {
      throw new Error("GEMINI_API_KEY is required for GeminiEmbeddingAdapter");
    }

    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 15000;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
    this.client = config.client || (config.apiKey ? new GoogleGenAI({ apiKey: config.apiKey }) : null);
    this.telemetryRecorder = config.telemetryRecorder || (isAiUnitTestRuntime() ? noOpAiUsageTelemetry : defaultAiUsageTelemetry);
  }

  /**
   * Format query according to Gemini Embedding 2 retrieval conventions.
   */
  formatQuery(text) {
    const clean = String(text || "").trim();
    return `task: question answering | query: ${clean}`;
  }

  /**
   * Format document according to Gemini Embedding 2 retrieval conventions.
   */
  formatDocument(title, content) {
    const cleanTitle = String(title || "").trim();
    const cleanContent = String(content || "").trim();
    return `title: ${cleanTitle} | text: ${cleanContent}`;
  }

  /**
   * Internal retry wrapper with abort-aware timeout and transient error classification.
   */
  async _executeWithRetry(operationFn, callerSignal = null, { purpose = "QUERY_EMBEDDING", traceId = null } = {}) {
    let attempt = 0;
    let lastError = null;

    throwIfCallerAborted(callerSignal);

    while (attempt <= this.maxRetries) {
      throwIfCallerAborted(callerSignal);
      let timerId = null;
      const timeoutController = new AbortController();
      const attemptStartTime = Date.now();

      try {
        let combinedSignal;
        if (callerSignal) {
          if (typeof AbortSignal.any === "function") {
            combinedSignal = AbortSignal.any([callerSignal, timeoutController.signal]);
          } else {
            const composite = new AbortController();
            const onAbort = () => composite.abort();
            callerSignal.addEventListener("abort", onAbort, { once: true });
            timeoutController.signal.addEventListener("abort", onAbort, { once: true });
            combinedSignal = composite.signal;
          }
        } else {
          combinedSignal = timeoutController.signal;
        }

        const timeoutPromise = new Promise((_, reject) => {
          timerId = setTimeout(() => {
            timeoutController.abort();
            const err = new Error("CHATBOT_EMBEDDING_TIMEOUT");
            err.code = "CHATBOT_TIMEOUT";
            reject(err);
          }, this.timeoutMs);
        });

        const opPromise = operationFn(combinedSignal);
        const res = await Promise.race([opPromise, timeoutPromise]);
        const attemptLatencyMs = Date.now() - attemptStartTime;

        this.telemetryRecorder?.recordAttemptSafe({
          traceId,
          provider: this.providerName,
          model: this.modelName,
          operation: "EMBED_CONTENT",
          purpose,
          attemptNumber: attempt + 1,
          success: true,
          statusCode: 200,
          latencyMs: attemptLatencyMs,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
        });

        return res;
      } catch (err) {
        lastError = err;
        const attemptLatencyMs = Date.now() - attemptStartTime;

        let errCategory = "UNKNOWN_PROVIDER_ERROR";
        const status = err.status || err.statusCode || err.response?.status;
        if (Number(status) === 429 || String(err.message || "").toLowerCase().includes("rate limit") || String(err.message || "").toLowerCase().includes("resource exhausted")) {
          errCategory = "AI_PROVIDER_RATE_LIMITED";
        } else if (err.code === "CHATBOT_TIMEOUT" || String(err.message || "").toLowerCase().includes("timeout")) {
          errCategory = "PROVIDER_TIMEOUT";
        } else if (status && Number(status) >= 500) {
          errCategory = "PROVIDER_5XX";
        } else if (status && (Number(status) === 401 || Number(status) === 403)) {
          errCategory = "PROVIDER_AUTH";
        } else if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(String(err.code || "").toUpperCase())) {
          errCategory = "NETWORK_ERROR";
        }

        this.telemetryRecorder?.recordAttemptSafe({
          traceId,
          provider: this.providerName,
          model: this.modelName,
          operation: "EMBED_CONTENT",
          purpose,
          attemptNumber: attempt + 1,
          success: false,
          statusCode: status ? Number(status) : null,
          errorCategory: errCategory,
          latencyMs: attemptLatencyMs,
        });

        if (callerSignal?.aborted) {
          throw createCallerAbortError();
        }

        if (err.code === "CHATBOT_INVALID_PROVIDER_RESPONSE" || err.code === "CHATBOT_ABORTED") {
          throw err;
        }

        if (!isTransientError(err)) {
          // Permanent failure -> do not retry
          break;
        }

        attempt++;
        if (attempt <= this.maxRetries) {
          throwIfCallerAborted(callerSignal);
          const delay = Math.min(this.retryBaseDelayMs * Math.pow(2, attempt - 1), 4000);
          await abortableDelay(delay, callerSignal);
          throwIfCallerAborted(callerSignal);
        }
      } finally {
        if (timerId) {
          clearTimeout(timerId);
        }
      }
    }

    throwIfCallerAborted(callerSignal);

    const safeErr = new Error("Chatbot embedding service unavailable");
    safeErr.code = lastError?.code === "CHATBOT_INVALID_PROVIDER_RESPONSE"
      ? "CHATBOT_INVALID_PROVIDER_RESPONSE"
      : "CHATBOT_EMBEDDING_UNAVAILABLE";
    throw safeErr;
  }

  async embedQuery(text, options = {}) {
    if (!this.client) {
      throw new Error("Gemini client is not initialized (missing API key)");
    }

    const formatted = this.formatQuery(text);
    const callerSignal = options.signal || null;
    const traceId = options.traceId || null;

    const res = await this._executeWithRetry(async (abortSignal) => {
      return await this.client.models.embedContent({
        model: this.modelName,
        contents: formatted,
        config: {
          outputDimensionality: this.dimensions,
          abortSignal,
        },
      });
    }, callerSignal, { purpose: "QUERY_EMBEDDING", traceId });

    // Installed @google/genai contract: response.embeddings[0].values
    if (!res || !Array.isArray(res.embeddings) || res.embeddings.length !== 1) {
      const err = new Error("Invalid embedding response from provider: expected exactly one embedding vector");
      err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
      throw err;
    }

    const values = res.embeddings[0]?.values;
    if (!values || !Array.isArray(values) || values.length !== this.dimensions) {
      const err = new Error("Invalid embedding values from provider: missing or dimension mismatch");
      err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
      throw err;
    }

    this.validateVector(values);

    return {
      vector: values,
      dimensions: values.length,
      provider: this.providerName,
      model: this.modelName,
    };
  }

  async embedDocuments(documents, options = {}) {
    if (!this.client) {
      throw new Error("Gemini client is not initialized (missing API key)");
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      return [];
    }

    const callerSignal = options.signal || null;
    const traceId = options.traceId || null;
    const results = [];

    // Process documents individually to guarantee exact 1-to-1 vector mapping
    for (const doc of documents) {
      const formatted = this.formatDocument(doc.title, doc.content);

      const res = await this._executeWithRetry(async (abortSignal) => {
        return await this.client.models.embedContent({
          model: this.modelName,
          contents: formatted,
          config: {
            outputDimensionality: this.dimensions,
            abortSignal,
          },
        });
      }, callerSignal, { purpose: "DOCUMENT_EMBEDDING", traceId });

      if (!res || !Array.isArray(res.embeddings) || res.embeddings.length !== 1) {
        const err = new Error(`Invalid document embedding response for document ${doc.id}`);
        err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
        throw err;
      }

      const values = res.embeddings[0]?.values;
      if (!values || !Array.isArray(values) || values.length !== this.dimensions) {
        const err = new Error(`Invalid embedding values for document ${doc.id}`);
        err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
        throw err;
      }

      this.validateVector(values);

      results.push({
        id: doc.id,
        vector: values,
        dimensions: values.length,
        provider: this.providerName,
        model: this.modelName,
      });
    }

    if (results.length !== documents.length) {
      const err = new Error(`Output vectors count (${results.length}) does not match input document count (${documents.length})`);
      err.code = "CHATBOT_INVALID_PROVIDER_RESPONSE";
      throw err;
    }

    return results;
  }
}
