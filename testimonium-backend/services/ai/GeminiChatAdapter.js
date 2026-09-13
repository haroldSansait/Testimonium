import { GoogleGenAI } from "@google/genai";
import { ChatCompletionProvider } from "./ChatCompletionProvider.js";
import { abortableDelay, createCallerAbortError, throwIfCallerAborted } from "./retryUtils.js";
import { extractCitationsAndSanitize } from "./citationUtils.js";
import { buildRagSystemInstruction } from "./CaloyPolicy.js";
import { defaultAiUsageTelemetry, noOpAiUsageTelemetry, isAiUnitTestRuntime } from "../AiUsageTelemetryService.js";
import { buildGeminiGenerationConfig } from "./geminiConfigHelper.js";

const DEFAULT_SYSTEM_INSTRUCTIONS = buildRagSystemInstruction();

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

export class GeminiChatAdapter extends ChatCompletionProvider {
  /**
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} [config.model]
   * @param {number} [config.timeoutMs]
   * @param {number} [config.maxRetries]
   * @param {number} [config.retryBaseDelayMs]
   * @param {object} [config.telemetryRecorder]
   */
  constructor(config = {}) {
    const model = config.model || "gemini-3.8-flash";
    super("gemini", model);

    if (!config.apiKey && process.env.NODE_ENV !== "test") {
      throw new Error("GEMINI_API_KEY is required for GeminiChatAdapter");
    }

    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 45000;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
    this.client = config.client || (config.apiKey ? new GoogleGenAI({ apiKey: config.apiKey }) : null);
    this.telemetryRecorder = config.telemetryRecorder || (isAiUnitTestRuntime() ? noOpAiUsageTelemetry : defaultAiUsageTelemetry);
  }

  /**
   * Builds the formatted prompt with evidence passages.
   */
  _buildPrompt(question, evidence) {
    let evidenceText = "";
    if (evidence && evidence.length > 0) {
      evidenceText = evidence
        .map((e, idx) => `[Evidence ${idx + 1}] (Chunk ID: ${e.id}, Title: "${e.title}"):\n${e.content}`)
        .join("\n\n");
    } else {
      evidenceText = "No relevant verified evidence available.";
    }

    return `VERIFIED EVIDENCE:\n${evidenceText}\n\nUSER QUESTION:\n${question}`;
  }

  /**
   * Generates a grounded response.
   */
  async generateGroundedAnswer({ question, evidence = [], instructions, maxOutputTokens = 700, signal, traceId = null }) {
    if (!this.client) {
      throw new Error("Gemini client is not initialized (missing API key)");
    }

    const systemInstruction = instructions || DEFAULT_SYSTEM_INSTRUCTIONS;
    const prompt = this._buildPrompt(question, evidence);
    const validEvidenceIds = new Set(evidence.map((e) => Number(e.id)));

    let attempt = 0;
    let lastError = null;

    throwIfCallerAborted(signal);

    while (attempt <= this.maxRetries) {
      throwIfCallerAborted(signal);
      let timerId = null;
      const timeoutController = new AbortController();
      const attemptStartTime = Date.now();

      try {
        let combinedSignal;
        if (signal) {
          if (typeof AbortSignal.any === "function") {
            combinedSignal = AbortSignal.any([signal, timeoutController.signal]);
          } else {
            const composite = new AbortController();
            const onAbort = () => composite.abort();
            signal.addEventListener("abort", onAbort, { once: true });
            timeoutController.signal.addEventListener("abort", onAbort, { once: true });
            combinedSignal = composite.signal;
          }
        } else {
          combinedSignal = timeoutController.signal;
        }

        const timeoutPromise = new Promise((_, reject) => {
          timerId = setTimeout(() => {
            timeoutController.abort();
            const err = new Error("CHATBOT_GENERATION_TIMEOUT");
            err.code = "CHATBOT_TIMEOUT";
            reject(err);
          }, this.timeoutMs);
        });

        const baseConfig = {
          systemInstruction,
          maxOutputTokens,
          temperature: 0.2,
          abortSignal: combinedSignal,
        };

        const generationConfig = buildGeminiGenerationConfig({
          model: this.modelName,
          baseConfig,
          purpose: "RAG_GENERATION",
        });

        const callPromise = this.client.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: generationConfig,
        });

        const response = await Promise.race([callPromise, timeoutPromise]);
        const attemptLatencyMs = Date.now() - attemptStartTime;

        // Record successful attempt telemetry
        const usage = response?.usageMetadata;
        this.telemetryRecorder?.recordAttemptSafe({
          traceId,
          provider: this.providerName,
          model: this.modelName,
          operation: "GENERATE_CONTENT",
          purpose: "RAG_GENERATION",
          attemptNumber: attempt + 1,
          success: true,
          statusCode: 200,
          latencyMs: attemptLatencyMs,
          inputTokens: usage?.promptTokenCount !== undefined && usage?.promptTokenCount !== null ? Number(usage.promptTokenCount) : null,
          outputTokens: usage?.candidatesTokenCount !== undefined && usage?.candidatesTokenCount !== null ? Number(usage.candidatesTokenCount) : null,
          totalTokens: usage?.totalTokenCount !== undefined && usage?.totalTokenCount !== null ? Number(usage.totalTokenCount) : null,
        });

        const textContent = typeof response?.text === "function" ? response.text() : response?.text;
        const rawText = typeof textContent === "string" ? textContent.trim() : "";

        // Explicit insufficient evidence marker or empty output
        if (!rawText || rawText.includes("[INSUFFICIENT_EVIDENCE]")) {
          return {
            answer: "",
            citedChunkIds: [],
          };
        }

        // Parse citation tags and sanitize visible answer text
        const { cleanedAnswer, citedChunkIds } = extractCitationsAndSanitize(rawText, validEvidenceIds);

        return {
          answer: cleanedAnswer,
          citedChunkIds,
        };
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
        } else if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"].includes(String(err.code || "").toUpperCase())) {
          errCategory = "NETWORK_ERROR";
        }

        this.telemetryRecorder?.recordAttemptSafe({
          traceId,
          provider: this.providerName,
          model: this.modelName,
          operation: "GENERATE_CONTENT",
          purpose: "RAG_GENERATION",
          attemptNumber: attempt + 1,
          success: false,
          statusCode: status ? Number(status) : null,
          errorCategory: errCategory,
          latencyMs: attemptLatencyMs,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
        });

        if (signal?.aborted) {
          throw createCallerAbortError();
        }

        if (err.code === "CHATBOT_ABORTED") {
          throw err;
        }

        if (!isTransientError(err)) {
          // Permanent failure -> do not retry
          break;
        }

        attempt++;
        if (attempt <= this.maxRetries) {
          throwIfCallerAborted(signal);
          const delay = Math.min(this.retryBaseDelayMs * Math.pow(2, attempt - 1), 4000);
          await abortableDelay(delay, signal);
          throwIfCallerAborted(signal);
        }
      } finally {
        if (timerId) {
          clearTimeout(timerId);
        }
      }
    }

    throwIfCallerAborted(signal);

    const safeErr = new Error("Chatbot generation service unavailable");
    safeErr.code = "CHATBOT_GENERATION_UNAVAILABLE";
    throw safeErr;
  }
}
