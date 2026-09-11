import { client } from "../../api/client";
import type { IChatProvider, ChatResponse } from "../types";

export class ApiChatProvider implements IChatProvider {
  async sendMessage(
    question: string,
    selectedParishId?: number | null,
    sessionId?: string,
    structuredClarification?: any,
    conversationContext?: any
  ): Promise<ChatResponse> {
    const payload: {
      question: string;
      sessionId?: string;
      selectedParishId?: number;
      structuredClarification?: any;
      conversationContext?: any;
    } = {
      question: question.trim(),
    };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    if (selectedParishId && Number.isInteger(Number(selectedParishId)) && Number(selectedParishId) > 0) {
      payload.selectedParishId = Number(selectedParishId);
    }

    if (structuredClarification) {
      payload.structuredClarification = structuredClarification;
    }

    if (conversationContext) {
      payload.conversationContext = conversationContext;
    }

    const response = await client.post<ChatResponse>("/chatbot/query", payload);

    return {
      answer: response.answer,
      fallback: Boolean(response.fallback),
      fallbackReason: response.fallbackReason || null,
      sessionId: response.sessionId || sessionId,
      category: response.category || null,
      sources: Array.isArray(response.sources) ? response.sources : [],
      responseType: response.responseType,
      clarificationType: response.clarificationType,
      clarificationOptions: response.clarificationOptions,
      structuredClarification: response.structuredClarification,
      liveData: response.liveData,
      conversationContext: response.conversationContext,
    };
  }
}
