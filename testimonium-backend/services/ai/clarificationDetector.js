/**
 * Deterministic Contextual Clarification Detector for Caloy
 *
 * Detects questions whose factual answer depends specifically on parish context
 * (such as fees/pricing, local office hours, or specific physical parish details)
 * when NO parish is currently selected by the parishioner.
 *
 * ZERO AI/Gemini calls.
 */

// Patterns indicating parish-dependent attributes
const PARISH_DEPENDENT_PATTERNS = [
  // Fees, costs, pricing, donations, stipends
  /\b(how\s+much\s+(is|does|are|for)|fee|fees|cost|costs|price|pricing|stipend|payment\s+amount|how\s+much\s+to\s+pay)\b/i,
  // Office hours, open/closing times
  /\b(office\s+hours|opening\s+hours|closing\s+hours|what\s+time\s+(does|is)\s+(the\s+)?(parish\s+)?office|when\s+(does|is)\s+(the\s+)?(parish\s+)?office\s+(open|close))\b/i,
];

// Explicit exclusions that refer to DIOCESE/SYSTEM procedures rather than local parish facts
const SYSTEM_EXCLUSIONS = [
  // Questions about how payments work in general
  /\b(how\s+to\s+pay|upload\s+payment|payment\s+proof|verify|verified|automatic)\b/i,
];

export function detectClarificationNeeded(normalizedQuestion, selectedParishId = null) {
  // If a parish is already selected, clarification is NOT needed; proceed to RAG (DIOCESE + PARISH)
  if (selectedParishId !== null && selectedParishId !== undefined && Number(selectedParishId) > 0) {
    return null;
  }

  if (!normalizedQuestion || typeof normalizedQuestion !== "string") {
    return null;
  }

  const text = normalizedQuestion.trim();

  // Check exclusions first (e.g. "Is my GCash payment verified automatically?" or "How to upload payment proof?")
  const isSystemQuestion = SYSTEM_EXCLUSIONS.some((pat) => pat.test(text));
  if (isSystemQuestion) {
    return null;
  }

  // Check if question asks about parish-dependent facts
  const isParishDependent = PARISH_DEPENDENT_PATTERNS.some((pat) => pat.test(text));
  if (isParishDependent) {
    return {
      clarificationType: "PARISH",
      answer: "Document fees, handling requirements, and office hours can vary by parish. Which parish are you referring to?",
      fallback: false,
      sources: [],
    };
  }

  return null;
}
