import { apiClient } from "@/services/api/client";
import { AppError } from "@/services/api/errors";
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
 * Sends a query to Caloy via the backend /chatbot/query endpoint.
 * Firebase token authentication is handled automatically by apiClient.
 * ZERO userId is transmitted in the body; the server authorizes the token.
 * Uses a dedicated 32-second client deadline aligned with the backend 25s deadline + margin.
 */
export async function sendCaloyQuery(
  payload: CaloyQueryRequest,
  signal?: AbortSignal
): Promise<CaloyQueryResponse> {
  try {
    const rawResponse = await apiClient.request<CaloyQueryResponse>({
      path: "/chatbot/query",
      method: "POST",
      body: {
        question: payload.question,
        sessionId: payload.sessionId || undefined,
        selectedParishId: payload.selectedParishId || undefined,
        structuredClarification: payload.structuredClarification || undefined,
        conversationContext: payload.conversationContext || undefined,
      },
      auth: true,
      signal,
      timeout: 32_000,
    });

    return normalizeCaloyResponse(rawResponse);
  } catch (error: unknown) {
    if (error instanceof AppError) {
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
          message,
        });
      }

      if (error.kind === "RATE_LIMIT" || error.code === "RATE_LIMITED") {
        throw new AppError({
          kind: "RATE_LIMIT",
          code: "RATE_LIMITED",
          message: "Caloy is receiving many requests. Please wait a moment before sending another message.",
        });
      }

      if (error.code === "CHATBOT_UNAVAILABLE" || error.status === 503) {
        throw new AppError({
          kind: "SERVER",
          code: "CHATBOT_UNAVAILABLE",
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
