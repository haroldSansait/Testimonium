/**
 * Mock Semantic Intent Router for Testing
 *
 * Simulates Gemini semantic interpretation with zero external network or API calls.
 * Records call arguments for privacy & security assertions.
 */
export class FakeSemanticRouter {
  constructor() {
    this.calls = [];
    this.customInterpretation = null;
    this.mockRuleMap = new Map();
    this.simulateError = null;
  }

  setMockInterpretation(interpretation) {
    this.customInterpretation = interpretation;
  }

  addRule(predicate, interpretation) {
    this.mockRuleMap.set(predicate, interpretation);
  }

  reset() {
    this.calls = [];
    this.customInterpretation = null;
    this.mockRuleMap.clear();
    this.simulateError = null;
  }

  _inferDefaultInterpretation(sanitizedQuestion, conversationContext) {
    const text = (sanitizedQuestion || "").toLowerCase();

    // 0. Social / Decline or Acknowledgement
    if (
      /^(no(\s*,)?\s*thanks?|no\s+thank\s+you|okay(\s*,)?\s*thanks?|ok\s+thanks?|sige(\s*,)?\s*salamat|salamat\s+gid|way\s+kaso(\s+ah)?|okay\s+lang|ok\s+lang)(\s+caloy)?$/i.test(
        text
      )
    ) {
      return {
        route: "SOCIAL",
        intent: "DECLINE_OR_CLOSE",
        pendingRelation: null,
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // 1. Social / Greetings
    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy)(\s+caloy)?/i.test(text)) {
      if (
        text.length < 25 &&
        !text.includes("?") &&
        !text.includes("who") &&
        !text.includes("what") &&
        !text.includes("priest") &&
        !text.includes("cost") &&
        !text.includes("fee")
      ) {
        return {
          route: "SOCIAL",
          intent: "GREETING",
          pendingRelation: null,
          entities: {
            parishName: null,
            documentType: null,
            scheduleEvent: null,
            datePhrase: null,
            timePhrase: null,
            priestName: null,
            trackingNumberPresent: false,
          },
          usesPreviousContext: false,
        };
      }
    }

    // 2. Capabilities
    if (
      /what\s+(can\s+you\s+do|do\s+you\s+answer|can\s+i\s+ask|are\s+your\s+capabilities|questions\s+can\s+you\s+answer|do\s+you\s+usually\s+(answer|help))/i.test(
        text
      ) ||
      /help\s+me/i.test(text) ||
      /what\s+can\s+i\s+ask\s+you/i.test(text)
    ) {
      return {
        route: "CAPABILITIES",
        intent: null,
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // 3. Out of scope
    if (/write(\s+me)?\s+(a\s+)?(poem|story|code|song)|tell(\s+me)?\s+(a\s+)?joke/i.test(text)) {
      return {
        route: "OUT_OF_SCOPE",
        intent: null,
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Extract common entities
    let parishName = null;
    if (/st\.?\s*joseph/i.test(text)) parishName = "St. Joseph Parish";
    if (/guadalupe/i.test(text)) parishName = "Our Lady of Guadalupe Parish";

    let documentType = null;
    if (/\b(baptism|baptismal|binyag)\b/i.test(text)) documentType = "BAPTISMAL_CERTIFICATE";
    if (/\b(marriage|wedding|kasal)\s*(certificate|cert)?\b/i.test(text)) documentType = "MARRIAGE_CERTIFICATE";
    if (/\b(confirmation|kumpil)\b/i.test(text)) documentType = "CONFIRMATION_CERTIFICATE";
    if (/\b(death|patay)\b/i.test(text)) documentType = "DEATH_CERTIFICATE";

    let scheduleEvent = null;
    if (/\b(marriage\s+special|special\s+wedding)\b/i.test(text)) scheduleEvent = "MARRIAGE_SPECIAL";
    else if (/\b(wedding|kasal)\b/i.test(text)) scheduleEvent = "WEDDING";
    else if (/\b(baptism|binyag)\b/i.test(text)) scheduleEvent = "BAPTISM";
    else if (/\b(wake\s+mass|wake|misa\s+sa\s+patay)\b/i.test(text)) scheduleEvent = "WAKE_MASS";
    else if (/\b(mass\s+intention|pamisa|intention)\b/i.test(text)) scheduleEvent = "MASS_INTENTION";
    else if (/\b(funeral|burial|libing)\b/i.test(text)) scheduleEvent = "FUNERAL";
    else if (/\b(confirmation|kumpil)\b/i.test(text)) scheduleEvent = "CONFIRMATION";
    else if (/\b(first\s+communion|komunyon)\b/i.test(text)) scheduleEvent = "FIRST_COMMUNION";
    else if (/\b(confession|kumpisal)\b/i.test(text)) scheduleEvent = "CONFESSION";
    else if (/\b(anointing|last\s+rites)\b/i.test(text)) scheduleEvent = "ANOINTING_OF_THE_SICK";

    let datePhrase = null;
    if (/tomorrow|bukas|ugma/i.test(text)) datePhrase = "tomorrow";
    else if (/today|ngayon|karun/i.test(text)) datePhrase = "today";
    else if (/next\s+monday/i.test(text)) datePhrase = "next Monday";
    else if (/monday|sa\s+lunes/i.test(text)) datePhrase = "Monday";
    else if (/next\s+saturday/i.test(text)) datePhrase = "next Saturday";
    else if (/saturday|sa\s+sabado/i.test(text)) datePhrase = "Saturday";
    else if (/next\s+sunday/i.test(text)) datePhrase = "next Sunday";
    else if (/sunday|sa\s+linggo/i.test(text)) datePhrase = "Sunday";
    else if (/(?:on\s+)?(?:september|sept|sep)\.?\s*17(?:st|nd|rd|th)?|17(?:st|nd|rd|th)?\s*(?:of\s+)?(?:september|sept|sep)/i.test(text)) datePhrase = "2026-09-17";

    let timePhrase = null;
    if (/\b2\s*(pm|p\.m\.)\b|\b2:00\s*(pm|p\.m\.)\b|\bat\s+2\b/i.test(text)) timePhrase = "2:00 PM";
    else if (/\b10\s*(am|a\.m\.)\b|\b10:00\s*(am|a\.m\.)\b|\b10\s+in\s+the\s+morning\b/i.test(text)) timePhrase = "10:00 AM";
    else if (/\bafternoon\b/i.test(text)) timePhrase = "afternoon";
    else if (/\bmorning\b/i.test(text)) timePhrase = "morning";

    let priestName = null;
    if (/julius(\s+l\.?)?(\s+monta[ñn]o)?/i.test(text)) {
      priestName = "Fr. Julius L. Montaño";
    } else if (/fr\.?\s*julius/i.test(text)) {
      priestName = "Fr. Julius";
    } else if (/the\s+parish\s+priest|the\s+pastor/i.test(text)) {
      priestName = "parish priest";
    }

    // Test-only deterministic stand-in for Gemini's semantic range intent.
    // Production phrasing flexibility remains owned by SemanticIntentRouter.
    if (/\b(what|which)\s+(days|dates)\s+are\s+available\b|\bwhat\s+dates\s+have\b.*\bopenings?\b|\bavailable\s+(days|dates)\b|\bopenings?\s+(this|next)\s+week\b|\bnext\s+available\b.*\b(day|date)\b/i.test(text)) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_AVAILABLE_DATES",
        entities: {
          parishName: parishName || conversationContext?.lastParishName || null,
          documentType: null,
          scheduleEvent: scheduleEvent || conversationContext?.lastScheduleEvent || null,
          datePhrase,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(conversationContext?.lastIntent),
      };
    }

    // Vicariate Directory (standalone or follow-up)
    const isVicariateQuery = /\bvicariate\b/i.test(text);
    const isVicariateFollowUp =
      Boolean(conversationContext?.lastVicariateName || conversationContext?.lastIntent === "GET_VICARIATE_DIRECTORY") &&
      /\b(how\s+many|which|what|list|show)\b.*\b(of\s+those|parishes|churches|units)\b/i.test(text);

    if (isVicariateQuery || isVicariateFollowUp) {
      let vicName = null;
      const canlaonMatch = text.match(/\b(canlaon)\b/i);
      if (canlaonMatch) {
        vicName = "Vicariate of Canlaon";
      } else {
        const vMatch = text.match(/\b(vicariate\s+of\s+[a-zA-Z\s]+|[a-zA-Z]+\s+vicariate)\b/i);
        if (vMatch) {
          vicName = vMatch[1].trim();
        } else if (conversationContext?.lastVicariateName) {
          vicName = conversationContext.lastVicariateName;
        }
      }

      return {
        route: "LIVE_TOOL",
        intent: "GET_VICARIATE_DIRECTORY",
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          vicariateName: vicName,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(isVicariateFollowUp || (vicName && conversationContext?.lastVicariateName === vicName)),
      };
    }

    // Active Parishes directory
    if (
      /\b(what\s+parishes|which\s+(parishes|churches)|list\s+of\s+parishes|show\s+(me\s+)?(all\s+|the\s+)?parishes|parishes\s+in\s+testimonium|parishes\s+present\s+in\s+testimonium|member\s+parishes|what\s+are\s+the\s+parishes|parishes\s+in\s+the\s+system)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_ACTIVE_PARISHES",
        entities: {
          parishName: null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Specific Priest Availability (standalone or follow-up)
    if (
      /\b(is\s+(fr|father|rev|the\s+parish\s+priest|the\s+pastor)\b.*\b(free|available)\b|\bcan\s+(fr|father|rev)\b.*\b(celebrate|officiate|available)\b)/i.test(
        text
      ) ||
      (/\b(free|available)\b/i.test(text) && priestName)
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "CHECK_PRIEST_AVAILABILITY",
        entities: {
          parishName: parishName || conversationContext?.lastParishName || null,
          documentType: null,
          scheduleEvent: scheduleEvent || conversationContext?.lastScheduleEvent || null,
          datePhrase: datePhrase || conversationContext?.lastDatePhrase || null,
          timePhrase: timePhrase || conversationContext?.lastTimePhrase || null,
          priestName: priestName || conversationContext?.lastPriestName || null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(conversationContext?.lastIntent),
      };
    }

    // Available Priests for Slot
    if (
      /\b(which\s+priests\s+are\s+available|who\s+can\s+celebrate|which\s+priest\s+is\s+free|available\s+priests\s+for|priests\s+available\s+at)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_AVAILABLE_PRIESTS_FOR_SLOT",
        entities: {
          parishName: parishName || conversationContext?.lastParishName || null,
          documentType: null,
          scheduleEvent: scheduleEvent || conversationContext?.lastScheduleEvent || null,
          datePhrase: datePhrase || conversationContext?.lastDatePhrase || null,
          timePhrase: timePhrase || conversationContext?.lastTimePhrase || null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(conversationContext?.lastIntent),
      };
    }

    // Parish Events for Date
    if (
      /\b(what('s|\s+is)\s+happening\s+at\s+the\s+parish|parish\s+events|events\s+on|calendar\s+events|activities\s+on|mass\s+schedules?\s+on)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_PARISH_EVENTS_FOR_DATE",
        entities: {
          parishName: parishName || conversationContext?.lastParishName || null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: datePhrase || conversationContext?.lastDatePhrase || null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(conversationContext?.lastIntent),
      };
    }

    // Explicit check: If question is a general procedure question (e.g. payment verification), route directly to RAG without inheriting previous context!
    if (/\b(how\s+does\s+payment\s+verification\s+work|how\s+to\s+pay|how\s+does\s+ocr\s+work|payment\s+process|payment\s+verification\s+work)/i.test(text)) {
      return {
        route: "RAG",
        intent: null,
        entities: {
          parishName: parishName || conversationContext?.lastParishName || null,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // 4. Follow-up detection with conversationContext
    if (conversationContext?.lastIntent) {
      if (/\b(requirements?|paperwork|prepare|what\s+do\s+i\s+need)\b/i.test(text)) {
        return {
          route: "LIVE_TOOL",
          intent: "GET_DOCUMENT_REQUIREMENTS",
          entities: {
            documentType: documentType || conversationContext.lastDocumentType || null,
            parishName: parishName || conversationContext.lastParishName || null,
            scheduleEvent: null,
            datePhrase: null,
            timePhrase: null,
            priestName: null,
            trackingNumberPresent: false,
          },
          usesPreviousContext: true,
        };
      }

      if (/\b(who\s+serves|clergy|priests?|celebrates)\b/i.test(text)) {
        return {
          route: "LIVE_TOOL",
          intent: "GET_ACTIVE_PARISH_PRIESTS",
          entities: {
            parishName: parishName || conversationContext.lastParishName || null,
            documentType: null,
            scheduleEvent: null,
            datePhrase: null,
            timePhrase: null,
            priestName: null,
            trackingNumberPresent: false,
          },
          usesPreviousContext: true,
        };
      }

      if (/\b(how\s+about|what\s+about|in\s+here|there)\b/i.test(text)) {
        let followUpIntent = conversationContext.lastIntent;
        if (conversationContext.lastIntent === "GET_PARISH_SCHEDULABLE_EVENTS" && scheduleEvent) {
          followUpIntent = "GET_CALENDAR_SLOT_AVAILABILITY";
        }
        return {
          route: "LIVE_TOOL",
          intent: followUpIntent,
          entities: {
            parishName: parishName || conversationContext.lastParishName || null,
            documentType: documentType || conversationContext.lastDocumentType || null,
            scheduleEvent: scheduleEvent || conversationContext.lastScheduleEvent || null,
            datePhrase: datePhrase || conversationContext.lastDatePhrase || null,
            timePhrase: timePhrase || conversationContext.lastTimePhrase || null,
            priestName: priestName || conversationContext.lastPriestName || null,
            trackingNumberPresent: false,
          },
          usesPreviousContext: true,
        };
      }
    }

    const hasTracking =
      /<TRACKING_NUMBER>/i.test(sanitizedQuestion) ||
      /\bSR[-_ ]?\d{4}[-_ ]?\d{6}\b/i.test(sanitizedQuestion);

    // Live tool intent matching
    if (hasTracking) {
      if (/\b(payment|paid|gcash|receipt|verify|verified)\b/i.test(text)) {
        return {
          route: "LIVE_TOOL",
          intent: "CHECK_MY_PAYMENT_STATUS",
          entities: {
            parishName,
            documentType,
            scheduleEvent,
            datePhrase,
            trackingNumberPresent: true,
          },
          usesPreviousContext: false,
        };
      }
      return {
        route: "LIVE_TOOL",
        intent: "CHECK_MY_REQUEST_STATUS",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: true,
        },
        usesPreviousContext: false,
      };
    }

    if (
      /\b(check\s+my\s+payment|is\s+my\s+payment|status\s+of\s+my\s+payment|did\s+the\s+parish\s+already\s+approve\s+the\s+payment|payment\s+i\s+sent)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "CHECK_MY_PAYMENT_STATUS",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (/\b(my\s+request|status\s+of\s+my\s+request|is\s+my\s+certificate\s+ready)\b/i.test(text)) {
      return {
        route: "LIVE_TOOL",
        intent: "CHECK_MY_REQUEST_STATUS",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (
      /\b(do\s+i\s+have\s+anything\s+scheduled|my\s+upcoming|appointments\s+do\s+i\s+have)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_MY_UPCOMING_SCHEDULES",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (
      /\b(office\s+hours|what\s+are\s+the\s+office\s+hours|contact\s+number|where\s+is\s+the\s+parish\s+office)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_PARISH_OFFICE_INFO",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (
      /\b(priests?|clergy|pastor|celebrates|assigned)\b/i.test(text) &&
      !/\b(choose|request|pick)\s+a\s+preferred\b/i.test(text)
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_ACTIVE_PARISH_PRIESTS",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (/\b(how\s+much|cost|fee|price|pricing)\b/i.test(text)) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_DOCUMENT_FEE",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    if (/\b(requirements?|paperwork|what\s+do\s+i\s+need|prepare)\b/i.test(text)) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_DOCUMENT_REQUIREMENTS",
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Schedulable events inquiry at parish (distinct from document types)
    if (
      /\b(what\s+events\s+(can\s+i\s+schedule|are\s+schedulable|are\s+available)|anong\s+(mga\s+)?event.*(schedule|e-schedule|i-schedule|pwede\s+i\s+schedule|pwede\s+ko\s+e\s+schedule)|what\s+services\s+(can\s+i\s+schedule|are\s+available\s+for\s+scheduling)|schedulable\s+events|events\s+(i\s+can|to)\s+schedule|services\s+available\s+for\s+scheduling)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_PARISH_SCHEDULABLE_EVENTS",
        pendingRelation: (conversationContext?.pendingMissingParam || conversationContext?.pendingClarificationIntent) ? "NEW_TOPIC" : null,
        entities: {
          parishName,
          documentType: null,
          scheduleEvent: null,
          datePhrase: null,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Direct event scheduling inquiry (e.g. "Can I schedule a Wake Mass?", "pwede ba mag sched ng wake mass sa St joseph?", "pwede ba ako mag request ng schedule para sa isang wake mass?", "How about Wake Mass at St. Joseph?")
    if (
      scheduleEvent &&
      (/\b(schedule|sched|booking|book|mag-sched|mag-schedule|request\s+ng\s+schedule|slots?|open|available|how\s+about|pwede\s+ba|can\s+i|may\s+wake\s+mass)\b/i.test(text) ||
       conversationContext?.lastIntent === "GET_PARISH_SCHEDULABLE_EVENTS" ||
       conversationContext?.lastIntent === "GET_CALENDAR_SLOT_AVAILABILITY")
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_CALENDAR_SLOT_AVAILABILITY",
        pendingRelation: null,
        entities: {
          parishName,
          documentType: null,
          scheduleEvent,
          datePhrase,
          timePhrase,
          priestName,
          trackingNumberPresent: false,
        },
        usesPreviousContext: Boolean(conversationContext?.lastParishName && !parishName),
      };
    }

    if (
      /\b(slots?|availability|schedules?|open\s+for|anything\s+open)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_CALENDAR_SLOT_AVAILABILITY",
        pendingRelation: null,
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          timePhrase,
          priestName,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Pending clarification resolution (e.g. user replies with a date or missing parameter)
    const hasPendingClarification = Boolean(
      conversationContext?.pendingMissingParam ||
      conversationContext?.pendingClarificationIntent ||
      conversationContext?.lastResponseType === "CLARIFICATION"
    );

    if (hasPendingClarification) {
      const missing = (conversationContext?.pendingMissingParam || "date").toLowerCase();
      if (
        (missing === "date" && datePhrase) ||
        ((missing === "parish" || missing === "parishid") && parishName) ||
        ((missing === "eventtype" || missing === "schedule_event" || missing === "event") && scheduleEvent) ||
        ((missing === "documenttype" || missing === "document_type" || missing === "document") && documentType)
      ) {
        return {
          route: "LIVE_TOOL",
          intent: conversationContext?.pendingClarificationIntent || conversationContext?.lastIntent || "GET_CALENDAR_SLOT_AVAILABILITY",
          pendingRelation: "ANSWER_PENDING",
          entities: {
            parishName: parishName || conversationContext?.lastParishName || null,
            documentType: documentType || conversationContext?.lastDocumentType || null,
            scheduleEvent: scheduleEvent || conversationContext?.lastScheduleEvent || null,
            datePhrase: datePhrase || conversationContext?.lastDatePhrase || null,
            timePhrase: timePhrase || conversationContext?.lastTimePhrase || null,
            priestName: priestName || conversationContext?.lastPriestName || null,
            trackingNumberPresent: false,
          },
          usesPreviousContext: true,
        };
      }
    }

    if (
      /\b(documents\s+(are\s+available|can\s+i\s+request|do\s+you\s+offer)|available\s+documents|anong\s+(mga\s+)?(papeles|dokumento|certificates?)\s+ang\s+(available|pwede))\b/i.test(
        text
      ) &&
      !/\btestimonium\s+support\b/i.test(text)
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_PARISH_DOCUMENTS",
        pendingRelation: hasPendingClarification ? "NEW_TOPIC" : null,
        entities: {
          parishName,
          documentType,
          scheduleEvent,
          datePhrase,
          timePhrase: null,
          priestName: null,
          trackingNumberPresent: false,
        },
        usesPreviousContext: false,
      };
    }

    // Default RAG
    return {
      route: "RAG",
      intent: null,
      entities: {
        parishName,
        documentType,
        scheduleEvent,
        datePhrase,
        timePhrase: null,
        priestName: null,
        trackingNumberPresent: false,
      },
      usesPreviousContext: false,
    };
  }

  async interpret({
    sanitizedQuestion,
    conversationContext = null,
    selectedParishName = null,
    signal,
  }) {
    this.calls.push({
      sanitizedQuestion,
      conversationContext: conversationContext ? { ...conversationContext } : null,
      selectedParishName,
    });

    if (this.simulateError) {
      const err = new Error(this.simulateError.message || "Simulated semantic routing failure");
      err.code = this.simulateError.code || "CHATBOT_ROUTING_UNAVAILABLE";
      err.statusCode = this.simulateError.statusCode || 500;
      throw err;
    }

    if (this.customInterpretation !== null) {
      return { ...this.customInterpretation };
    }

    for (const [predicate, result] of this.mockRuleMap.entries()) {
      if (typeof predicate === "function" && predicate(sanitizedQuestion, conversationContext)) {
        return typeof result === "function"
          ? result(sanitizedQuestion, conversationContext)
          : { ...result };
      }
    }

    const result = this._inferDefaultInterpretation(sanitizedQuestion, conversationContext);
    const hasPendingClarification = Boolean(
      conversationContext?.pendingMissingParam ||
      conversationContext?.pendingClarificationIntent ||
      conversationContext?.lastResponseType === "CLARIFICATION"
    );
    if (hasPendingClarification && !result.pendingRelation) {
      result.pendingRelation = "NEW_TOPIC";
    }
    return result;
  }
}
