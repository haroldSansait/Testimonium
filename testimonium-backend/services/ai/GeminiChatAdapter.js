import { GoogleGenAI } from "@google/genai";
import { ChatCompletionProvider } from "./ChatCompletionProvider.js";
import { abortableDelay, createCallerAbortError, throwIfCallerAborted } from "./retryUtils.js";
import { extractCitationsAndSanitize } from "./citationUtils.js";
import { buildRagSystemInstruction } from "./CaloyPolicy.js";
import { isCurrentMessageLanguageConsistent } from "./languageMirroring.js";
import { defaultAiUsageTelemetry, noOpAiUsageTelemetry, isAiUnitTestRuntime } from "../AiUsageTelemetryService.js";
import { buildGeminiGenerationConfig } from "./geminiConfigHelper.js";

const DEFAULT_SYSTEM_INSTRUCTIONS = buildRagSystemInstruction();

export const RAG_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description: "Human-visible grounded answer only, with no citation markers or metadata.",
    },
    citedChunkIds: {
      type: "array",
      items: { type: "integer" },
      description: "Supporting Chunk IDs copied only from the supplied verified evidence.",
    },
    insufficientEvidence: {
      type: "boolean",
      description: "True only when the supplied evidence cannot fully support an answer.",
    },
  },
  required: ["answer", "citedChunkIds", "insufficientEvidence"],
  propertyOrdering: ["answer", "citedChunkIds", "insufficientEvidence"],
};

function stripJsonFence(rawText) {
  const match = String(rawText || "").trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : String(rawText || "").trim();
}

function deduplicatePositiveIntegers(values) {
  if (!Array.isArray(values)) return null;
  if (!values.every((value) => Number.isInteger(value) && value > 0)) return null;
  return [...new Set(values)];
}

/**
 * Parses the new schema-bound JSON contract, while retaining strict support for
 * historical marker output during rollout. It never invents or filters citations.
 */
export function parseGroundedGenerationResponse(rawText, validEvidenceIds = null) {
  const text = String(rawText || "").trim();
  const validSet = validEvidenceIds instanceof Set
    ? validEvidenceIds
    : new Set(Array.isArray(validEvidenceIds) ? validEvidenceIds.map(Number) : []);

  if (!text) {
    return {
      answer: "",
      citedChunkIds: [],
      invalidCitedChunkIds: [],
      citationContractStatus: "MALFORMED_STRUCTURED_OUTPUT",
    };
  }

  if (text === "[INSUFFICIENT_EVIDENCE]") {
    return {
      answer: "",
      citedChunkIds: [],
      invalidCitedChunkIds: [],
      citationContractStatus: "INSUFFICIENT_EVIDENCE",
    };
  }

  const jsonCandidate = stripJsonFence(text);
  if (jsonCandidate.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(jsonCandidate);
    } catch {
      return {
        answer: "",
        citedChunkIds: [],
        invalidCitedChunkIds: [],
        citationContractStatus: "MALFORMED_STRUCTURED_OUTPUT",
      };
    }

    const hasValidShape =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof parsed.answer === "string" &&
      typeof parsed.insufficientEvidence === "boolean";
    const citedChunkIds = deduplicatePositiveIntegers(parsed?.citedChunkIds);

    if (!hasValidShape || citedChunkIds === null) {
      return {
        answer: "",
        citedChunkIds: [],
        invalidCitedChunkIds: [],
        citationContractStatus: "MALFORMED_STRUCTURED_OUTPUT",
      };
    }

    if (parsed.insufficientEvidence) {
      return {
        answer: "",
        citedChunkIds: [],
        invalidCitedChunkIds: [],
        citationContractStatus: "INSUFFICIENT_EVIDENCE",
      };
    }

    const { cleanedAnswer } = extractCitationsAndSanitize(parsed.answer);
    const invalidCitedChunkIds = citedChunkIds.filter((id) => !validSet.has(id));
    return {
      answer: cleanedAnswer,
      citedChunkIds,
      invalidCitedChunkIds,
      citationContractStatus: citedChunkIds.length > 0 ? "STRUCTURED" : "MISSING_CITATIONS",
    };
  }

  const legacy = extractCitationsAndSanitize(text, validSet);
  return {
    answer: legacy.cleanedAnswer,
    citedChunkIds: legacy.citedChunkIds,
    invalidCitedChunkIds: legacy.invalidCitedChunkIds,
    citationContractStatus: legacy.citedChunkIds.length > 0 ? "LEGACY" : "MISSING_CITATIONS",
  };
}

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

    return `CURRENT-MESSAGE LANGUAGE RULE:
The USER QUESTION below is the sole language-style authority. Answer in English when it is clearly English, even if evidence is in a Philippine language. Mirror Tagalog, Cebuano, Hiligaynon, and intentional mixed-language questions naturally. Evidence language never overrides the question.

VERIFIED EVIDENCE:
${evidenceText}

USER QUESTION:
${question}`;
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
          responseMimeType: "application/json",
          responseJsonSchema: RAG_RESPONSE_JSON_SCHEMA,
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

        const parsedResult = parseGroundedGenerationResponse(rawText, validEvidenceIds);
        if (
          parsedResult.answer &&
          !isCurrentMessageLanguageConsistent(question, parsedResult.answer)
        ) {
          return {
            answer: "",
            citedChunkIds: parsedResult.citedChunkIds,
            invalidCitedChunkIds: parsedResult.invalidCitedChunkIds,
            citationContractStatus: "CURRENT_MESSAGE_LANGUAGE_MISMATCH",
          };
        }

        return parsedResult;
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
