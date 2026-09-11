import { TOOL_IDS, TOOL_DEFINITIONS } from "./liveToolSchemas.js";
import { LiveToolRegistry } from "./LiveToolRegistry.js";
import { CANONICAL_DOCUMENT_TYPES } from "../../../config/documents.js";
import { getManilaDateString } from "../../ConflictHelper.js";
import {
  extractTrackingNumber,
  resolveParish,
  resolveDocumentType,
  resolveScheduleEventType,
  resolveManilaDate,
} from "../semanticValidationHelper.js";

// Canonical schedule events for clarification dropdowns
const EVENT_SYNONYMS = [
  { type: "WEDDING" },
  { type: "BAPTISM" },
  { type: "CONFIRMATION" },
  { type: "FUNERAL" },
  { type: "WAKE_MASS" },
  { type: "BLESSING" },
  { type: "MASS_INTENTION" },
  { type: "FIRST_COMMUNION" },
  { type: "CONFESSION" },
  { type: "ANOINTING_OF_THE_SICK" },
];

export class LiveToolRouter {
  constructor({ registry = null, prismaClient = null } = {}) {
    this.registry = registry || new LiveToolRegistry({ prismaClient });
    this.prisma = prismaClient || this.registry.prisma;
    this.cachedParishes = null;
    this.cachedParishesAt = 0;
  }

  /**
   * Loads active parishes from DB (cached for 2 minutes).
   */
  async getActiveParishes() {
    const now = Date.now();
    if (this.cachedParishes && now - this.cachedParishesAt < 120000) {
      return this.cachedParishes;
    }

    if (!this.prisma?.parish?.findMany) {
      return [];
    }

    try {
      const parishes = await this.prisma.parish.findMany({
        where: { isActive: true },
        select: { id: true, parishName: true },
      });
      this.cachedParishes = parishes;
      this.cachedParishesAt = now;
      return parishes;
    } catch {
      return this.cachedParishes || [];
    }
  }

  /**
   * Helper: extract canonical document type from text (for fallback / standalone use)
   */
  extractDocumentType(text) {
    const res = resolveDocumentType(text);
    return res.isSupported ? res.documentType : null;
  }

  /**
   * Helper: extract canonical schedule event type from text (for fallback / standalone use)
   */
  extractEventType(text) {
    return resolveScheduleEventType(text);
  }

  /**
   * Helper: extract tracking number from text
   */
  extractTrackingNumber(text) {
    return extractTrackingNumber(text);
  }

  /**
   * Helper: extract date in Asia/Manila context (YYYY-MM-DD)
   */
  extractDate(text) {
    return resolveManilaDate(text);
  }

  /**
   * Deterministic identifier-based fallback classification.
   * Only used if no semantic proposal is supplied (e.g. in direct unit tests).
   */
  classifyIntent(normalizedText) {
    if (!normalizedText || typeof normalizedText !== "string") return null;
    const text = normalizedText.trim();
    const lower = text.toLowerCase();

    // 1. Specific tracking number
    const tracking = this.extractTrackingNumber(text);
    if (tracking) {
      if (/\b(payment|paid|gcash|receipt|verify|verified|fee)\b/i.test(lower)) {
        return { toolId: TOOL_IDS.CHECK_MY_PAYMENT_STATUS, trackingNumber: tracking };
      }
      return { toolId: TOOL_IDS.CHECK_MY_REQUEST_STATUS, trackingNumber: tracking };
    }

    // 2. Personal Payment Status
    const isGeneralPaymentQuestion = /\b(how\s+(does|do|can)\s+.*(payment|verification|verify|work|upload)|how\s+to\s+pay|where\s+to\s+pay|payment\s+instructions)\b/i.test(lower);
    if (!isGeneralPaymentQuestion) {
      const isPersonalPayment = /\b(is\s+my\s+payment\s+(verified|approved|confirmed|received)|has\s+my\s+payment\s+been\s+(verified|approved)|did\s+my\s+(gcash|payment|proof)\s+go\s+through|status\s+of\s+my\s+payment|my\s+payment\s+status|why\s+is\s+my\s+payment\s+still\s+pending)\b/i.test(lower);
      if (isPersonalPayment) {
        return { toolId: TOOL_IDS.CHECK_MY_PAYMENT_STATUS };
      }
    }

    // 3. Personal Request Status
    const isGeneralRequestProcedure = /\b(how\s+(do|can)\s+i\s+request|how\s+to\s+request|steps\s+to\s+request|process\s+to\s+request|can\s+i\s+request)\b/i.test(lower);
    if (!isGeneralRequestProcedure) {
      const isPersonalRequest = /\b(is\s+my\s+(request|certificate|cert|document)\s+(ready|done|approved|finished|available)|what('s|\s+is)\s+the\s+status\s+of\s+my\s+request|status\s+of\s+my\s+(request|application|cert|certificate)|track\s+my\s+request|check\s+my\s+request|my\s+request\s+status)\b/i.test(lower);
      if (isPersonalRequest) {
        return { toolId: TOOL_IDS.CHECK_MY_REQUEST_STATUS };
      }
    }

    // 4. Personal Upcoming Schedules
    const isGeneralScheduling = /\b(how\s+(does|do|can)\s+.*(scheduling|schedule|work)|how\s+to\s+schedule|policy\s+on\s+scheduling)\b/i.test(lower);
    if (!isGeneralScheduling) {
      const isPersonalSchedule = /\b(when\s+is\s+my\s+(wedding|baptism|appointment|schedule)|what\s+appointments\s+do\s+i\s+have|my\s+upcoming\s+schedule|my\s+upcoming\s+appointments|do\s+i\s+have\s+any\s+upcoming)\b/i.test(lower);
      if (isPersonalSchedule) {
        return { toolId: TOOL_IDS.GET_MY_UPCOMING_SCHEDULES };
      }
    }

    // 5. Active Parish Priests
    const isPriestPolicy = /\b(can\s+i\s+(choose|request|pick)\s+a\s+preferred\s+priest|who\s+assigns\s+the\s+priest|preferred\s+priest\s+policy)\b/i.test(lower);
    if (!isPriestPolicy) {
      const isPriestDirectory = /\b(who\s+(are|is)\s+the\s+(priests|priest|clergy|pastor|parish\s+priest)|active\s+priests|priests\s+assigned|priests\s+at|clergy\s+assigned)\b/i.test(lower);
      if (isPriestDirectory) {
        return { toolId: TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS };
      }
    }

    // 6. Parish Document Fee / Cost
    const isFeeQuestion = /\b(how\s+much\s+(is|does|are|for)|fee|fees|cost|costs|price|pricing|stipend)\b/i.test(lower);
    if (isFeeQuestion) {
      return { toolId: TOOL_IDS.GET_DOCUMENT_FEE };
    }

    // 7. Parish Document Requirements
    const isRequirementQuestion = /\b(requirements\s+for|what\s+do\s+i\s+need\s+for|what\s+are\s+the\s+requirements|document\s+requirements)\b/i.test(lower);
    if (isRequirementQuestion) {
      const docType = this.extractDocumentType(text);
      if (docType) {
        return { toolId: TOOL_IDS.GET_DOCUMENT_REQUIREMENTS, documentType: docType };
      }
    }

    // 8. Available Documents at Parish
    const isGeneralPlatformDocs = /\b(what\s+documents\s+does\s+testimonium\s+support|what\s+can\s+i\s+request\s+on\s+testimonium)\b/i.test(lower);
    if (!isGeneralPlatformDocs) {
      const isParishDocs = /\b(available\s+documents|what\s+documents\s+(are\s+available|do\s+you\s+offer|does\s+.*offer)|offered\s+documents|list\s+of\s+documents)\b/i.test(lower);
      if (isParishDocs) {
        return { toolId: TOOL_IDS.GET_PARISH_DOCUMENTS };
      }
    }

    // 9. Parish Office Info
    const isOfficeInfo = /\b(office\s+hours|what\s+time\s+(does|is)\s+(the\s+)?(parish\s+)?office|contact\s+number|phone\s+number|email\s+address|where\s+is\s+the\s+parish\s+office)\b/i.test(lower);
    if (isOfficeInfo) {
      return { toolId: TOOL_IDS.GET_PARISH_OFFICE_INFO };
    }

    // 10. Calendar Slot Availability
    const isSlotAvailability = /\b(what\s+slots\s+are\s+available|available\s+slots|open\s+slots|available\s+schedules|available\s+schedule|slots\s+tomorrow|slots\s+on|can\s+i\s+book\s+at)\b/i.test(lower);
    if (isSlotAvailability) {
      return { toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY };
    }

    return null;
  }

  /**
   * Pure routing analysis (returns tool intent and parameter completeness without executing).
   * Supports both explicit semantic proposal and fallback classifier.
   */
  route({
    question,
    selectedParishId = null,
    userId = null,
    structuredClarification = null,
    semanticProposal = null,
  } = {}) {
    const text = (question || "").trim();
    if (!text && !structuredClarification && !semanticProposal) return null;

    let intent = null;
    let collected = {};

    if (structuredClarification && structuredClarification.toolId) {
      intent = { toolId: structuredClarification.toolId };
      collected = { ...(structuredClarification.collected || {}) };
    } else if (semanticProposal && semanticProposal.intent) {
      intent = { toolId: semanticProposal.intent };
    } else {
      intent = this.classifyIntent(text);
      if (!intent) return null;
    }

    const toolDef = TOOL_DEFINITIONS[intent.toolId];
    if (!toolDef) return null;

    const params = {
      parishId: selectedParishId || intent.parishId || collected.parishId || null,
      documentType: intent.documentType || collected.documentType || this.extractDocumentType(text),
      eventType: intent.eventType || collected.eventType || this.extractEventType(text),
      date: intent.date || collected.date || this.extractDate(text),
      trackingNumber: intent.trackingNumber || collected.trackingNumber || this.extractTrackingNumber(text),
      userId: userId || null,
    };

    for (const reqParam of toolDef.requiredParameters) {
      if (params[reqParam] === null || params[reqParam] === undefined || params[reqParam] === "") {
        const nextRequired = toolDef.clarificationTypeIfMissing?.[reqParam] || "PARISH";
        return {
          toolId: intent.toolId,
          isComplete: false,
          nextRequired,
          parameters: params,
          structuredClarification: {
            originalQuestion: structuredClarification?.originalQuestion || text,
            originalIntent: intent.toolId,
            toolId: intent.toolId,
            collected: params,
            missing: reqParam,
            nextRequired: reqParam,
          },
        };
      }
    }

    return {
      toolId: intent.toolId,
      isComplete: true,
      parameters: params,
    };
  }

  /**
   * Authoritative backend validation and tool execution.
   * Receives proposed intent & entities from Gemini Semantic Router (or structured clarification).
   * Validates parameters, checks required fields, and executes approved tools.
   */
  async validateAndExecute({
    semanticProposal = null,
    normalizedQuestion = "",
    selectedParishId = null,
    userId = null,
    structuredClarification = null,
    conversationContext = null,
    activeParishes = null,
  }) {
    let intentId = null;
    let collected = {};

    // 1. Check if continuing from structured clarification state
    if (structuredClarification && (structuredClarification.toolId || structuredClarification.originalIntent)) {
      intentId = structuredClarification.toolId || structuredClarification.originalIntent;
      collected = { ...(structuredClarification.collected || {}) };
    } else if (semanticProposal && semanticProposal.intent) {
      intentId = semanticProposal.intent;
    } else {
      // Fallback intent extraction
      const fallback = this.classifyIntent(normalizedQuestion);
      if (fallback) {
        intentId = fallback.toolId;
      }
    }

    if (!intentId) {
      return null;
    }

    // 2. Authoritative Tool Check: Arbitrary tool execution is strictly impossible
    const toolDef = TOOL_DEFINITIONS[intentId];
    if (!toolDef) {
      return {
        answer: "I don't have enough verified TESTIMONIUM information to confirm that. Please contact your parish office for assistance.",
        fallback: true,
        fallbackReason: "UNREGISTERED_TOOL",
        responseType: "FALLBACK",
        category: null,
        sources: [],
      };
    }

    const parishes = activeParishes || (await this.getActiveParishes());

    // 3. Resolve Parish
    let resolvedParishId = selectedParishId || collected.parishId || null;
    let resolvedParishName = null;

    if (semanticProposal?.entities?.parishName) {
      const match = resolveParish(semanticProposal.entities.parishName, parishes);
      if (match) {
        resolvedParishId = match.id;
        resolvedParishName = match.parishName;
      } else {
        // Model proposed an unrecognized/imaginary parish
        return {
          answer: `I couldn't find an active parish matching "${semanticProposal.entities.parishName}". Please select your parish from the directory or choose from the list.`,
          fallback: true,
          fallbackReason: "INVALID_PARISH",
          responseType: "FALLBACK",
          category: "LIVE_DATA",
          sources: [],
        };
      }
    } else if (!resolvedParishId && conversationContext?.lastParishId) {
      // Follow-up inheritance
      resolvedParishId = conversationContext.lastParishId;
      resolvedParishName = conversationContext.lastParishName;
    }

    // 4. Resolve Document Type
    let resolvedDocType = collected.documentType || null;
    if (semanticProposal?.entities?.documentType) {
      const docRes = resolveDocumentType(semanticProposal.entities.documentType);
      if (docRes.isSupported) {
        resolvedDocType = docRes.documentType;
      } else if (docRes.unsupportedReason === "DEATH_CERTIFICATE" || String(semanticProposal.entities.documentType).toLowerCase().includes("death")) {
        return {
          answer: "TESTIMONIUM currently does not support death certificates. Supported sacramental documents are: Baptismal Certificate, Confirmation Certificate, Marriage Certificate, First Communion Certificate, Marriage Banns, Permit to Marry, and Status of Liberty.",
          fallback: true,
          fallbackReason: "UNSUPPORTED_DOCUMENT_TYPE",
          responseType: "FALLBACK",
          category: "LIVE_DATA",
          sources: [],
        };
      } else {
        return {
          answer: `TESTIMONIUM currently does not support "${semanticProposal.entities.documentType}". Supported sacramental documents are: Baptismal Certificate, Confirmation Certificate, Marriage Certificate, First Communion Certificate, Marriage Banns, Permit to Marry, and Status of Liberty.`,
          fallback: true,
          fallbackReason: "UNSUPPORTED_DOCUMENT_TYPE",
          responseType: "FALLBACK",
          category: "LIVE_DATA",
          sources: [],
        };
      }
    } else if (!resolvedDocType) {
      const docInText = this.extractDocumentType(normalizedQuestion);
      if (docInText) {
        resolvedDocType = docInText;
      } else if (conversationContext?.lastDocumentType) {
        resolvedDocType = conversationContext.lastDocumentType;
      }
    }

    // 5. Resolve Schedule Event
    let resolvedEventType = collected.eventType || null;
    if (semanticProposal?.entities?.scheduleEvent) {
      resolvedEventType = resolveScheduleEventType(semanticProposal.entities.scheduleEvent);
    } else if (!resolvedEventType) {
      const eventInText = this.extractEventType(normalizedQuestion);
      if (eventInText) {
        resolvedEventType = eventInText;
      } else if (conversationContext?.lastScheduleEvent) {
        resolvedEventType = conversationContext.lastScheduleEvent;
      }
    }

    // 6. Resolve Date
    let resolvedDate = collected.date || null;
    if (semanticProposal?.entities?.datePhrase) {
      resolvedDate = resolveManilaDate(semanticProposal.entities.datePhrase);
    } else if (!resolvedDate) {
      const dateInText = this.extractDate(normalizedQuestion);
      if (dateInText) {
        resolvedDate = dateInText;
      } else if (conversationContext?.lastDatePhrase) {
        resolvedDate = resolveManilaDate(conversationContext.lastDatePhrase);
      }
    }

    // 7. Tracking Number & Identity
    // NEVER allow model or client body to authorize userId
    const effectiveUserId = userId || null;
    const resolvedTracking =
      collected.trackingNumber ||
      extractTrackingNumber(normalizedQuestion) ||
      null;

    const params = {
      parishId: resolvedParishId,
      parishName: resolvedParishName,
      documentType: resolvedDocType,
      eventType: resolvedEventType,
      date: resolvedDate,
      trackingNumber: resolvedTracking,
      userId: effectiveUserId,
    };

    // 8. Required Parameter Check
    for (const reqParam of toolDef.requiredParameters) {
      if (params[reqParam] === null || params[reqParam] === undefined || params[reqParam] === "") {
        const clarifyType = toolDef.clarificationTypeIfMissing?.[reqParam] || "PARISH";

        let clarifyPrompt = "";
        let clarificationOptions = [];

        if (clarifyType === "PARISH") {
          clarifyPrompt = "Which parish are you referring to?";
        } else if (clarifyType === "DOCUMENT_TYPE") {
          clarifyPrompt = "Which document are you referring to?";
          clarificationOptions = CANONICAL_DOCUMENT_TYPES.map((type) => ({
            label: type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
            value: type,
          }));
        } else if (clarifyType === "SCHEDULE_EVENT") {
          clarifyPrompt = "Which sacramental event are you scheduling for (e.g. Baptism, Wedding)?";
          clarificationOptions = EVENT_SYNONYMS.map((e) => ({
            label: e.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
            value: e.type,
          }));
        } else if (clarifyType === "DATE") {
          clarifyPrompt = "Which date would you like to check availability for (e.g. tomorrow or YYYY-MM-DD)?";
        }

        return {
          answer: clarifyPrompt,
          fallback: false,
          fallbackReason: null,
          responseType: "CLARIFICATION",
          category: "CLARIFICATION",
          clarificationType: clarifyType,
          clarificationOptions: clarificationOptions.length > 0 ? clarificationOptions : undefined,
          structuredClarification: {
            originalQuestion: structuredClarification?.originalQuestion || normalizedQuestion,
            originalIntent: intentId,
            toolId: intentId,
            collected: params,
            missing: reqParam,
            nextRequired: reqParam,
          },
          sources: [],
        };
      }
    }

    // 9. All required parameters present -> Authoritative Server Execution
    let executionResult;
    try {
      switch (intentId) {
        case TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS:
          executionResult = await this.registry.getActiveParishPriests({ parishId: params.parishId });
          break;
        case TOOL_IDS.GET_PARISH_DOCUMENTS:
          executionResult = await this.registry.getParishDocuments({ parishId: params.parishId });
          break;
        case TOOL_IDS.GET_DOCUMENT_REQUIREMENTS:
          executionResult = await this.registry.getDocumentRequirements({
            documentType: params.documentType,
            parishId: params.parishId,
          });
          break;
        case TOOL_IDS.GET_DOCUMENT_FEE:
          executionResult = await this.registry.getDocumentFee({
            documentType: params.documentType,
            parishId: params.parishId,
          });
          break;
        case TOOL_IDS.GET_PARISH_OFFICE_INFO:
          executionResult = await this.registry.getParishOfficeInfo({ parishId: params.parishId });
          break;
        case TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY:
          executionResult = await this.registry.getCalendarSlotAvailability({
            parishId: params.parishId,
            eventType: params.eventType,
            date: params.date,
          });
          break;
        case TOOL_IDS.CHECK_MY_REQUEST_STATUS:
          executionResult = await this.registry.checkMyRequestStatus({
            userId: params.userId,
            trackingNumber: params.trackingNumber,
          });
          break;
        case TOOL_IDS.CHECK_MY_PAYMENT_STATUS:
          executionResult = await this.registry.checkMyPaymentStatus({
            userId: params.userId,
            trackingNumber: params.trackingNumber,
          });
          break;
        case TOOL_IDS.GET_MY_UPCOMING_SCHEDULES:
          executionResult = await this.registry.getMyUpcomingSchedules({
            userId: params.userId,
          });
          break;
        default:
          return null;
      }
    } catch (err) {
      console.error(`[LiveToolRouter] Tool execution failed (${intentId}):`, err.message);
      return {
        answer: "I was unable to retrieve this live data right now. Please try again or contact your parish office.",
        fallback: true,
        fallbackReason: "LIVE_DATA_UNAVAILABLE",
        responseType: "FALLBACK",
        category: "LIVE_DATA",
        sources: [],
      };
    }

    return {
      answer: executionResult.answer,
      fallback: false,
      fallbackReason: null,
      responseType: "LIVE_DATA",
      category: "LIVE_DATA",
      liveData: executionResult.liveData,
      executedParams: params,
      sources: [],
    };
  }

  /**
   * Main router execution entrypoint (delegates to validateAndExecute).
   */
  async routeAndExecute({
    normalizedQuestion,
    selectedParishId = null,
    userId = null,
    structuredClarification = null,
    semanticProposal = null,
    conversationContext = null,
  }) {
    return this.validateAndExecute({
      semanticProposal,
      normalizedQuestion,
      selectedParishId,
      userId,
      structuredClarification,
      conversationContext,
    });
  }
}
