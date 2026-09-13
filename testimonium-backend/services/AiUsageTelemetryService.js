import { prisma as defaultPrisma } from "../config/db.js";
import { logger } from "../config/logger.js";

export const ALLOWED_OPERATIONS = new Set(["GENERATE_CONTENT", "EMBED_CONTENT"]);
export const isAiUnitTestRuntime = () =>
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test") ||
  Boolean(process.env.NODE_TEST_CONTEXT);

export const ALLOWED_PURPOSES = new Set([
  "SEMANTIC_ROUTING",
  "RAG_GENERATION",
  "RESPONSE_COMPOSER",
  "QUERY_EMBEDDING",
  "DOCUMENT_EMBEDDING",
]);

/**
 * Validates operation and purpose against authoritative canonical values.
 */
export function validateTelemetryOperationAndPurpose(operation, purpose) {
  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error(`Unsupported AI telemetry operation: "${operation}". Allowed: ${Array.from(ALLOWED_OPERATIONS).join(", ")}`);
  }
  if (!ALLOWED_PURPOSES.has(purpose)) {
    throw new Error(`Unsupported AI telemetry purpose: "${purpose}". Allowed: ${Array.from(ALLOWED_PURPOSES).join(", ")}`);
  }
  return true;
}

/**
 * Service for recording granular, privacy-safe AI provider attempts into ai_usage_events.
 *
 * Guaranteed non-blocking and best-effort:
 * A write failure will NEVER fail a user's chatbot query, semantic routing,
 * RAG generation, or background knowledge embedding worker.
 */
export class AiUsageTelemetryService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Best-effort persistence of a single provider attempt.
   *
   * @param {object} params
   * @param {string|null} [params.traceId] - Correlates multiple provider attempts to one user query
   * @param {string} params.provider - "gemini"
   * @param {string} params.model - Model identifier
   * @param {string} params.operation - "GENERATE_CONTENT" | "EMBED_CONTENT"
   * @param {string} params.purpose - "SEMANTIC_ROUTING" | "RAG_GENERATION" | "RESPONSE_COMPOSER" | "QUERY_EMBEDDING" | "DOCUMENT_EMBEDDING"
   * @param {number} [params.attemptNumber=1]
   * @param {boolean} params.success
   * @param {number|null} [params.statusCode]
   * @param {string|null} [params.errorCategory]
   * @param {number} params.latencyMs
   * @param {number|null} [params.inputTokens]
   * @param {number|null} [params.outputTokens]
   * @param {number|null} [params.totalTokens]
   */
  async recordAttemptSafe({
    traceId = null,
    provider = "gemini",
    model = "unknown",
    operation = "GENERATE_CONTENT",
    purpose = "RAG_GENERATION",
    attemptNumber = 1,
    success = false,
    statusCode = null,
    errorCategory = null,
    latencyMs = 0,
    inputTokens = null,
    outputTokens = null,
    totalTokens = null,
  }) {
    if (isAiUnitTestRuntime() && this.prisma === defaultPrisma) {
      const err = new Error("Focused AI tests must inject NoOpAiUsageTelemetryService; operational Prisma access is blocked");
      err.code = "TEST_ISOLATION_VIOLATION";
      throw err;
    }
    // Validate operation and purpose against canonical allowlist
    if (!ALLOWED_OPERATIONS.has(operation) || !ALLOWED_PURPOSES.has(purpose)) {
      logger.warn(
        `[AiUsageTelemetryService] Invalid operation "${operation}" or purpose "${purpose}". Attempt not recorded.`
      );
      return;
    }

    // Skip recording in unit tests using fake providers unless DB is available and intended
    if (provider === "fake" || provider === "test") {
      return;
    }

    try {
      await this.prisma.aiUsageEvent.create({
        data: {
          traceId: traceId ? String(traceId).slice(0, 100) : null,
          provider: String(provider).slice(0, 50),
          model: String(model).slice(0, 100),
          operation: String(operation).slice(0, 50),
          purpose: String(purpose).slice(0, 50),
          attemptNumber: Math.max(1, Number(attemptNumber) || 1),
          success: Boolean(success),
          statusCode: statusCode !== null && statusCode !== undefined ? Number(statusCode) : null,
          errorCategory: errorCategory ? String(errorCategory).slice(0, 100) : null,
          latencyMs: Math.max(0, Number(latencyMs) || 0),
          inputTokens: inputTokens !== null && inputTokens !== undefined ? Math.max(0, Number(inputTokens)) : null,
          outputTokens: outputTokens !== null && outputTokens !== undefined ? Math.max(0, Number(outputTokens)) : null,
          totalTokens: totalTokens !== null && totalTokens !== undefined ? Math.max(0, Number(totalTokens)) : null,
        },
      });
    } catch (err) {
      // Best-effort: log warning and swallow error. Never retry Gemini because telemetry failed.
      logger.warn({ err }, `[AiUsageTelemetryService] Failed to record usage event for ${purpose}: ${err.message}`);
    }
  }
}

export class NoOpAiUsageTelemetryService {
  async recordAttemptSafe() {}
}

export const defaultAiUsageTelemetry = new AiUsageTelemetryService();
export const noOpAiUsageTelemetry = new NoOpAiUsageTelemetryService();
