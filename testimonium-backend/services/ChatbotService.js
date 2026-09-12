import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { RetrievalService } from "./RetrievalService.js";
import { ChatbotLogRepository } from "../repositories/ChatbotLogRepository.js";
import { getChatCompletionProvider, getSemanticRouter, getCaloyResponseComposer } from "./ai/providerFactory.js";
import { FakeSemanticRouter } from "./ai/FakeSemanticRouter.js";
import { detectTrivialSocial, detectSocialIntent, SOCIAL_RESPONSES } from "./ai/socialIntentClassifier.js";
import { LiveToolRouter } from "./ai/liveTools/LiveToolRouter.js";
import { LiveToolRegistry } from "./ai/liveTools/LiveToolRegistry.js";
import { TOOL_IDS } from "./ai/liveTools/liveToolSchemas.js";
import { defaultAiQuotaTracker } from "./ai/aiQuotaTracker.js";
import { defaultContextManager } from "./ai/ConversationContextManager.js";
import { sanitizeQuestionForModel } from "./ai/semanticValidationHelper.js";
import { sanitizeCitationMarkers } from "./ai/citationUtils.js";

const DEFAULT_FALLBACK_TEXT =
  "I don't have enough verified TESTIMONIUM information to confirm that. Please contact your parish office for assistance.";

const CHATBOT_REQUEST_DEADLINE_MS = 25000;

export class ChatbotService {
  constructor({
    retrievalService = new RetrievalService(),
    logRepository = null,
    chatProvider = null,
    prismaClient = prisma,
    isEnabled = null,
    liveToolRouter = null,
    semanticRouter = null,
    aiQuotaTracker = defaultAiQuotaTracker,
    contextManager = defaultContextManager,
    responseComposer = null,
  } = {}) {
    this.prisma = prismaClient;
    this.retrievalService = retrievalService;
    this.logRepository = logRepository || new ChatbotLogRepository(prismaClient);
    this.getChatProvider = chatProvider ? () => chatProvider : getChatCompletionProvider;
    this.isEnabled = isEnabled !== null ? Boolean(isEnabled) : Boolean(env.chatbot?.enabled);
    this.liveToolRouter =
      liveToolRouter || new LiveToolRouter({ registry: new LiveToolRegistry({ prismaClient }), prismaClient, responseComposer });
    this.semanticRouter =
      semanticRouter ||
      (chatProvider?.providerName === "fake" ? new FakeSemanticRouter() : getSemanticRouter());
    this.aiQuotaTracker = aiQuotaTracker;
    this.contextManager = contextManager;
    this.responseComposer = responseComposer || getCaloyResponseComposer();
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
   * Main query entrypoint (aliases: handleQuery, answerQuestion).
   */
  async answerQuestion(args) {
    return this.handleQuery(args);
  }

  async handleQuery({
    question,
    sessionId = null,
    selectedParishId = null,
    userId = null,
    structuredClarification = null,
    conversationContext = null,
  }) {
    const startTime = Date.now();
    const requestDeadline = startTime + CHATBOT_REQUEST_DEADLINE_MS;

    // 1. Feature flag guard
    if (!this.isEnabled) {
      const err = new Error("Caloy is currently unavailable. Please check back later.");
      err.statusCode = 503;
      err.code = "CHATBOT_UNAVAILABLE";
      throw err;
    }

    // 2. Normalize question
    const normalizedQuestion = this.normalizeQuestion(question);
    if (!normalizedQuestion && !structuredClarification) {
      const err = new Error("Question must not be empty or whitespace");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // 3. Zero-cost optimization ONLY for unambiguous, trivial single-purpose greetings/thanks
    // NOTE: Runs BEFORE validateParish so greetings work even if selectedParishId in storage is stale or invalid!
    const trivialSocial = detectTrivialSocial(normalizedQuestion);
    if (trivialSocial) {
      const updatedCtx = this.contextManager.updateContext(sessionId, {
        lastResponseType: "SOCIAL",
      });

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: null,
        question: normalizedQuestion,
        response: trivialSocial.answer,
        fallback: false,
        category: "SOCIAL",
        latencyMs: Date.now() - startTime,
      });

      return {
        answer: trivialSocial.answer,
        fallback: false,
        fallbackReason: null,
        sessionId,
        category: "SOCIAL",
        responseType: "SOCIAL",
        sources: [],
        conversationContext: updatedCtx,
      };
    }

    // 4. Validate optional parish for operational routes
    const parish = await this.validateParish(selectedParishId);
    const effectiveParishId = parish ? parish.id : null;

    // 5. UI Continuation Fast Path (0 Gemini calls, 0 AI Quota)
    // Structured inline selector button submissions are protocol actions, NOT natural language.
    // If the user typed natural text instead of clicking a button, route through semantic interpretation!
    const isExplicitButtonSelection = Boolean(
      structuredClarification &&
      (structuredClarification.isButtonSelection ||
       structuredClarification.selectedValue !== undefined ||
       structuredClarification.choice !== undefined ||
       !normalizedQuestion)
    );

    if (
      isExplicitButtonSelection &&
      (structuredClarification.toolId || structuredClarification.originalIntent) &&
      this.liveToolRouter
    ) {
      const safeContext = this.contextManager.getContext(sessionId, conversationContext);
      const liveResult = await this.liveToolRouter.validateAndExecute({
        structuredClarification,
        normalizedQuestion,
        selectedParishId: effectiveParishId,
        userId,
        conversationContext: safeContext,
        deadline: requestDeadline,
      });

      if (liveResult) {
        let updatedCtx = safeContext;
        if (liveResult.responseType === "LIVE_DATA") {
          updatedCtx = this.contextManager.updateContext(sessionId, {
            lastIntent: liveResult.executedParams?.intentId || structuredClarification.toolId || structuredClarification.originalIntent,
            lastParishId: liveResult.executedParams?.parishId || effectiveParishId,
            lastParishName: liveResult.executedParams?.parishName || null,
            lastDocumentType: liveResult.executedParams?.documentType || null,
            lastScheduleEvent: liveResult.executedParams?.eventType || null,
            lastDatePhrase: liveResult.executedParams?.date || null,
            lastTimePhrase: liveResult.executedParams?.timeSlot || null,
            lastPriestName: liveResult.executedParams?.priestName || null,
            lastPriestId: liveResult.executedParams?.priestId || null,
            lastVicariateName: liveResult.liveData?.vicariate || safeContext.lastVicariateName || null,
            lastResponseType: "LIVE_DATA",
            pendingClarificationIntent: null,
            pendingMissingParam: null,
            pendingCollected: null,
          });
        } else if (liveResult.responseType === "CLARIFICATION") {
          updatedCtx = this.contextManager.updateContext(sessionId, {
            lastIntent: liveResult.structuredClarification?.toolId || structuredClarification.toolId || structuredClarification.originalIntent,
            lastParishId: liveResult.structuredClarification?.collected?.parishId || effectiveParishId,
            lastParishName: liveResult.structuredClarification?.collected?.parishName || safeContext.lastParishName || null,
            lastDocumentType: liveResult.structuredClarification?.collected?.documentType || null,
            lastScheduleEvent: liveResult.structuredClarification?.collected?.eventType || null,
            lastDatePhrase: liveResult.structuredClarification?.collected?.date || null,
            lastTimePhrase: liveResult.structuredClarification?.collected?.timeSlot || null,
            lastPriestName: liveResult.structuredClarification?.collected?.priestName || null,
            lastPriestId: liveResult.structuredClarification?.collected?.priestId || null,
            lastVicariateName: safeContext.lastVicariateName || null,
            lastResponseType: "CLARIFICATION",
            pendingClarificationIntent: liveResult.structuredClarification?.toolId || structuredClarification.toolId,
            pendingMissingParam: liveResult.structuredClarification?.missing || liveResult.clarificationType || null,
            pendingCollected: liveResult.structuredClarification?.collected || {},
          });
        } else {
          updatedCtx = this.contextManager.updateContext(sessionId, {
            lastIntent: liveResult.executedParams?.intentId || structuredClarification.toolId || structuredClarification.originalIntent,
            lastParishId: liveResult.executedParams?.parishId || effectiveParishId,
            lastParishName: liveResult.executedParams?.parishName || null,
            lastDocumentType: liveResult.executedParams?.documentType || null,
            lastScheduleEvent: liveResult.executedParams?.eventType || null,
            lastDatePhrase: liveResult.executedParams?.date || null,
            lastTimePhrase: liveResult.executedParams?.timeSlot || null,
            lastPriestName: liveResult.executedParams?.priestName || null,
            lastPriestId: liveResult.executedParams?.priestId || null,
            lastVicariateName: liveResult.liveData?.vicariate || safeContext.lastVicariateName || null,
            lastResponseType: liveResult.responseType,
          });
        }

        await this.logRepository.logQuery({
          userId,
          sessionId,
          selectedParishId: effectiveParishId,
          question: normalizedQuestion,
          response: liveResult.answer,
          fallback: Boolean(liveResult.fallback),
          fallbackReason: liveResult.fallbackReason || null,
          category: liveResult.category || "LIVE_DATA",
          latencyMs: Date.now() - startTime,
          errorCategory: liveResult.fallbackReason || null,
        });

        return {
          ...liveResult,
          sessionId,
          conversationContext: updatedCtx,
        };
      }
    }

    // 6. Safe Conversational Context
    const safeContext = this.contextManager.getContext(sessionId, conversationContext);
    if (structuredClarification && (structuredClarification.toolId || structuredClarification.originalIntent)) {
      safeContext.pendingClarificationIntent = structuredClarification.toolId || structuredClarification.originalIntent;
      safeContext.pendingMissingParam = structuredClarification.missing || structuredClarification.nextRequired || null;
      safeContext.pendingCollected = structuredClarification.collected || null;
    }

    // 7. Sensitive Message Sanitization (extract tracking numbers locally before model call)
    const sanitizedQuestion = sanitizeQuestionForModel(normalizedQuestion);

    // 8. AI Quota Check (Semantic Router Gemini call IS an AI call!)
    if (this.aiQuotaTracker) {
      const quotaKey = userId || sessionId || "anonymous";
      const quotaCheck = this.aiQuotaTracker.consume(quotaKey);
      if (!quotaCheck.allowed) {
        const safeErr = new Error(quotaCheck.message);
        safeErr.statusCode = 429;
        safeErr.code = quotaCheck.code || "CHATBOT_AI_LIMIT_REACHED";
        safeErr.retryAfter = quotaCheck.retryAfter;

        await this.logRepository.logQuery({
          userId,
          sessionId,
          selectedParishId: effectiveParishId,
          question: normalizedQuestion,
          fallback: true,
          fallbackReason: safeErr.code,
          latencyMs: Date.now() - startTime,
          errorCategory: safeErr.code,
        });

        throw safeErr;
      }
    }

    // 9. Semantic Interpretation Layer (Gemini gemini-3.5-flash-lite)
    let interpretation;
    try {
      interpretation = await this.semanticRouter.interpret({
        sanitizedQuestion,
        conversationContext: safeContext,
        selectedParishName: parish ? parish.parishName : null,
      });
    } catch (err) {
      console.error(`[ChatbotService] Semantic routing error: ${err.message}`);
      // Fall back to RAG on transient model error
      interpretation = {
        route: "RAG",
        intent: null,
        entities: { parishName: null, documentType: null, scheduleEvent: null, datePhrase: null, trackingNumberPresent: false },
        usesPreviousContext: false,
      };
    }

    // 10. Route Dispatch & Authoritative Backend Validation
    const socialCheck = detectSocialIntent(normalizedQuestion);
    if (socialCheck?.intent === "WHO_ARE_YOU" || socialCheck?.intent === "HOW_ARE_YOU" || socialCheck?.intent === "DECLINE_OR_CLOSE") {
      interpretation.route = "SOCIAL";
      interpretation.intent = socialCheck.intent;
    }

    // 10A. SOCIAL
    if (interpretation.route === "SOCIAL") {
      const socialIntent = interpretation.intent || socialCheck?.intent;

      let answer = SOCIAL_RESPONSES.GREETING;
      if (socialIntent === "THANKS") {
        answer = SOCIAL_RESPONSES.THANKS;
      } else if (socialIntent === "DECLINE_OR_CLOSE") {
        answer = SOCIAL_RESPONSES.DECLINE_OR_CLOSE;
      } else if (socialIntent === "GOODBYE") {
        answer = SOCIAL_RESPONSES.GOODBYE;
      } else if (socialIntent === "WHO_ARE_YOU" || socialIntent === "HOW_ARE_YOU") {
        const defaultAnswer = socialIntent === "WHO_ARE_YOU"
          ? SOCIAL_RESPONSES.WHO_ARE_YOU
          : SOCIAL_RESPONSES.HOW_ARE_YOU;

        const composer = this.responseComposer || getCaloyResponseComposer();
        const hasComposerBudget = Date.now() + 3000 <= requestDeadline;
        if (composer && hasComposerBudget) {
          try {
            const compResult = await composer.compose({
              responseType: socialIntent,
              structuredFacts: null,
              conversationContext: safeContext,
              capabilityHints: [
                TOOL_IDS.GET_ACTIVE_PARISHES,
                TOOL_IDS.GET_PARISH_DOCUMENTS,
                TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
              ],
              userMessage: normalizedQuestion,
              fallbackAnswer: defaultAnswer,
            });
            answer = compResult.answer || defaultAnswer;
          } catch (compErr) {
            console.warn(`[ChatbotService] Personality composer error (${socialIntent}), falling back: ${compErr.message}`);
            answer = defaultAnswer;
          }
        } else {
          answer = defaultAnswer;
        }
      }

      const updatedCtx = this.contextManager.updateContext(sessionId, {
        lastResponseType: "SOCIAL",
      });

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: null,
        question: normalizedQuestion,
        response: answer,
        fallback: false,
        category: "SOCIAL",
        latencyMs: Date.now() - startTime,
      });

      return {
        answer,
        fallback: false,
        fallbackReason: null,
        sessionId,
        category: "SOCIAL",
        responseType: "SOCIAL",
        sources: [],
        conversationContext: updatedCtx,
      };
    }

    // 10B. CAPABILITIES
    if (interpretation.route === "CAPABILITIES") {
      const answer = SOCIAL_RESPONSES.CAPABILITIES;
      const updatedCtx = this.contextManager.updateContext(sessionId, {
        lastResponseType: "SOCIAL",
      });

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: null,
        question: normalizedQuestion,
        response: answer,
        fallback: false,
        category: "SOCIAL",
        latencyMs: Date.now() - startTime,
      });

      return {
        answer,
        fallback: false,
        fallbackReason: null,
        sessionId,
        category: "SOCIAL",
        responseType: "SOCIAL",
        sources: [],
        conversationContext: updatedCtx,
      };
    }

    // 10C. OUT_OF_SCOPE
    if (interpretation.route === "OUT_OF_SCOPE") {
      const answer = SOCIAL_RESPONSES.OUT_OF_SCOPE_CASUAL;
      const updatedCtx = this.contextManager.updateContext(sessionId, {
        lastResponseType: "SOCIAL",
      });

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: null,
        question: normalizedQuestion,
        response: answer,
        fallback: false,
        category: "SOCIAL",
        latencyMs: Date.now() - startTime,
      });

      return {
        answer,
        fallback: false,
        fallbackReason: null,
        sessionId,
        category: "SOCIAL",
        responseType: "SOCIAL",
        sources: [],
        conversationContext: updatedCtx,
      };
    }

    // 10D. LIVE_TOOL
    if (interpretation.route === "LIVE_TOOL" && this.liveToolRouter) {
      // If user started a NEW_TOPIC, clear stale scheduling/intent context while preserving stable parish context
      if (interpretation.pendingRelation === "NEW_TOPIC") {
        safeContext.pendingClarificationIntent = null;
        safeContext.pendingMissingParam = null;
        safeContext.pendingCollected = null;
        safeContext.lastScheduleEvent = null;
        safeContext.lastDatePhrase = null;
        safeContext.lastTimePhrase = null;
        safeContext.lastPriestName = null;
        safeContext.lastPriestId = null;
        safeContext.lastDocumentType = null;
        structuredClarification = null;
      } else if (interpretation.pendingRelation === "ANSWER_PENDING" && safeContext.pendingClarificationIntent) {
        // User answered pending clarification: restore pending intent and merge collected parameters
        interpretation.intent = safeContext.pendingClarificationIntent;
        if (safeContext.pendingCollected) {
          interpretation.entities = {
            ...safeContext.pendingCollected,
            ...interpretation.entities,
            ...(interpretation.entities?.parishName ? { parishName: interpretation.entities.parishName } : {}),
            ...(interpretation.entities?.datePhrase ? { datePhrase: interpretation.entities.datePhrase } : {}),
            ...(interpretation.entities?.scheduleEvent ? { scheduleEvent: interpretation.entities.scheduleEvent } : {}),
            ...(interpretation.entities?.documentType ? { documentType: interpretation.entities.documentType } : {}),
            ...(interpretation.entities?.timePhrase ? { timePhrase: interpretation.entities.timePhrase } : {}),
            ...(interpretation.entities?.priestName ? { priestName: interpretation.entities.priestName } : {}),
          };
        }
      }

      const liveResult = await this.liveToolRouter.validateAndExecute({
        semanticProposal: interpretation,
        normalizedQuestion,
        selectedParishId: effectiveParishId,
        userId,
        conversationContext: safeContext,
        structuredClarification: structuredClarification || (safeContext.pendingClarificationIntent ? { toolId: safeContext.pendingClarificationIntent, collected: safeContext.pendingCollected } : null),
        deadline: requestDeadline,
      });

      if (liveResult) {
        let updatedCtx = safeContext;
        if (liveResult.responseType === "LIVE_DATA") {
          updatedCtx = this.contextManager.updateContext(sessionId, {
            lastIntent: interpretation.intent,
            lastParishId: liveResult.executedParams?.parishId || effectiveParishId,
            lastParishName: liveResult.executedParams?.parishName || null,
            lastDocumentType: liveResult.executedParams?.documentType || null,
            lastScheduleEvent: liveResult.executedParams?.eventType || null,
            lastDatePhrase: liveResult.executedParams?.date || null,
            lastTimePhrase: liveResult.executedParams?.timeSlot || null,
            lastPriestName: liveResult.executedParams?.priestName || null,
            lastPriestId: liveResult.executedParams?.priestId || null,
            lastVicariateName: liveResult.liveData?.vicariate || safeContext.lastVicariateName || null,
            lastResponseType: "LIVE_DATA",
            pendingClarificationIntent: null,
            pendingMissingParam: null,
            pendingCollected: null,
          });
        } else if (liveResult.responseType === "CLARIFICATION") {
          updatedCtx = this.contextManager.updateContext(sessionId, {
            lastIntent: liveResult.structuredClarification?.toolId || interpretation.intent,
            lastParishId: liveResult.structuredClarification?.collected?.parishId || effectiveParishId,
            lastParishName: liveResult.structuredClarification?.collected?.parishName || safeContext.lastParishName || null,
            lastDocumentType: liveResult.structuredClarification?.collected?.documentType || null,
            lastScheduleEvent: liveResult.structuredClarification?.collected?.eventType || null,
            lastDatePhrase: liveResult.structuredClarification?.collected?.date || null,
            lastTimePhrase: liveResult.structuredClarification?.collected?.timeSlot || null,
            lastPriestName: liveResult.structuredClarification?.collected?.priestName || null,
            lastPriestId: liveResult.structuredClarification?.collected?.priestId || null,
            lastVicariateName: safeContext.lastVicariateName || null,
            lastResponseType: "CLARIFICATION",
            pendingClarificationIntent: liveResult.structuredClarification?.toolId || interpretation.intent,
            pendingMissingParam: liveResult.structuredClarification?.missing || liveResult.clarificationType || null,
            pendingCollected: liveResult.structuredClarification?.collected || {},
          });
        }

        await this.logRepository.logQuery({
          userId,
          sessionId,
          selectedParishId: effectiveParishId,
          question: normalizedQuestion,
          response: liveResult.answer,
          fallback: Boolean(liveResult.fallback),
          fallbackReason: liveResult.fallbackReason || null,
          category: liveResult.category || "LIVE_DATA",
          latencyMs: Date.now() - startTime,
          errorCategory: liveResult.fallbackReason || null,
        });

        return {
          ...liveResult,
          sessionId,
          conversationContext: updatedCtx,
        };
      }
    }

    // 10E. RAG Pipeline (Procedural and general platform knowledge)
    // Explicit topic change: previous scheduling/document intent is cleared
    const updatedCtx = this.contextManager.updateContext(sessionId, {
      lastIntent: null,
      lastScheduleEvent: null,
      lastDatePhrase: null,
      lastTimePhrase: null,
      lastPriestName: null,
      lastPriestId: null,
      lastResponseType: "RAG",
    });

    // Check remaining deadline budget before RAG retrieval
    if (Date.now() + 3000 > requestDeadline) {
      return buildFallbackResponse("DEADLINE_EXHAUSTED");
    }

    let retrievalResult;
    try {
      retrievalResult = await this.retrievalService.retrieveKnowledge({
        normalizedQuestion,
        selectedParishId: effectiveParishId,
      });
    } catch (err) {
      console.error(`[ChatbotService] Retrieval error: ${err.message}`);
      const isProvider429 =
        err.status === 429 ||
        err.statusCode === 429 ||
        err.code === "RESOURCE_EXHAUSTED" ||
        err.code === "AI_PROVIDER_RATE_LIMITED" ||
        String(err.message || "").toLowerCase().includes("quota") ||
        String(err.message || "").toLowerCase().includes("rate limit");

      const safeErr = new Error(
        isProvider429
          ? "Caloy's AI service is temporarily at its usage limit. Please try again later."
          : "Failed to retrieve knowledge"
      );
      safeErr.statusCode = isProvider429 ? 429 : 503;
      safeErr.code = isProvider429 ? "AI_PROVIDER_RATE_LIMITED" : (err.code || "CHATBOT_RETRIEVAL_UNAVAILABLE");

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        fallback: true,
        fallbackReason: safeErr.code,
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

    // Evidence Gate: if no evidence or top candidate fails minimum similarity, DO NOT call LLM
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
        responseType: "FALLBACK",
        sessionId,
        category: null,
        sources: [],
        conversationContext: updatedCtx,
        diagnostics: {
          route: "RAG",
          retrievedChunkIds,
          retrievalScores,
          hasSufficientEvidence,
          fallbackReason: "INSUFFICIENT_EVIDENCE",
        },
      };
    }

    // Grounded Generation
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
      const isProvider429 =
        err.status === 429 ||
        err.statusCode === 429 ||
        err.code === "RESOURCE_EXHAUSTED" ||
        err.code === "AI_PROVIDER_RATE_LIMITED" ||
        String(err.message || "").toLowerCase().includes("quota") ||
        String(err.message || "").toLowerCase().includes("rate limit");

      const safeErr = new Error(
        isProvider429
          ? "Caloy's AI service is temporarily at its usage limit. Please try again later."
          : "Failed to generate answer"
      );
      safeErr.statusCode = isProvider429 ? 429 : 503;
      safeErr.code = isProvider429 ? "AI_PROVIDER_RATE_LIMITED" : (err.code || "CHATBOT_GENERATION_UNAVAILABLE");

      await this.logRepository.logQuery({
        userId,
        sessionId,
        selectedParishId: effectiveParishId,
        question: normalizedQuestion,
        retrievedChunkIds,
        retrievalScores,
        fallback: true,
        fallbackReason: safeErr.code,
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
        responseType: "FALLBACK",
        sessionId,
        category: null,
        sources: [],
        conversationContext: updatedCtx,
        diagnostics: {
          route: "RAG",
          retrievedChunkIds,
          retrievalScores,
          hasSufficientEvidence,
          fallbackReason: reason,
        },
      };
    };

    // Handle model-reported insufficient evidence or empty text
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

    // Independent Service-Level Citation Invariant
    const citedIds = Array.isArray(generationResult.citedChunkIds)
      ? generationResult.citedChunkIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    const allCitationsValid =
      citedIds.length >= 1 && citedIds.every((id) => suppliedChunkIdsSet.has(id));

    if (!allCitationsValid) {
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

    // Assemble verified cited sources
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

    const cleanAnswer = sanitizeCitationMarkers(generationResult.answer);

    // Log successful query
    await this.logRepository.logQuery({
      userId,
      sessionId,
      selectedParishId: effectiveParishId,
      question: normalizedQuestion,
      response: cleanAnswer,
      retrievedChunkIds,
      retrievalScores,
      fallback: false,
      category,
      embeddingProvider,
      generationProvider: chatProvider.providerName,
      generationModel: chatProvider.modelName,
      latencyMs: Date.now() - startTime,
    });

    // Return safe public DTO
    return {
      answer: cleanAnswer,
      fallback: false,
      fallbackReason: null,
      responseType: "RAG",
      sessionId,
      category,
      sources: citedSources,
      conversationContext: updatedCtx,
      diagnostics: {
        route: "RAG",
        retrievedChunkIds,
        retrievalScores,
        hasSufficientEvidence,
        fallbackReason: null,
      },
    };
  }
}
