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
          intent: null,
          entities: {
            parishName: null,
            documentType: null,
            scheduleEvent: null,
            datePhrase: null,
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
    if (/\b(wedding|kasal)\b/i.test(text)) scheduleEvent = "WEDDING";
    if (/\b(baptism|binyag)\b/i.test(text)) scheduleEvent = "BAPTISM";

    let datePhrase = null;
    if (/tomorrow/i.test(text)) datePhrase = "tomorrow";
    if (/today/i.test(text)) datePhrase = "today";
    if (/next\s+saturday/i.test(text)) datePhrase = "next Saturday";
    else if (/saturday/i.test(text)) datePhrase = "Saturday";

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
            trackingNumberPresent: false,
          },
          usesPreviousContext: true,
        };
      }

      if (/\b(how\s+about|what\s+about|in\s+here|there)\b/i.test(text)) {
        return {
          route: "LIVE_TOOL",
          intent: conversationContext.lastIntent,
          entities: {
            parishName: parishName || conversationContext.lastParishName || null,
            documentType: documentType || conversationContext.lastDocumentType || null,
            scheduleEvent: scheduleEvent || conversationContext.lastScheduleEvent || null,
            datePhrase: datePhrase || conversationContext.lastDatePhrase || null,
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

    if (
      /\b(slots?|availability|schedules?|open\s+for|anything\s+open)\b/i.test(
        text
      )
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_CALENDAR_SLOT_AVAILABILITY",
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
      /\b(documents\s+(are\s+available|can\s+i\s+request|do\s+you\s+offer)|available\s+documents)\b/i.test(
        text
      ) &&
      !/\btestimonium\s+support\b/i.test(text)
    ) {
      return {
        route: "LIVE_TOOL",
        intent: "GET_PARISH_DOCUMENTS",
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

    // Default RAG
    return {
      route: "RAG",
      intent: null,
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

    return this._inferDefaultInterpretation(sanitizedQuestion, conversationContext);
  }
}
