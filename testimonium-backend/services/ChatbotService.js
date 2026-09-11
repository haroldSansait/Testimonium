import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { RetrievalService } from "./RetrievalService.js";
import { ChatbotLogRepository } from "../repositories/ChatbotLogRepository.js";
import { getChatCompletionProvider } from "./ai/providerFactory.js";

const DEFAULT_FALLBACK_TEXT =
  "I don't have enough verified TESTIMONIUM information to confirm that. Please contact your parish office for assistance.";

export class ChatbotService {
  constructor({
    retrievalService = new RetrievalService(),
    logRepository = new ChatbotLogRepository(),
    chatProvider = null,
    prismaClient = prisma,
    isEnabled = null,
  } = {}) {
    this.retrievalService = retrievalService;
    this.logRepository = logRepository;
    this.getChatProvider = chatProvider ? () => chatProvider : getChatCompletionProvider;
    this.prisma = prismaClient;
    this.isEnabled = isEnabled !== null ? Boolean(isEnabled) : Boolean(env.chatbot?.enabled);
  }

  /**
   * Normalizes question text (collapses consecutive whitespace and control characters).
   */
  normalizeQuestion(text) {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Validates selected parish if provided.
   */
  async validateParish(parishId) {
    if (parishId === undefined || parishId === null) {
      return null;
    }

    const id = Number(parishId);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error("Invalid parish ID");
      err.statusCode = 400;
      err.code = "CHATBOT_INVALID_PARISH";
      throw err;
    }

    const parish = await this.prisma.parish.findUnique({
      where: { id },
      select: {
        id: true,
        parishName: true,
        isActive: true,
        contactNumber: true,
        email: true,
      },
    });

    if (!parish || !parish.isActive) {
      const err = new Error("Parish not found or is inactive");
      err.statusCode = 400;
      err.code = "CHATBOT_INVALID_PARISH";
      throw err;
    }

    return parish;
  }

  /**
   * Main query entrypoint.
   */
  async handleQuery({ question, sessionId = null, selectedParishId = null, userId = null }) {
    const startTime = Date.now();

    // 1. Feature flag guard
    if (!this.isEnabled) {
      const err = new Error("Caloy is currently unavailable. Please check back later.");
      err.statusCode = 503;
      err.code = "CHATBOT_UNAVAILABLE";
      throw err;
    }

    // 2. Normalize question
    const normalizedQuestion = this.normalizeQuestion(question);
    if (!normalizedQuestion) {
      const err = new Error("Question must not be empty or whitespace");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // 3. Validate optional parish
    const parish = await this.validateParish(selectedParishId);
    const effectiveParishId = parish ? parish.id : null;

    let retrievalResult;
    try {
      retrievalResult = await this.retrievalService.retrieveKnowledge({
        normalizedQuestion,
        selectedParishId: effectiveParishId,
      });
    } catch (err) {
      console.error(`[ChatbotService] Retrieval error: ${err.message}`);
      const safeErr = new Error("Failed to retrieve knowledge");
      safeErr.statusCode = 503;
      safeErr.code = err.code || "CHATBOT_RETRIEVAL_UNAVAILABLE";

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        fallback: true,
        fallbackReason: "RETRIEVAL_ERROR",
        latencyMs: Date.now() - startTime,
        errorCategory: safeErr.code,
      });

      throw safeErr;
    }

    const {
      candidates,
      hasSufficientEvidence,
      category,
      embeddingProvider,
      embeddingModel,
    } = retrievalResult;

    const retrievedChunkIds = candidates.map((c) => c.chunkId ?? c.id);
    const retrievalScores = candidates.map((c) => c.semanticScore);

    // 4. Evidence Gate: if no evidence or top candidate fails minimum similarity, DO NOT call LLM
    if (!hasSufficientEvidence || candidates.length === 0) {
      let fallbackAnswer = DEFAULT_FALLBACK_TEXT;
      if (parish) {
        const contactParts = [];
        if (parish.parishName) contactParts.push(parish.parishName);
        if (parish.contactNumber) contactParts.push(`Phone: ${parish.contactNumber}`);
        if (parish.email) contactParts.push(`Email: ${parish.email}`);
        if (contactParts.length > 0) {
          fallbackAnswer += ` (${contactParts.join(" | ")})`;
        }
      }

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        response: fallbackAnswer,
        retrievedChunkIds,
        retrievalScores,
        fallback: true,
        fallbackReason: "INSUFFICIENT_EVIDENCE",
        category,
        embeddingProvider,
        latencyMs: Date.now() - startTime,
      });

      return {
        answer: fallbackAnswer,
        fallback: true,
        fallbackReason: "INSUFFICIENT_EVIDENCE",
        sessionId,
        category: null,
        sources: [],
      };
    }

    // 5. Grounded Generation
    const chatProvider = this.getChatProvider();
    const evidencePayload = candidates.map((c) => ({
      id: c.chunkId ?? c.id,
      title: c.title,
      content: c.content,
      sourceReference: c.sourceReference || null,
      sourceType: c.sourceType || null,
    }));
    const suppliedChunkIdsSet = new Set(candidates.map((c) => Number(c.chunkId ?? c.id)));

    let generationResult;
    try {
      generationResult = await chatProvider.generateGroundedAnswer({
        question: normalizedQuestion,
        evidence: evidencePayload,
        maxOutputTokens: env.chatbot?.maxOutputTokens || 700,
      });
    } catch (err) {
      console.error(`[ChatbotService] Generation error: ${err.code || "UNKNOWN"}`);
      const safeErr = new Error("Failed to generate answer");
      safeErr.statusCode = 503;
      safeErr.code = err.code || "CHATBOT_GENERATION_UNAVAILABLE";

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        retrievedChunkIds,
        retrievalScores,
        fallback: true,
        fallbackReason: "GENERATION_ERROR",
        category,
        embeddingProvider,
        generationProvider: chatProvider.providerName,
        generationModel: chatProvider.modelName,
        latencyMs: Date.now() - startTime,
        errorCategory: safeErr.code,
      });

      throw safeErr;
    }

    // Helper for parish-formatted safe fallback
    const buildFallbackResponse = (reason = "INSUFFICIENT_EVIDENCE") => {
      let fallbackAnswer = DEFAULT_FALLBACK_TEXT;
      if (parish) {
        const contactParts = [];
        if (parish.parishName) contactParts.push(parish.parishName);
        if (parish.contactNumber) contactParts.push(`Phone: ${parish.contactNumber}`);
        if (parish.email) contactParts.push(`Email: ${parish.email}`);
        if (contactParts.length > 0) {
          fallbackAnswer += ` (${contactParts.join(" | ")})`;
        }
      }
      return {
        answer: fallbackAnswer,
        fallback: true,
        fallbackReason: reason,
        sessionId,
        category: null,
        sources: [],
      };
    };

    // 6. Handle model-reported insufficient evidence or empty text
    if (!generationResult.answer || !generationResult.answer.trim()) {
      const fallbackPayload = buildFallbackResponse("INSUFFICIENT_EVIDENCE");

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        response: fallbackPayload.answer,
        retrievedChunkIds,
        retrievalScores,
        fallback: true,
        fallbackReason: "INSUFFICIENT_EVIDENCE",
        category,
        embeddingProvider,
        generationProvider: chatProvider.providerName,
        generationModel: chatProvider.modelName,
        latencyMs: Date.now() - startTime,
      });

      return fallbackPayload;
    }

    // 7. Independent Service-Level Citation Invariant:
    // Every factual answer MUST have citedChunkIds.length >= 1
    // AND every citedChunkId must belong to the EXACT chunks actually supplied to generation.
    const citedIds = Array.isArray(generationResult.citedChunkIds)
      ? generationResult.citedChunkIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    const allCitationsValid =
      citedIds.length >= 1 && citedIds.every((id) => suppliedChunkIdsSet.has(id));

    if (!allCitationsValid) {
      // Discard unsupported answer -> return deterministic safe fallback
      const fallbackPayload = buildFallbackResponse("UNSUPPORTED_OR_MISSING_CITATIONS");

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        response: fallbackPayload.answer,
        retrievedChunkIds,
        retrievalScores,
        fallback: true,
        fallbackReason: "UNSUPPORTED_OR_MISSING_CITATIONS",
        category,
        embeddingProvider,
        generationProvider: chatProvider.providerName,
        generationModel: chatProvider.modelName,
        latencyMs: Date.now() - startTime,
      });

      return fallbackPayload;
    }

    // 8. Assemble verified cited sources
    const citedSet = new Set(citedIds);
    const citedSources = [];
    const seenSourceIds = new Set();

    for (const chunk of candidates) {
      const chunkId = Number(chunk.chunkId ?? chunk.id);
      if (citedSet.has(chunkId) && !seenSourceIds.has(chunk.sourceId)) {
        seenSourceIds.add(chunk.sourceId);
        citedSources.push({
          id: chunk.sourceId,
          title: chunk.title,
          sourceType: chunk.sourceType,
          sourceReference: chunk.sourceReference,
          authority: chunk.authority,
          scope: chunk.scope,
          parishId: chunk.parishId,
        });
      }
    }

    // Best-effort log
    await this.logRepository.logQuery({
      userId,
      sessionId,
      selectedParishId: effectiveParishId,
      question: normalizedQuestion,
      response: generationResult.answer,
      retrievedChunkIds,
      retrievalScores,
      fallback: false,
      category,
      embeddingProvider,
      generationProvider: chatProvider.providerName,
      generationModel: chatProvider.modelName,
      latencyMs: Date.now() - startTime,
    });

    // 9. Return safe public DTO (NO messageId, NO embeddings, NO raw scores)
    return {
      answer: generationResult.answer,
      fallback: false,
      fallbackReason: null,
      sessionId,
      category,
      sources: citedSources,
    };
  }
}
