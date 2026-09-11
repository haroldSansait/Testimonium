import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

export class ChatbotLogRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Best-effort persistence of chatbot telemetry.
   * Never throws or fails the parent query flow.
   *
   * @param {object} logData
   */
  async logQuery(logData) {
    try {
      const logRaw = Boolean(env.chatbot?.logRawText);

      await this.prisma.chatbotLog.create({
        data: {
          userId: logData.userId ? Number(logData.userId) : null,
          sessionId: logData.sessionId ? String(logData.sessionId).slice(0, 100) : null,
          selectedParishId: logData.selectedParishId ? Number(logData.selectedParishId) : null,
          question: logRaw && logData.question ? String(logData.question) : null,
          response: logRaw && logData.response ? String(logData.response) : null,
          retrievedChunkIds: Array.isArray(logData.retrievedChunkIds)
            ? logData.retrievedChunkIds.map(Number)
            : [],
          retrievalScores: Array.isArray(logData.retrievalScores)
            ? logData.retrievalScores.map(Number)
            : [],
          fallback: Boolean(logData.fallback),
          fallbackReason: logData.fallbackReason ? String(logData.fallbackReason).slice(0, 100) : null,
          category: logData.category ? String(logData.category).slice(0, 100) : null,
          embeddingProvider: logData.embeddingProvider
            ? String(logData.embeddingProvider).slice(0, 50)
            : null,
          generationProvider: logData.generationProvider
            ? String(logData.generationProvider).slice(0, 50)
            : null,
          generationModel: logData.generationModel
            ? String(logData.generationModel).slice(0, 100)
            : null,
          latencyMs: logData.latencyMs ? Number(logData.latencyMs) : null,
          errorCategory: logData.errorCategory
            ? String(logData.errorCategory).slice(0, 100)
            : null,
        },
      });
    } catch (err) {
      // Best-effort: log warning and swallow error to protect user request
      console.warn(`[ChatbotLogRepository] Failed to write chatbot log: ${err.message}`);
    }
  }
}
