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

const SOCIAL_RESPONSES = {
  GREETING: "Hi! 👋 How can I help you with TESTIMONIUM today?",
  THANKS: "You're welcome! Let me know if you need help with anything else in TESTIMONIUM.",
  GOODBYE: "Goodbye! Feel free to return if you have more questions about TESTIMONIUM. God bless!",
  HOW_ARE_YOU: "I'm doing well, thank you! How can I assist you with your parish documents or scheduling today?",
  WHO_ARE_YOU: "I'm Caloy, the virtual parish assistant for TESTIMONIUM. I help explain verified guides and procedures for sacramental certificate requests, event scheduling, and parish office workflows.",
  CAPABILITIES: `I can help you with:
- Explaining how to request baptismal, confirmation, marriage, or death certificates
- Understanding document status lifecycles and pickup requirements
- Guidance on uploading payment proofs (like GCash or bank receipts) and manual verification
- Authorization letter requirements for representative requests
- Scheduling sacramental events (baptisms, weddings, blessings) and preferred priest guidelines
- Finding diocese parish contact details and parish directory navigation

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
  const text = rawText
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/[?!.,;:]+$/g, "")
    .replace(/^[?!.,;:]+/g, "")
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

  // 2. Who are you?
  if (
    /^(who\s+are\s+you|who\s+is\s+caloy|what\s+is\s+your\s+name|what\s+are\s+you|introduce\s+yourself)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "WHO_ARE_YOU",
      answer: SOCIAL_RESPONSES.WHO_ARE_YOU,
    };
  }

  // 3. How are you?
  if (
    /^(how\s+are\s+you|how\s+r\s+u|how\s+are\s+you\s+doing|how's\s+it\s+going|how\s+do\s+you\s+do|kamusta|kumusta)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "HOW_ARE_YOU",
      answer: SOCIAL_RESPONSES.HOW_ARE_YOU,
    };
  }

  // 4. What can you do? / Capabilities
  if (
    /^(what\s+can\s+you\s+do|what\s+are\s+your\s+capabilities|how\s+can\s+you\s+help(\s+me)?|what\s+do\s+you\s+do|help|help\s+me|menu|features)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "CAPABILITIES",
      answer: SOCIAL_RESPONSES.CAPABILITIES,
    };
  }

  // 5. Thanks / Gratitude
  if (
    /^(thanks|thank\s+you|thank\s+you\s+very\s+much|many\s+thanks|salamat|maraming\s+salamat|saludo)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "THANKS",
      answer: SOCIAL_RESPONSES.THANKS,
    };
  }

  // 6. Goodbyes
  if (
    /^(bye|bye\s+bye|goodbye|good\s+bye|see\s+you(\s+later)?|see\s+ya|farewell|good\s*night)(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "GOODBYE",
      answer: SOCIAL_RESPONSES.GOODBYE,
    };
  }

  // 7. Greetings
  if (
    /^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|greetings|howdy|magandang\s+(araw|umaga|hapon|gabi))(\s+caloy)?$/i.test(text)
  ) {
    return {
      intent: "GREETING",
      answer: SOCIAL_RESPONSES.GREETING,
    };
  }

  // 8. General out-of-scope non-parish creative/trivia requests (e.g. "write me a poem", "tell me a joke")
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
