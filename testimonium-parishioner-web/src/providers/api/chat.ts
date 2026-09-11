import { client } from "../../api/client";
import type { IChatProvider, ChatResponse } from "../types";

export class ApiChatProvider implements IChatProvider {
  async sendMessage(
    question: string,
    selectedParishId?: number | null,
    sessionId?: string
  ): Promise<ChatResponse> {
    const payload: {
      question: string;
      sessionId?: string;
      selectedParishId?: number;
    } = {
      question: question.trim(),
    };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    if (selectedParishId && Number.isInteger(Number(selectedParishId)) && Number(selectedParishId) > 0) {
      payload.selectedParishId = Number(selectedParishId);
    }

    const response = await client.post<ChatResponse>("/chatbot/query", payload);

    return {
      answer: response.answer,
      fallback: Boolean(response.fallback),
      fallbackReason: response.fallbackReason || null,
      sessionId: response.sessionId || sessionId,
      category: response.category || null,
      sources: Array.isArray(response.sources) ? response.sources : [],
    };
  }
}
