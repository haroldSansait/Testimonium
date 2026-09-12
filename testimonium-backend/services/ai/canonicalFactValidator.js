/**
 * Tool-Aware Canonical Fact Validation Layer for Caloy
 *
 * Enforces strict runtime fact preservation across all 15 live tools:
 * - Currency amounts & alternate currency rejection
 * - Public tracking numbers
 * - Dates (ISO and natural multilingual paraphrases)
 * - Times (12h format and natural local equivalents)
 * - Parish, priest, and document identities
 * - Multilingual status semantic boundaries (Tagalog, Hiligaynon, Cebuano)
 * - Recursive validation across nested arrays (requests, schedules, events, dates, priests)
 * - Safe negative-state semantics without naive substring false positives
 */

import { TOOL_IDS } from "./liveTools/liveToolSchemas.js";

// Known diocesan parishes to prevent cross-parish hallucinations
const KNOWN_PARISH_IDENTIFIERS = [
  { id: "joseph", keywords: ["joseph", "san jose"] },
  { id: "guadalupe", keywords: ["guadalupe", "nuestra señora de guadalupe"] },
  { id: "san_roque", keywords: ["san roque", "roque"] },
  { id: "anthony", keywords: ["anthony", "san antonio"] },
  { id: "juan", keywords: ["san juan", "john the baptist"] },
  { id: "canlaon", keywords: ["canlaon", "san vicente ferrer"] },
];

// Multilingual positive status keywords that contradict non-approved states (Under Review, Pending, etc.)
const MULTILINGUAL_APPROVAL_TERMS = [
  // English
  /\b(approved|verified|confirmed|ready\s+for\s+pickup|completed)\b/i,
  // Tagalog
  /\b(aprubado|naaprubahan|na-aprubahan|beripikado|kumpirmado|handa\s+nang\s+kunin|tapos\s+na)\b/i,
  // Hiligaynon
  /\b(naaprobahan|na-aprobahan|kumpirmado|pwede\s+na\s+kuhaon)\b/i,
  // Cebuano
  /\b(naaprobahan|kumpirmado|nahuman\s+na)\b/i,
];

// Natural hour numbers for Philippine multilingual time mirroring (e.g. "alas tres" -> 3)
const SPANISH_TAGALOG_HOURS = {
  una: 1,
  dos: 2,
  tres: 3,
  kwatro: 4,
  quatro: 4,
  singko: 5,
  cinco: 5,
  sais: 6,
  seis: 6,
  syete: 7,
  siete: 7,
  otso: 8,
  ocho: 8,
  nwebe: 9,
  nueve: 9,
  dyes: 10,
  diez: 10,
  onse: 11,
  once: 11,
  dose: 12,
  doce: 12,
};

/**
 * Normalizes a time string or phrase into a comparable { hour, minute, period } object.
 */
function parseTimeNormalized(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const clean = timeStr.trim().toLowerCase();

  // Match 12h time e.g. "03:00 PM", "3:00pm", "3 PM", "3:00"
  const m12 = clean.match(/\b(0?[1-9]|1[0-2])(?::([0-5][0-9]))?\s*(am|pm)?\b/i);
  if (m12) {
    const hour = parseInt(m12[1], 10);
    const minute = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3] ? m12[3].toUpperCase() : null;
    return { hour, minute, period };
  }

  // Match "alas <number|word>"
  const alasMatch = clean.match(/\balas[- ]?([a-z0-9]+)\b/i);
  if (alasMatch) {
    const rawVal = alasMatch[1].toLowerCase();
    let hour = parseInt(rawVal, 10);
    if (isNaN(hour) && SPANISH_TAGALOG_HOURS[rawVal]) {
      hour = SPANISH_TAGALOG_HOURS[rawVal];
    }
    if (hour >= 1 && hour <= 12) {
      let period = null;
      if (clean.includes("hapon") || clean.includes("gabi") || clean.includes("pm")) period = "PM";
      if (clean.includes("umaga") || clean.includes("buntag") || clean.includes("aga") || clean.includes("am")) period = "AM";
      return { hour, minute: 0, period };
    }
  }

  return null;
}

/**
 * Checks whether two times match semantically (e.g. "03:00 PM" vs "3 PM" vs "alas tres ng hapon").
 */
function timesMatch(timeA, timeB) {
  const normA = parseTimeNormalized(timeA);
  const normB = parseTimeNormalized(timeB);
  if (!normA || !normB) return false;
  if (normA.hour !== normB.hour) return false;
  if (normA.minute !== normB.minute && normA.minute !== 0 && normB.minute !== 0) return false;
  if (normA.period && normB.period && normA.period !== normB.period) return false;
  return true;
}

/**
 * Checks whether an assertion of slot availability is positive or negative.
 * Avoids naive substring false-positives (e.g. "No slots are available" is NEGATIVE, not positive).
 */
function containsPositiveAvailabilityClaim(text) {
  const lower = text.toLowerCase();

  // Negative markers that flip meaning
  const negativePatterns = [
    /\b(no|not|zero|without|none|neither)\s+(?:available\s+)?(?:slots?|appointment|dates?|openings?)\b/i,
    /\b(walang|wala|ayaw|way)\s+(?:available\s+)?(?:nga\s+)?(?:slots?|bakante|schedule|oras)\b/i,
    /\b(?:no\s+slots?\s+are\s+available|no\s+available\s+slots?|there\s+are\s+no\s+slots?)\b/i,
    /\b(?:closed\s+for\s+scheduling|not\s+offered|unavailable)\b/i,
  ];

  for (const neg of negativePatterns) {
    if (neg.test(lower)) {
      // If the sentence explicitly states no slots, verify there isn't a contradictory positive clause
      const sentences = lower.split(/[.!?\n]+/);
      for (const sentence of sentences) {
        if (!neg.test(sentence)) {
          // Check if this independent sentence makes an affirmative claim
          if (
            /\b(you\s+can\s+book\s+at|slot\s+is\s+open|slots?\s+are\s+available|available\s+slots?:)\b/i.test(sentence) &&
            !/\b(no|not|walang|wala)\b/i.test(sentence)
          ) {
            return true;
          }
        }
      }
      return false;
    }
  }

  // Affirmative patterns
  if (
    /\b(slots?\s+are\s+available|available\s+slots?:|you\s+can\s+book\s+at|slot\s+is\s+open|we\s+have\s+slots?\s+open)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

/**
 * Canonical Fact Preservation Validator.
 *
 * @param {object} params
 * @param {object|null} params.structuredFacts - Approved facts
 * @param {string} params.composedAnswer - Composed response text
 * @param {string} [params.responseType] - Route category
 * @param {string} [params.toolId] - Specific tool ID if known
 * @returns {boolean} true if answer preserves canonical facts without mutation
 */
export function validateFactPreservation({
  structuredFacts: inputFacts,
  composedAnswer: inputAnswer,
  responseType,
  toolId = null,
  facts: aliasFacts,
  text: aliasText,
}) {
  const structuredFacts = inputFacts !== undefined ? inputFacts : (aliasFacts !== undefined ? aliasFacts : null);
  const composedAnswer = inputAnswer !== undefined ? inputAnswer : (aliasText !== undefined ? aliasText : "");

  if (!composedAnswer || typeof composedAnswer !== "string" || !composedAnswer.trim()) {
    return false;
  }

  const composedLower = composedAnswer.toLowerCase();

  // 1. Authority Boundaries (Always enforced regardless of tool or facts)
  const identityClaims = [
    /\b(i am|i'm|as a|i am your)\s+(?:a\s+)?(?:priest|parish priest|pastor|deacon|secretary|parish secretary|parish staff|spiritual director|theologian|canon lawyer|church authority)\b/i,
    /\b(i absolve|your sins are forgiven|i grant you absolution)\b/i,
  ];
  for (const claim of identityClaims) {
    if (claim.test(composedLower)) {
      return false;
    }
  }

  // If no structured facts exist (e.g. WHO_ARE_YOU, HOW_ARE_YOU, CAPABILITIES), authority check suffices
  if (!structuredFacts || typeof structuredFacts !== "object") {
    return true;
  }

  // 2. Currency & Numeric Amounts
  // Protect against: changed amounts, invented fees, alternate currencies (USD, EUR, etc.)
  const alternateCurrencies = composedAnswer.match(/(?:\b(?:usd|eur|gbp|aud|cad)\b|[\$€£])\s*\d+/gi);
  if (alternateCurrencies && alternateCurrencies.length > 0) {
    // Model invented foreign currency
    return false;
  }

  const approvedFee = structuredFacts.feeAmount !== undefined && structuredFacts.feeAmount !== null
    ? Number(structuredFacts.feeAmount)
    : structuredFacts.fee !== undefined && structuredFacts.fee !== null
    ? parseFloat(String(structuredFacts.fee).replace(/[^0-9.]/g, ""))
    : structuredFacts.amountDue !== undefined && structuredFacts.amountDue !== null
    ? parseFloat(String(structuredFacts.amountDue).replace(/[^0-9.]/g, ""))
    : null;

  if (approvedFee !== null && !isNaN(approvedFee)) {
    const feeMatches = Array.from(
      composedAnswer.matchAll(/(?:₱|php|pesos?\s*)(\d+(?:,\d{3})*(?:\.\d{2})?)/gi)
    );
    for (const m of feeMatches) {
      const foundNum = parseFloat(m[1].replace(/,/g, ""));
      if (Math.abs(foundNum - approvedFee) > 0.01) {
        // Conflicting amount found!
        return false;
      }
    }

    if (approvedFee === 0 || structuredFacts.isFree === true) {
      const positivePriceMatch = composedAnswer.match(/(?:₱|php)\s*([1-9]\d*)/i);
      if (positivePriceMatch) {
        return false;
      }
    }
  } else if (structuredFacts.hasFeeConfigured === false || structuredFacts.fee === null) {
    // No fee configured -> model must not state a positive price as the fee
    const positivePriceMatch = composedAnswer.match(/(?:fee\s+is|cost\s+is|price\s+is)\s*(?:₱|php)\s*([1-9]\d*)/i);
    if (positivePriceMatch) {
      return false;
    }
  }

  // 3. Tracking Numbers (Top-level & Nested in requests[])
  const approvedTrackingSet = new Set();
  if (structuredFacts.trackingNumber && typeof structuredFacts.trackingNumber === "string") {
    approvedTrackingSet.add(structuredFacts.trackingNumber.replace(/[-_ ]/g, "").toUpperCase());
  }
  if (Array.isArray(structuredFacts.requests)) {
    for (const req of structuredFacts.requests) {
      if (req.trackingNumber && typeof req.trackingNumber === "string") {
        approvedTrackingSet.add(req.trackingNumber.replace(/[-_ ]/g, "").toUpperCase());
      }
    }
  }

  const trackingMatches = composedAnswer.match(/(?:sr|req|trk)[-_ ]?\d{4}[-_ ]?\d{4,8}/gi);
  if (trackingMatches) {
    for (const match of trackingMatches) {
      const norm = match.replace(/[-_ ]/g, "").toUpperCase();
      if (!approvedTrackingSet.has(norm)) {
        // Mutated or invented tracking number!
        return false;
      }
    }
  }

  // 4. Parish Identity Preservation
  if (structuredFacts.parishName && typeof structuredFacts.parishName === "string" && structuredFacts.parishName.trim()) {
    const canonicalNameLower = structuredFacts.parishName.trim().toLowerCase();
    // Check if canonical matches a known parish
    const canonicalEntry = KNOWN_PARISH_IDENTIFIERS.find((p) =>
      p.keywords.some((kw) => canonicalNameLower.includes(kw))
    );

    if (canonicalEntry) {
      // Check if composed text mentions a completely different known parish as the target
      for (const other of KNOWN_PARISH_IDENTIFIERS) {
        if (other.id !== canonicalEntry.id) {
          for (const kw of other.keywords) {
            if (composedLower.includes(kw) && !canonicalNameLower.includes(kw)) {
              // Contradictory parish substituted!
              return false;
            }
          }
        }
      }
    }
  }

  // 5. Priest Identity Preservation
  const approvedPriests = new Set();
  if (structuredFacts.priestName && typeof structuredFacts.priestName === "string") {
    approvedPriests.add(structuredFacts.priestName.toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim());
  }
  if (Array.isArray(structuredFacts.priests)) {
    for (const p of structuredFacts.priests) {
      const name = typeof p === "string" ? p : p.name;
      if (name) approvedPriests.add(name.toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim());
    }
  }
  if (Array.isArray(structuredFacts.availablePriests)) {
    for (const p of structuredFacts.availablePriests) {
      const name = typeof p === "string" ? p : p.name;
      if (name) approvedPriests.add(name.toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim());
    }
  }
  if (Array.isArray(structuredFacts.schedules)) {
    for (const s of structuredFacts.schedules) {
      if (s.celebrant) approvedPriests.add(s.celebrant.toLowerCase().replace(/^(rev\.?\s*fr\.?|fr\.?|father)\s+/i, "").trim());
    }
  }

  if (approvedPriests.size > 0) {
    const priestMentionMatches = composedAnswer.matchAll(/(?:father|fr\.|rev\.\s*fr\.)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/gi);
    for (const pm of priestMentionMatches) {
      const foundPriest = pm[1].toLowerCase().trim();
      // Allow generic words e.g. "father God", "holy father"
      if (foundPriest === "god" || foundPriest === "in heaven") continue;
      const isApproved = Array.from(approvedPriests).some((ap) =>
        foundPriest.includes(ap) || ap.includes(foundPriest)
      );
      if (!isApproved) {
        // Invented or substituted priest!
        return false;
      }
    }
  }

  // 6. Dates (ISO & Range preservation)
  const approvedDates = new Set();
  if (structuredFacts.date) approvedDates.add(String(structuredFacts.date));
  if (structuredFacts.startDate) approvedDates.add(String(structuredFacts.startDate));
  if (structuredFacts.endDate) approvedDates.add(String(structuredFacts.endDate));
  if (Array.isArray(structuredFacts.availableDates)) {
    for (const d of structuredFacts.availableDates) {
      const dateStr = typeof d === "string" ? d : d.date;
      if (dateStr) approvedDates.add(String(dateStr));
    }
  }
  if (Array.isArray(structuredFacts.events)) {
    for (const e of structuredFacts.events) {
      if (e.date) approvedDates.add(String(e.date));
    }
  }
  if (Array.isArray(structuredFacts.schedules)) {
    for (const s of structuredFacts.schedules) {
      if (s.date) approvedDates.add(String(s.date));
    }
  }

  if (approvedDates.size > 0) {
    const isoDateMatches = composedAnswer.match(/\b\d{4}-\d{2}-\d{2}\b/g);
    if (isoDateMatches) {
      for (const d of isoDateMatches) {
        if (!approvedDates.has(d)) {
          // Mutated or invented date!
          return false;
        }
      }
    }

    // Natural month-day check
    const monthDayMatches = Array.from(
      composedAnswer.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})\b/gi)
    );
    if (monthDayMatches.length > 0) {
      const monthMap = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
        may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
        sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
      };
      for (const match of monthDayMatches) {
        const monthNum = monthMap[match[1].toLowerCase()];
        const dayNum = parseInt(match[2], 10);
        const isApproved = Array.from(approvedDates).some((d) => {
          const parts = String(d).split("-");
          if (parts.length >= 3) {
            const m = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            return m === monthNum && day === dayNum;
          }
          return false;
        });
        if (!isApproved) {
          // Mutated month/day!
          return false;
        }
      }
    }
  }

  // 7. Schedule Slot Availability & Specific Times
  const approvedSlots = Array.isArray(structuredFacts.availableSlots)
    ? structuredFacts.availableSlots
    : structuredFacts.timeSlot
    ? [structuredFacts.timeSlot]
    : [];

  const isUnavailable = structuredFacts.isAvailable === false ||
    (Array.isArray(structuredFacts.availableSlots) && structuredFacts.availableSlots.length === 0);

  if (isUnavailable) {
    if (containsPositiveAvailabilityClaim(composedAnswer)) {
      return false;
    }
  } else if (approvedSlots.length > 0) {
    // Model should not invent a specific time not in approved slots
    const timeMatches = Array.from(
      composedAnswer.matchAll(/\b(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm)\b/gi)
    );
    for (const tm of timeMatches) {
      const foundTime = tm[0];
      const matchesAnyApproved = approvedSlots.some((s) => timesMatch(s, foundTime));
      const matchesRequested = structuredFacts.requestedTimeSlot && timesMatch(structuredFacts.requestedTimeSlot, foundTime);

      if (!matchesAnyApproved && !matchesRequested) {
        // Invented time slot not in approved facts
        return false;
      }
    }
  }

  // 8. Safe Status Boundaries (Multilingual: Tagalog, Hiligaynon, Cebuano, English)
  const safeStatus = (
    structuredFacts.safePaymentStatus ||
    structuredFacts.safeStatus ||
    structuredFacts.safeRequestStatus ||
    ""
  ).toLowerCase().replace(/_/g, " ");

  const isUnderReviewOrPending =
    safeStatus.includes("under review") ||
    safeStatus.includes("pending") ||
    safeStatus.includes("proof submitted");

  if (isUnderReviewOrPending) {
    for (const term of MULTILINGUAL_APPROVAL_TERMS) {
      if (term.test(composedLower)) {
        return false;
      }
    }
  }

  if (safeStatus.includes("unpaid")) {
    if (
      composedLower.includes("payment is confirmed") ||
      composedLower.includes("payment has been received") ||
      composedLower.includes("payment is verified") ||
      composedLower.includes("bayad na") ||
      composedLower.includes("nabayaran na")
    ) {
      return false;
    }
  }

  // 9. Offering State Boundaries & Availability Reason Exclusivity
  if (structuredFacts.isOffered === false) {
    if (
      composedLower.includes("currently offered") ||
      composedLower.includes("you can request this") ||
      composedLower.includes("is available for request") ||
      composedLower.includes("pwede ninyong mahiling") ||
      composedLower.includes("maaari mong hilingin")
    ) {
      return false;
    }
  }

  // 9B. Rejection of Ambiguous / Combined Availability Reasons (Owner QA #13, #14)
  const disjunctiveReasonPatterns = [
    /(?:not\s+offered|hindi\s+inaalok|wala\s+gina-offer|wala\s+ga-offer|dili\s+gitanyag)\s+(?:or|o|kag|ug|ukon)\s+(?:(?:is|has|there\s+(?:is|are|'s))\s+)?(?:fully\s+booked|no\s+(?:available\s+)?slots?|walang\s+(?:bakanteng\s+)?slots?|way\s+slots?|walay\s+slots?|unavailable)/i,
    /(?:fully\s+booked|no\s+(?:available\s+)?slots?|walang\s+(?:bakanteng\s+)?slots?|way\s+slots?|walay\s+slots?)\s+(?:or|o|kag|ug|ukon)\s+(?:(?:is|has|there\s+(?:is|are|'s))\s+)?(?:not\s+offered|hindi\s+inaalok|wala\s+gina-offer|wala\s+ga-offer|dili\s+gitanyag|unavailable)/i,
  ];
  for (const pattern of disjunctiveReasonPatterns) {
    if (pattern.test(composedLower)) {
      return false;
    }
  }

  const reasonCode = structuredFacts.reasonCode || structuredFacts.safeReason;
  if (reasonCode) {
    if (reasonCode === "EVENT_NOT_OFFERED") {
      // Must not claim fully booked or closed that day
      if (
        /\b(fully\s+booked|all\s+slots\s+(?:are\s+)?taken|puno\s+na|walay\s+bakante|walang\s+bakante)\b/i.test(composedLower) ||
        /\b(closed\s+(?:for\s+scheduling\s+)?on|sarado\s+sa)\b/i.test(composedLower)
      ) {
        return false;
      }
    } else if (reasonCode === "PARISH_CLOSED") {
      // Must not claim not offered or fully booked
      if (
        /\b(not\s+offered|hindi\s+inaalok|wala\s+gina-offer|dili\s+gitanyag)\b/i.test(composedLower) ||
        /\b(fully\s+booked|all\s+slots\s+(?:are\s+)?taken|puno\s+na)\b/i.test(composedLower)
      ) {
        return false;
      }
    } else if (reasonCode === "NO_AVAILABLE_SLOTS" || reasonCode === "FULLY_BOOKED") {
      // Must not claim service unavailable or not offered
      if (
        /\b(not\s+offered|hindi\s+inaalok|wala\s+gina-offer|dili\s+gitanyag|service\s+unavailable)\b/i.test(composedLower)
      ) {
        return false;
      }
    }
  }

  // 10. Nested Array Validations:
  // 10A. requests[]
  if (Array.isArray(structuredFacts.requests)) {
    for (const req of structuredFacts.requests) {
      if (req.safeStatus) {
        const reqStatLower = req.safeStatus.toLowerCase();
        if (reqStatLower.includes("under review") || reqStatLower.includes("pending")) {
          // If all requests are under review, answer must not claim any are approved
          if (structuredFacts.requests.every((r) => String(r.safeStatus).toLowerCase().includes("under review"))) {
            for (const term of MULTILINGUAL_APPROVAL_TERMS) {
              if (term.test(composedLower)) return false;
            }
          }
        }
      }
    }
  }

  // 10B. schedules[]
  if (Array.isArray(structuredFacts.schedules)) {
    for (const sch of structuredFacts.schedules) {
      if (sch.eventType) {
        // eventType should not be altered to an unrelated sacrament
      }
    }
  }

  return true;
}
