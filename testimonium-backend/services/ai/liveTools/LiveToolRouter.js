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
  resolveManilaTimeSlot,
  extractTimeSlotFromText,
  extractPriestReference,
} from "../semanticValidationHelper.js";
import { getCaloyResponseComposer } from "../providerFactory.js";
import { getParishSchedulingConfiguration } from "../../SchedulingConfiguration.js";
import { humanizeEventType } from "./enumFormatters.js";

export const EFFECTIVE_CAPABILITY_HINTS = {
  [TOOL_IDS.GET_ACTIVE_PARISHES]: [TOOL_IDS.GET_PARISH_DOCUMENTS, TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS, TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.GET_ACTIVE_PARISH_PRIESTS]: [TOOL_IDS.CHECK_PRIEST_AVAILABILITY, TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.GET_PARISH_DOCUMENTS]: [TOOL_IDS.GET_DOCUMENT_REQUIREMENTS, TOOL_IDS.GET_DOCUMENT_FEE],
  [TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS]: [TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY, TOOL_IDS.GET_AVAILABLE_DATES, TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.GET_DOCUMENT_REQUIREMENTS]: [TOOL_IDS.GET_DOCUMENT_FEE, TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.GET_DOCUMENT_FEE]: [TOOL_IDS.GET_DOCUMENT_REQUIREMENTS, TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.GET_PARISH_OFFICE_INFO]: [TOOL_IDS.GET_PARISH_DOCUMENTS, TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS, TOOL_IDS.GET_ACTIVE_PARISHES],
  [TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY]: [TOOL_IDS.CHECK_PRIEST_AVAILABILITY, TOOL_IDS.GET_AVAILABLE_DATES],
  [TOOL_IDS.GET_AVAILABLE_DATES]: [TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY],
  [TOOL_IDS.CHECK_PRIEST_AVAILABILITY]: [TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY],
  [TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT]: [TOOL_IDS.CHECK_PRIEST_AVAILABILITY, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY],
  [TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE]: [TOOL_IDS.GET_PARISH_OFFICE_INFO],
  [TOOL_IDS.CHECK_MY_REQUEST_STATUS]: [TOOL_IDS.CHECK_MY_PAYMENT_STATUS],
  [TOOL_IDS.CHECK_MY_PAYMENT_STATUS]: [TOOL_IDS.CHECK_MY_REQUEST_STATUS],
  [TOOL_IDS.GET_MY_UPCOMING_SCHEDULES]: [TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY],
  [TOOL_IDS.GET_VICARIATE_DIRECTORY]: [TOOL_IDS.GET_ACTIVE_PARISHES],
};

export class LiveToolRouter {
  constructor({ registry = null, prismaClient = null, responseComposer = null, responseComposerFactory = getCaloyResponseComposer } = {}) {
    this.registry = registry || new LiveToolRegistry({ prismaClient });
    this.prisma = prismaClient || this.registry.prisma;
    this.responseComposer = responseComposer;
    this.responseComposerFactory = responseComposerFactory;
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
        select: { id: true, parishName: true, eventSettings: true },
      });
      this.cachedParishes = parishes;
      this.cachedParishesAt = now;
      return parishes;
    } catch {
      return this.cachedParishes || [];
    }
  }

  /**
   * Helper: retrieve parish with eventSettings from list or DB
   */
  async getParishWithSettings(parishId, parishesList = []) {
    if (!parishId) return null;
    let p = parishesList.find((x) => x.id === parishId);
    if (p && p.eventSettings !== undefined && p.eventSettings !== null) {
      return p;
    }
    if (this.prisma?.parish?.findUnique) {
      try {
        const full = await this.prisma.parish.findUnique({
          where: { id: parishId },
          select: { id: true, parishName: true, isActive: true, eventSettings: true },
        });
        if (full) return full;
      } catch {}
    }
    return p || null;
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
   * Helper: extract vicariate name reference from text
   */
  extractVicariateName(text) {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/\b(vicariate\s+of\s+[a-zA-Z\s]+|[a-zA-Z]+\s+vicariate|canlaon)\b/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * Deterministic identifier-based fallback classification.
   * Only used if no semantic proposal is supplied (e.g. in direct unit tests).
   */
  classifyIntent(normalizedText) {
    if (!normalizedText || typeof normalizedText !== "string") return null;
    const text = normalizedText.trim();
    const lower = text.toLowerCase();

    const isAvailableDateRange = /\b(what|which)\s+(days|dates)\s+are\s+available\b|\bwhat\s+dates\s+have\b.*\bopenings?\b|\bavailable\s+(days|dates)\b|\bopenings?\s+(this|next)\s+week\b|\bnext\s+available\b.*\b(day|date)\b/i.test(lower);
    if (isAvailableDateRange) {
      return { toolId: TOOL_IDS.GET_AVAILABLE_DATES };
    }

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
      const isParishDocs = /\b(available\s+documents|what\s+documents\s+(are\s+available|do\s+you\s+offer|does\s+.*offer)|offered\s+documents|list\s+of\s+documents|anong\s+(mga\s+)?(papeles|dokumento|certificates?)\s+ang\s+(available|pwede))\b/i.test(lower);
      if (isParishDocs) {
        return { toolId: TOOL_IDS.GET_PARISH_DOCUMENTS };
      }
    }

    // 8.5 Schedulable Events at Parish (distinct from document offerings)
    const isSchedulableEvents = /\b(what\s+events\s+(can\s+i\s+schedule|are\s+(available|schedulable))|anong\s+(mga\s+)?event.*(schedule|e-schedule|i-schedule|pwede\s+i\s+schedule|pwede\s+ko\s+e\s+schedule)|what\s+services\s+(can\s+i\s+schedule|are\s+available\s+for\s+scheduling)|schedulable\s+events|events\s+(i\s+can|to)\s+schedule|services\s+available\s+for\s+scheduling)\b/i.test(lower);
    if (isSchedulableEvents) {
      return { toolId: TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS };
    }

    // 9. Parish Office Info
    const isOfficeInfo = /\b(office\s+hours|what\s+time\s+(does|is)\s+(the\s+)?(parish\s+)?office|contact\s+number|phone\s+number|email\s+address|where\s+is\s+the\s+parish\s+office)\b/i.test(lower);
    if (isOfficeInfo) {
      return { toolId: TOOL_IDS.GET_PARISH_OFFICE_INFO };
    }

    // 10. Calendar Slot Availability & Specific Event Scheduling
    const detectedEvent = this.extractEventType(text);
    const isSchedulingInquiry = /\b(schedule|scheduling|sched|mag-sched|mag-schedule|mag\s+sched|mag\s+schedule|book|booking|slot|slots|open|available)\b/i.test(lower);
    if (detectedEvent && isSchedulingInquiry && !isGeneralScheduling) {
      return {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        timeSlot: extractTimeSlotFromText(text),
        eventType: detectedEvent,
        date: this.extractDate(text),
      };
    }

    const isSlotAvailability = /\b(what\s+slots\s+are\s+available|available\s+slots|open\s+slots|available\s+schedules|available\s+schedule|slots\s+tomorrow|slots\s+on|can\s+i\s+book\s+at|is\s+.*(open|available)\s+for\s+(a\s+)?(wedding|baptism|funeral|wake|wake\s+mass|mass)|wedding\s+times|baptism\s+times)\b/i.test(lower);
    if (isSlotAvailability) {
      return {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        timeSlot: extractTimeSlotFromText(text),
        eventType: detectedEvent,
        date: this.extractDate(text),
      };
    }

    // 10.5 Vicariate Directory
    const isVicariateDirectory = /\bvicariate\b/i.test(lower);
    if (isVicariateDirectory) {
      return {
        toolId: TOOL_IDS.GET_VICARIATE_DIRECTORY,
        vicariateName: this.extractVicariateName(text),
      };
    }

    // 11. Active Parish Directory
    const isParishDirectory = /\b(what\s+parishes|which\s+(parishes|churches)|list\s+of\s+parishes|show\s+(me\s+)?(all\s+)?parishes|parishes\s+in\s+testimonium|parishes\s+present\s+in\s+testimonium|member\s+parishes|what\s+are\s+the\s+parishes)\b/i.test(lower);
    if (isParishDirectory) {
      return { toolId: TOOL_IDS.GET_ACTIVE_PARISHES };
    }

    // 12. Priest Availability
    const isPriestAvailability = /\b(is\s+(fr\.?|father|rev\.?\s*fr\.?|the\s+parish\s+priest|the\s+pastor)\b.*\b(free|available)\b|\bcan\s+(fr\.?|father|rev\.?\s*fr\.?)\b.*\b(celebrate|officiate|available)\b)/i.test(lower);
    if (isPriestAvailability) {
      return {
        toolId: TOOL_IDS.CHECK_PRIEST_AVAILABILITY,
        priestName: extractPriestReference(text),
        timeSlot: extractTimeSlotFromText(text),
        eventType: this.extractEventType(text),
        date: this.extractDate(text),
      };
    }

    // 13. Available Priests for Slot
    const isAvailablePriests = /\b(which\s+priests\s+are\s+available|who\s+can\s+celebrate|which\s+priest\s+is\s+free|available\s+priests\s+for|priests\s+available\s+at)\b/i.test(lower);
    if (isAvailablePriests) {
      return {
        toolId: TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT,
        timeSlot: extractTimeSlotFromText(text),
        eventType: this.extractEventType(text),
        date: this.extractDate(text),
      };
    }

    // 14. Parish Events on Date
    const isParishEvents = /\b(what('s|\s+is)\s+happening\s+at\s+the\s+parish|parish\s+events|events\s+on|calendar\s+events|activities\s+on|mass\s+schedules?\s+on)\b/i.test(lower);
    if (isParishEvents) {
      return {
        toolId: TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE,
        date: this.extractDate(text),
      };
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
      timeSlot: intent.timeSlot || collected.timeSlot || resolveManilaTimeSlot(text) || extractTimeSlotFromText(text) || null,
      priestName: intent.priestName || collected.priestName || extractPriestReference(text) || null,
      priestId: intent.priestId || collected.priestId || null,
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
    deadline = null,
    generationModel = null,
    traceId = null,
    signal = null,
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
    if (
      !resolvedParishId &&
      structuredClarification?.selectedValue &&
      (structuredClarification.missing === "parish" || structuredClarification.nextRequired === "parish")
    ) {
      const parsedId = Number(structuredClarification.selectedValue);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        resolvedParishId = parsedId;
      }
    }
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

    if (resolvedParishId && !resolvedParishName) {
      const p = parishes.find((x) => x.id === resolvedParishId);
      if (p) resolvedParishName = p.parishName;
    }

    // 4. Resolve Document Type
    let resolvedDocType = collected.documentType || null;
    if (
      !resolvedDocType &&
      structuredClarification?.selectedValue &&
      (structuredClarification.missing === "documentType" || structuredClarification.nextRequired === "documentType")
    ) {
      resolvedDocType = structuredClarification.selectedValue;
    }
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
    let resolvedEventType = collected.eventType || collected.scheduleEvent || null;
    if (
      !resolvedEventType &&
      structuredClarification?.selectedValue &&
      (structuredClarification.missing === "eventType" || structuredClarification.nextRequired === "eventType")
    ) {
      resolvedEventType = resolveScheduleEventType(structuredClarification.selectedValue) || structuredClarification.selectedValue;
    }
    if (!resolvedEventType && semanticProposal?.entities?.scheduleEvent) {
      resolvedEventType = resolveScheduleEventType(semanticProposal.entities.scheduleEvent);
    } else if (!resolvedEventType) {
      const eventInText = this.extractEventType(normalizedQuestion);
      if (eventInText) {
        resolvedEventType = eventInText;
      } else if (conversationContext?.lastScheduleEvent) {
        resolvedEventType = conversationContext.lastScheduleEvent;
      }
    }
    if (resolvedEventType) {
      resolvedEventType = resolveScheduleEventType(resolvedEventType) || resolvedEventType;
    }

    // 6. Resolve Date
    let resolvedDate = collected.date || null;
    if (
      !resolvedDate &&
      structuredClarification?.selectedValue &&
      (structuredClarification.missing === "date" || structuredClarification.nextRequired === "date")
    ) {
      resolvedDate = resolveManilaDate(structuredClarification.selectedValue);
    }
    if (semanticProposal?.entities?.datePhrase) {
      resolvedDate = resolveManilaDate(semanticProposal.entities.datePhrase);
    } else if (!resolvedDate) {
      const dateInText = this.extractDate(normalizedQuestion);
      if (dateInText) {
        resolvedDate = dateInText;
      } else if (intentId !== TOOL_IDS.GET_AVAILABLE_DATES && conversationContext?.lastDatePhrase) {
        resolvedDate = resolveManilaDate(conversationContext.lastDatePhrase);
      }
    }

    // 7. Resolve Time Slot
    let resolvedTimeSlot = collected.timeSlot || null;
    if (semanticProposal?.entities?.timePhrase) {
      resolvedTimeSlot = resolveManilaTimeSlot(semanticProposal.entities.timePhrase) || extractTimeSlotFromText(semanticProposal.entities.timePhrase);
    } else if (!resolvedTimeSlot) {
      const timeInText = extractTimeSlotFromText(normalizedQuestion) || resolveManilaTimeSlot(normalizedQuestion);
      if (timeInText) {
        resolvedTimeSlot = timeInText;
      } else if (conversationContext?.lastTimePhrase) {
        resolvedTimeSlot = resolveManilaTimeSlot(conversationContext.lastTimePhrase) || conversationContext.lastTimePhrase;
      }
    }

    // 8. Resolve Priest Name / ID
    let resolvedPriestName = collected.priestName || null;
    let resolvedPriestId = collected.priestId || null;
    if (semanticProposal?.entities?.priestName) {
      resolvedPriestName = semanticProposal.entities.priestName;
    } else if (!resolvedPriestName) {
      const priestInText = extractPriestReference(normalizedQuestion);
      if (priestInText) {
        resolvedPriestName = priestInText;
      } else if (conversationContext?.lastPriestName) {
        resolvedPriestName = conversationContext.lastPriestName;
        resolvedPriestId = conversationContext.lastPriestId || null;
      }
    }

    // 9. Tracking Number & Identity
    // NEVER allow model or client body to authorize userId
    const effectiveUserId = userId || null;
    const resolvedTracking =
      collected.trackingNumber ||
      extractTrackingNumber(normalizedQuestion) ||
      null;

    // 10. Resolve Vicariate Name
    let resolvedVicariateName =
      semanticProposal?.entities?.vicariateName ||
      collected.vicariateName ||
      conversationContext?.lastVicariateName ||
      null;

    if (!resolvedVicariateName && intentId === TOOL_IDS.GET_VICARIATE_DIRECTORY) {
      resolvedVicariateName = this.extractVicariateName(normalizedQuestion);
    }

    const params = {
      parishId: resolvedParishId,
      parishName: resolvedParishName,
      documentType: resolvedDocType,
      eventType: resolvedEventType,
      date: resolvedDate,
      startDate: intentId === TOOL_IDS.GET_AVAILABLE_DATES ? resolvedDate : null,
      rangeDays: collected.rangeDays || null,
      timeSlot: resolvedTimeSlot,
      priestName: resolvedPriestName,
      priestId: resolvedPriestId,
      vicariateName: resolvedVicariateName,
      trackingNumber: resolvedTracking,
      userId: effectiveUserId,
    };

    // 10. Required Parameter Check
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
          clarifyPrompt = "Which event or service would you like to check?";
          const targetParish = await this.getParishWithSettings(resolvedParishId, parishes);
          if (targetParish) {
            const config = getParishSchedulingConfiguration(targetParish);
            const enabledServices = Array.isArray(config?.enabledServices) ? config.enabledServices : [];
            clarificationOptions = enabledServices.map((type) => ({
              label: humanizeEventType(type),
              value: type,
            }));
          }
        } else if (clarifyType === "DATE") {
          clarifyPrompt = "Which date would you like to check availability for (e.g. tomorrow or YYYY-MM-DD)?";
        } else if (clarifyType === "TIME") {
          clarifyPrompt = "What time would you like to check (e.g. 10:00 AM or 2:00 PM)?";
        } else if (clarifyType === "PRIEST") {
          clarifyPrompt = "Which priest would you like to check availability for?";
        }

        const stableClarificationId = `clarify_${intentId}_${reqParam}_${params.parishId || "global"}`;

        return {
          answer: clarifyPrompt,
          fallback: false,
          fallbackReason: null,
          responseType: "CLARIFICATION",
          category: "CLARIFICATION",
          clarificationType: clarifyType,
          clarificationOptions: clarificationOptions.length > 0 ? clarificationOptions : undefined,
          structuredClarification: {
            id: stableClarificationId,
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

    // 11. Authoritative Parish Scheduling Configuration Check for Events
    if (
      params.parishId &&
      params.eventType &&
      (intentId === TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY ||
       intentId === TOOL_IDS.GET_AVAILABLE_DATES ||
       intentId === TOOL_IDS.CHECK_PRIEST_AVAILABILITY ||
       intentId === TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT)
    ) {
      const targetParish = await this.getParishWithSettings(params.parishId, parishes);
      if (targetParish) {
        const config = getParishSchedulingConfiguration(targetParish);
        if (config && config.isConfigured && Array.isArray(config.enabledServices)) {
          if (!config.enabledServices.includes(params.eventType)) {
            const eventLabel = humanizeEventType(params.eventType);
            const pName = targetParish.parishName || "This parish";
            const answer = `**${pName}** does not currently offer **${eventLabel}** scheduling. Please choose one of the services enabled by the parish or contact the parish office.`;
            return {
              answer,
              fallbackAnswer: answer,
              fallback: true,
              fallbackReason: "EVENT_NOT_OFFERED",
              responseType: "FALLBACK",
              category: "LIVE_DATA",
              sources: [],
            };
          }
        }
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
        case TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS:
          executionResult = await this.registry.getParishSchedulableEvents({ parishId: params.parishId });
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
        case TOOL_IDS.GET_ACTIVE_PARISHES:
          executionResult = await this.registry.getActiveParishes();
          break;
        case TOOL_IDS.GET_VICARIATE_DIRECTORY:
          executionResult = await this.registry.getVicariateDirectory({
            vicariateName: params.vicariateName,
            conversationContext,
          });
          break;
        case TOOL_IDS.CHECK_PRIEST_AVAILABILITY:
          executionResult = await this.registry.checkPriestAvailability({
            parishId: params.parishId,
            priestId: params.priestId,
            priestName: params.priestName,
            date: params.date,
            timeSlot: params.timeSlot,
            eventType: params.eventType,
          });
          break;
        case TOOL_IDS.GET_AVAILABLE_PRIESTS_FOR_SLOT:
          executionResult = await this.registry.getAvailablePriestsForSlot({
            parishId: params.parishId,
            date: params.date,
            timeSlot: params.timeSlot,
            eventType: params.eventType,
          });
          break;
        case TOOL_IDS.GET_PARISH_EVENTS_FOR_DATE:
          executionResult = await this.registry.getParishEventsForDate({
            parishId: params.parishId,
            date: params.date,
          });
          break;
        case TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY:
          executionResult = await this.registry.getCalendarSlotAvailability({
            parishId: params.parishId,
            eventType: params.eventType,
            date: params.date,
            timeSlot: params.timeSlot,
          });
          break;
        case TOOL_IDS.GET_AVAILABLE_DATES:
          executionResult = await this.registry.getAvailableDates({
            parishId: params.parishId,
            eventType: params.eventType,
            startDate: params.startDate,
            rangeDays: params.rangeDays,
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

    if (executionResult.fallback) {
      return executionResult;
    }

    const fallbackAnswer = executionResult.fallbackAnswer || executionResult.answer;
    let finalAnswer = fallbackAnswer;

    // Check request deadline budget before invoking LLM response composer (Section 47)
    const remainingBudget = deadline ? deadline - Date.now() : 12000;
    const MIN_COMPOSER_BUDGET_MS = 3000;

    const composer = this.responseComposer || (generationModel ? this.responseComposerFactory(generationModel) : null);
    const isComposeEligible = !executionResult.deterministicOnly && Boolean(executionResult.structuredFacts);

    if (composer && isComposeEligible) {
      if (remainingBudget < MIN_COMPOSER_BUDGET_MS) {
        console.warn(`[LiveToolRouter] Request deadline nearly exhausted (${remainingBudget}ms left), skipping composer and returning deterministic fallback.`);
      } else {
        const effectiveHints = EFFECTIVE_CAPABILITY_HINTS[intentId] || [];
        try {
          const composition = await composer.compose({
            responseType: "LIVE_DATA",
            structuredFacts: executionResult.structuredFacts,
            conversationContext,
            capabilityHints: effectiveHints,
            userMessage: normalizedQuestion,
            fallbackAnswer,
            traceId,
            signal,
          });
          if (composition && composition.answer) {
            finalAnswer = composition.answer;
          }
        } catch (compErr) {
          console.warn(`[LiveToolRouter] Composer error, safely falling back to deterministic answer: ${compErr.message}`);
          finalAnswer = fallbackAnswer;
        }
      }
    }

    return {
      answer: finalAnswer,
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
    deadline = null,
    generationModel = null,
    traceId = null,
    signal = null,
  }) {
    return this.validateAndExecute({
      semanticProposal,
      normalizedQuestion,
      selectedParishId,
      userId,
      structuredClarification,
      conversationContext,
      deadline,
      generationModel,
      traceId,
      signal,
    });
  }
}
