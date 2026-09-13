import { apiClient } from "@/services/api/client";
import { AppError } from "@/services/api/errors";
import { isValidUuid } from "../caloyStorage";
import type { CaloyQueryRequest, CaloyQueryResponse } from "../types";

/**
 * Normalizes backend /chatbot/query response into Mobile's internal Caloy model.
 * Bridges top-level `clarificationType` and `clarificationOptions` into `structuredClarification`
 * so chip components receive options directly regardless of DTO flattening.
 */
export function normalizeCaloyResponse(response: CaloyQueryResponse): CaloyQueryResponse {
  if (!response) return response;

  const topType = response.clarificationType;
  const topOptions = response.clarificationOptions;

  let structuredClarification = response.structuredClarification
    ? { ...response.structuredClarification }
    : (topType || (topOptions && topOptions.length > 0) ? {} : undefined);

  if (structuredClarification) {
    if (topType && !structuredClarification.clarificationType) {
      structuredClarification.clarificationType = topType;
    }
    if (
      topOptions &&
      topOptions.length > 0 &&
      (!structuredClarification.clarificationOptions || structuredClarification.clarificationOptions.length === 0)
    ) {
      structuredClarification.clarificationOptions = topOptions;
    }
  }

  return {
    ...response,
    structuredClarification,
    clarificationType: topType || structuredClarification?.clarificationType,
    clarificationOptions: topOptions || structuredClarification?.clarificationOptions,
  };
}

/**
 * Normalizes selectedParishId into the backend contract:
 * - Positive integer for an active specific parish
 * - null for diocese-wide / "All Parishes"
 */
export function normalizeSelectedParishId(id: unknown): number | null {
  if (id === null || id === undefined) return null;
  const num = typeof id === "number" ? id : Number(id);
  if (Number.isInteger(num) && num > 0) {
    return num;
  }
  return null;
}

/**
 * Normalizes structured clarification to include only backend-approved fields.
 * Discards client-only fields (id, clarificationType, clarificationOptions, isButtonSelection, etc.).
 */
export function normalizeStructuredClarification(
  data: unknown
): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const raw = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  if (typeof raw.originalQuestion === "string" && raw.originalQuestion.trim()) {
    normalized.originalQuestion = raw.originalQuestion.trim();
  }
  if (typeof raw.toolId === "string" && raw.toolId.trim()) {
    normalized.toolId = raw.toolId.trim();
  }
  if (typeof raw.originalIntent === "string" && raw.originalIntent.trim()) {
    normalized.originalIntent = raw.originalIntent.trim();
  }
  if (raw.collected && typeof raw.collected === "object" && !Array.isArray(raw.collected)) {
    normalized.collected = raw.collected as Record<string, unknown>;
  }
  if (typeof raw.missing === "string" && raw.missing.trim()) {
    normalized.missing = raw.missing.trim();
  }
  if (typeof raw.nextRequired === "string" && raw.nextRequired.trim()) {
    normalized.nextRequired = raw.nextRequired.trim();
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Normalizes conversationContext to include only backend-approved fields:
 * - lastIntent: string | null
 * - lastParishId: positive integer | null
 * - lastParishName: string | null
 * - lastDocumentType: string | null
 * - lastScheduleEvent: string | null
 * - lastDatePhrase: string | null
 * - lastResponseType: string | null
 */
export function normalizeConversationContext(
  context: unknown
): Record<string, unknown> | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }
  const raw = context as Record<string, unknown>;
  const allowedKeys = [
    "lastIntent",
    "lastParishId",
    "lastParishName",
    "lastDocumentType",
    "lastScheduleEvent",
    "lastDatePhrase",
    "lastResponseType",
  ] as const;

  const normalized: Record<string, unknown> = {};
  let hasValidField = false;

  for (const key of allowedKeys) {
    const val = raw[key];
    if (val === undefined) continue;

    if (key === "lastParishId") {
      if (val === null) {
        normalized[key] = null;
        hasValidField = true;
      } else {
        const num = typeof val === "number" ? val : Number(val);
        if (Number.isInteger(num) && num > 0) {
          normalized[key] = num;
          hasValidField = true;
        }
      }
    } else if (typeof val === "string" || val === null) {
      normalized[key] = val;
      hasValidField = true;
    }
  }

  return hasValidField ? normalized : null;
}

/**
 * Sends a query to Caloy via the backend /chatbot/query endpoint.
 * Firebase token authentication is handled automatically by apiClient.
 * ZERO userId is transmitted in the body; the server authorizes the token.
 * Uses a dedicated 32-second client deadline aligned with the backend 25s deadline + margin.
 */
export async function sendCaloyQuery(
  payload: CaloyQueryRequest,
  signal?: AbortSignal
): Promise<CaloyQueryResponse> {
  const trimmedQuestion = (payload.question || "").trim();
  if (!trimmedQuestion) {
    throw new AppError({
      kind: "VALIDATION",
      code: "EMPTY_QUESTION",
      message: "Please enter a question for Caloy.",
    });
  }

  const normalizedSessionId = isValidUuid(payload.sessionId)
    ? payload.sessionId
    : undefined;

  const normalizedParishId = normalizeSelectedParishId(payload.selectedParishId);
  const normalizedClarification = normalizeStructuredClarification(payload.structuredClarification);
  const normalizedContext = normalizeConversationContext(payload.conversationContext);

  const requestBody: Record<string, unknown> = {
    question: trimmedQuestion.slice(0, 1000),
    selectedParishId: normalizedParishId,
  };

  if (normalizedSessionId) {
    requestBody.sessionId = normalizedSessionId;
  }
  if (normalizedClarification) {
    requestBody.structuredClarification = normalizedClarification;
  }
  if (normalizedContext) {
    requestBody.conversationContext = normalizedContext;
  }

  try {
    const rawResponse = await apiClient.request<CaloyQueryResponse>({
      path: "/chatbot/query",
      method: "POST",
      body: requestBody,
      auth: true,
      signal,
      timeout: 32_000,
    });

    return normalizeCaloyResponse(rawResponse);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      if (error.kind === "VALIDATION" || error.status === 400) {
        throw new AppError({
          kind: "VALIDATION",
          code: error.code || "VALIDATION_FAILED",
          status: 400,
          validationErrors: error.validationErrors,
          message: "Caloy couldn't send that question. Please try again.",
        });
      }

      if (error.kind === "AUTH" || error.status === 401) {
        throw new AppError({
          kind: "AUTH",
          code: "UNAUTHORIZED",
          status: 401,
          message: "Your session has expired. Please sign in again to continue chatting with Caloy.",
        });
      }

      if (error.code === "CHATBOT_AI_LIMIT_REACHED") {
        const errorMsg = error.message || "";
        const isShortWindow =
          errorMsg.toLowerCase().includes("for now") ||
          errorMsg.toLowerCase().includes("few minutes");

        const message = isShortWindow
          ? "You have reached your question limit for now. Please try again in a few minutes or contact your parish office."
          : "You have reached your daily substantive question limit for Caloy. Please try again tomorrow or contact your parish office.";

        throw new AppError({
          kind: "RATE_LIMIT",
          code: "CHATBOT_AI_LIMIT_REACHED",
          status: 429,
          message,
        });
      }

      if (error.kind === "RATE_LIMIT" || error.code === "RATE_LIMITED" || error.status === 429) {
        throw new AppError({
          kind: "RATE_LIMIT",
          code: "RATE_LIMITED",
          status: 429,
          message: "Caloy is receiving many requests. Please wait a moment before sending another message.",
        });
      }

      if (error.code === "CHATBOT_UNAVAILABLE" || error.status === 503) {
        throw new AppError({
          kind: "SERVER",
          code: "CHATBOT_UNAVAILABLE",
          status: 503,
          message: "Caloy is temporarily unavailable. Please try again later or contact your parish office.",
        });
      }

      if (error.kind === "NETWORK") {
        throw new AppError({
          kind: "NETWORK",
          code: "NETWORK_ERROR",
          message: "Unable to connect to Caloy. Please check your internet connection.",
        });
      }

      throw error;
    }

    throw new AppError({
      kind: "UNKNOWN",
      message: "An unexpected error occurred while communicating with Caloy. Please try again.",
    });
  }
}
