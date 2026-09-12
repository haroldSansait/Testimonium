/**
 * Deterministic Social Intent Classifier for Caloy
 *
 * Handles lightweight conversational messages (greetings, thanks, identity,
 * capabilities, goodbyes) with ZERO AI/LLM calls.
 *
 * CRITICAL RULE: Substantive questions containing greetings
 * (e.g. "Hi Caloy, how do I request a baptism certificate?")
 * MUST NOT be classified as social-only and MUST return null to proceed to RAG.
 */

export const SOCIAL_RESPONSES = {
  GREETING: "Hi! 👋 How can I help you with TESTIMONIUM today?",
  THANKS: "You're welcome! Let me know if you need help with anything else in TESTIMONIUM.",
  GOODBYE: "Goodbye! Feel free to return if you have more questions about TESTIMONIUM. God bless!",
  DECLINE_OR_CLOSE: "You're welcome! Feel free to ask anytime if you need help with TESTIMONIUM.",
  HOW_ARE_YOU: "I'm doing well, thank you! How can I assist you with your parish documents or scheduling today?",
  WHO_ARE_YOU: "I'm Caloy, the virtual parish assistant for TESTIMONIUM. I help explain verified guides and procedures for sacramental certificate requests, event scheduling, and parish office workflows.",
  CAPABILITIES: `I can help you with:
- Explaining how to request baptismal, confirmation, or marriage certificates
- Checking current document availability, fees, and requirements at your parish
- Viewing active parish priests and parish office contact details
- Checking sacramental calendar slot availability (baptisms, weddings)
- Tracking your own certificate requests and payment verification status
- Viewing your upcoming scheduled appointments
- Guidance on uploading payment proofs and manual verification
- Authorization letter requirements for representative requests
- Diocese parish contact details and parish directory navigation

What would you like to know more about?`,
  OUT_OF_SCOPE_CASUAL: "I'm specialized as the TESTIMONIUM parish assistant, so I'm focused on helping with church documents, sacraments, and parish workflows. Let me know how I can assist with your parish records or requests!"
};

// Substantive operational keywords that indicate a real RAG query even if prefixed with a greeting
const SUBSTANTIVE_KEYWORDS = [
  "certificate",
  "cert",
  "baptism",
  "baptismal",
  "confirmation",
  "marriage",
  "wedding",
  "funeral",
  "death",
  "schedule",
  "scheduling",
  "appointment",
  "book",
  "booking",
  "reschedule",
  "priest",
  "parish",
  "office",
  "payment",
  "pay",
  "gcash",
  "receipt",
  "status",
  "tracking",
  "authorization",
  "letter",
  "representative",
  "id",
  "fee",
  "fees",
  "cost",
  "price",
  "document",
  "documents",
  "request",
  "requests",
  "sponsor",
  "godparent",
  "mass"
];

export function detectSocialIntent(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  // Normalize: lowercase, collapse whitespace, strip edge punctuation and emojis
  let text = rawText
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/[,\-_/]+/g, " ")
    .replace(/[?!.,;:]+$/g, "")
    .replace(/^[?!.,;:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  // 1. If text contains substantive operational keywords, NEVER classify as social-only
  const hasSubstantiveTerm = SUBSTANTIVE_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(text);
  });

  if (hasSubstantiveTerm) {
    return null;
  }

  // Also check if text looks like a live tool tracking number or live operational query
  if (/\b(sr[-_ ]?\d{4}[-_ ]?\d{6})\b/i.test(text)) {
    return null;
  }

  // Check for leading greeting prefix (e.g. "hello caloy! ", "hi caloy, ", "good morning, ")
  // so compound queries like "Hello Caloy! what do you usually answer?" can resolve
  const greetingPrefixRegex = /^(hello|hi|hey|good\s+(morning|afternoon|evening)|howdy|greetings|kamusta|kumusta)\s*(caloy)?[\s,!.:;-]*/i;
  let coreText = text;
  if (greetingPrefixRegex.test(text)) {
    coreText = text.replace(greetingPrefixRegex, "").trim();
  }

  // Check if coreText (or full text) matches CAPABILITIES
  const capabilityPatterns = [
    /^(what\s+can\s+you\s+do|what\s+are\s+your\s+capabilities|how\s+can\s+you\s+help(\s+me)?|what\s+do\s+you\s+do|help|help\s+me|menu|features)(\s+caloy)?$/i,
    /^(what\s+(do\s+you\s+usually|can\s+i|can\s+you)\s+(answer|ask|help|know|do))(\s+caloy)?$/i,
    /^(what\s+(questions\s+can\s+you\s+answer|can\s+i\s+ask(\s+you)?|do\s+you\s+answer|do\s+you\s+know|are\s+you\s+for))(\s+caloy)?$/i,
    /^(what\s+(do\s+you\s+usually\s+help\s+with|can\s+you\s+help\s+me\s+with|can\s+you\s+help\s+with))(\s+caloy)?$/i,
    /^(what\s+kind\s+of\s+questions\s+can\s+you\s+answer|tell\s+me\s+what\s+you\s+can\s+do)(\s+caloy)?$/i,
  ];

  if (
    capabilityPatterns.some((pat) => pat.test(text) || (coreText && pat.test(coreText)))
  ) {
    return {
      intent: "CAPABILITIES",
      answer: SOCIAL_RESPONSES.CAPABILITIES,
    };
  }

  // 2. Who are you?
  if (
    /^(who\s+are\s+you|who\s+is\s+caloy|what\s+is\s+your\s+name|what\s+are\s+you|introduce\s+yourself)(\s+caloy)?$/i.test(text) ||
    (coreText && /^(who\s+are\s+you|who\s+is\s+caloy|what\s+is\s+your\s+name|what\s+are\s+you|introduce\s+yourself)(\s+caloy)?$/i.test(coreText))
  ) {
    return {
      intent: "WHO_ARE_YOU",
      answer: SOCIAL_RESPONSES.WHO_ARE_YOU,
    };
  }

  // 3. How are you?
  if (
    /^(how\s+are\s+you|how\s+r\s+u|how\s+are\s+you\s+doing|how's\s+it\s+going|how\s+do\s+you\s+do|kamusta|kumusta)(\s+caloy)?$/i.test(text) ||
    (coreText && /^(how\s+are\s+you|how\s+r\s+u|how\s+are\s+you\s+doing|how's\s+it\s+going|how\s+do\s+you\s+do)(\s+caloy)?$/i.test(coreText))
  ) {
    return {
      intent: "HOW_ARE_YOU",
      answer: SOCIAL_RESPONSES.HOW_ARE_YOU,
    };
  }

  // 3.5 Decline or Acknowledgement / Closing (e.g. "No, thanks", "No thanks", "Okay thanks", "Sige salamat", "Way kaso ah", "Okay lang")
  if (
    /^(no(\s*,)?\s*thanks?|no\s+thank\s+you|okay(\s*,)?\s*thanks?|ok\s+thanks?|sige(\s*,)?\s*salamat|salamat\s+gid|way\s+kaso(\s+ah)?|okay\s+lang|ok\s+lang)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "DECLINE_OR_CLOSE",
      answer: SOCIAL_RESPONSES.DECLINE_OR_CLOSE,
    };
  }

  // 4. Thanks / Gratitude
  if (
    /^(thanks|thank\s+you|thank\s+you\s+very\s+much|many\s+thanks|salamat|maraming\s+salamat|daghang\s+salamat|saludo)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "THANKS",
      answer: SOCIAL_RESPONSES.THANKS,
    };
  }

  // 5. Goodbyes
  if (
    /^(bye|bye\s+bye|goodbye|good\s+bye|see\s+you(\s+later)?|see\s+ya|farewell|good\s*night)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "GOODBYE",
      answer: SOCIAL_RESPONSES.GOODBYE,
    };
  }

  // 6. Greetings (only when coreText is empty or pure greeting)
  if (
    /^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|greetings|howdy|magandang\s+(araw|umaga|hapon|gabi)|maayong\s+(aga|hapon|gab-i|buntag))(\s+caloy)?$/i.test(text) ||
    (coreText === "" && greetingPrefixRegex.test(text))
  ) {
    return {
      intent: "GREETING",
      answer: SOCIAL_RESPONSES.GREETING,
    };
  }

  // 7. General out-of-scope non-parish creative/trivia requests (e.g. "write me a poem", "tell me a joke")
  if (
    /^(write(\s+me)?\s+(a\s+)?([a-z\s]*)(poem|story|song|joke|essay|code|letter)|tell(\s+me)?\s+(a\s+)?joke|who\s+is\s+the\s+president)$/i.test(text)
  ) {
    return {
      intent: "OUT_OF_SCOPE_CASUAL",
      answer: SOCIAL_RESPONSES.OUT_OF_SCOPE_CASUAL,
    };
  }

  return null;
}

/**
 * Zero-cost fast-path ONLY for unambiguous, trivial, single-purpose greetings/thanks/goodbyes.
 * Substantive messages (including greetings with questions or inquiries) return null.
 */
export function detectTrivialSocial(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  const clean = rawText
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/[?!.,;:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // If text contains question words or substantive concepts, NEVER fast-path to trivial social!
  if (/\b(who|what|where|when|why|how|can|is|are|do|does|did|cost|fee|price|priest|office|schedule|slot|status|cert|certificate|request|payment)\b/i.test(clean)) {
    return null;
  }

  if (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|howdy|magandang\s+(umaga|hapon|gabi|araw)|maayong\s+(aga|hapon|gab-i|buntag))(\s+caloy)?$/i.test(clean)) {
    return {
      intent: "GREETING",
      answer: SOCIAL_RESPONSES.GREETING,
    };
  }

  if (/^(thanks|thank\s+you|salamat|maraming\s+salamat|daghang\s+salamat)(\s+caloy)?$/i.test(clean)) {
    return {
      intent: "THANKS",
      answer: SOCIAL_RESPONSES.THANKS,
    };
  }

  if (
    /^(no(\s*,)?\s*thanks?|no\s+thank\s+you|okay(\s*,)?\s*thanks?|ok\s+thanks?|sige(\s*,)?\s*salamat|salamat\s+gid|way\s+kaso(\s+ah)?|okay\s+lang|ok\s+lang)(\s+caloy)?$/i.test(clean)
  ) {
    return {
      intent: "DECLINE_OR_CLOSE",
      answer: SOCIAL_RESPONSES.DECLINE_OR_CLOSE,
    };
  }

  if (/^(bye|goodbye|see\s+ya)(\s+caloy)?$/i.test(clean)) {
    return {
      intent: "GOODBYE",
      answer: SOCIAL_RESPONSES.GOODBYE,
    };
  }

  return null;
}
