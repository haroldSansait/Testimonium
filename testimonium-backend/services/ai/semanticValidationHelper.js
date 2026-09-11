import { CANONICAL_DOCUMENT_TYPES, normalizeDocumentType } from "../../config/documents.js";
import { getManilaDateString, isValidStrictManilaDate } from "../ConflictHelper.js";

export const TRACKING_NUMBER_REGEX = /\b(SR[-_ ]?\d{4}[-_ ]?\d{6})\b/i;

export const CANONICAL_SCHEDULE_EVENTS = [
  "WEDDING",
  "BAPTISM",
  "CONFIRMATION",
  "PRIVATE_MASS",
  "MASS_INTENTION",
  "MARRIAGE_SPECIAL",
  "WAKE_MASS",
  "FUNERAL",
  "ANOINTING_OF_THE_SICK",
  "FIESTA",
  "BLESSING",
  "DELIVERANCE",
  "THANKSGIVING",
  "FIRST_COMMUNION",
  "MASS_OF_HOLY_SPIRIT",
  "CONFESSION",
];

const SCHEDULE_EVENT_SYNONYMS = {
  WEDDING: ["wedding", "kasal", "matrimony", "nuptial", "marriage"],
  BAPTISM: ["baptism", "binyag", "christening", "bautismo"],
  CONFIRMATION: ["confirmation", "kumpil"],
  PRIVATE_MASS: ["private mass", "special mass"],
  MASS_INTENTION: ["mass intention", "pamisa", "intention"],
  MARRIAGE_SPECIAL: ["marriage special", "special wedding"],
  WAKE_MASS: ["wake mass", "misa sa patay", "wake"],
  FUNERAL: ["funeral", "burial", "libing", "requiem"],
  ANOINTING_OF_THE_SICK: ["anointing", "anointing of the sick", "oil of the sick", "viaticum"],
  FIESTA: ["fiesta", "fiesta mass", "feast"],
  BLESSING: ["blessing", "bendisyon", "house blessing", "car blessing"],
  DELIVERANCE: ["deliverance", "exorcism"],
  THANKSGIVING: ["thanksgiving", "thanksgiving mass"],
  FIRST_COMMUNION: ["first communion", "komunyon"],
  MASS_OF_HOLY_SPIRIT: ["mass of holy spirit", "holy spirit mass"],
  CONFESSION: ["confession", "kumpisal", "reconciliation"],
};

/**
 * Extracts and canonicalizes tracking number from text if present.
 * e.g. "SR 2026 000123" -> "SR-2026-000123"
 */
export function extractTrackingNumber(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(TRACKING_NUMBER_REGEX);
  if (match) {
    return match[1].replace(/[-_ ]/g, "-").toUpperCase();
  }
  return null;
}

/**
 * Replaces sensitive tracking numbers with generic placeholder <TRACKING_NUMBER>
 * so private identifiers are not sent to the model.
 */
export function sanitizeQuestionForModel(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(TRACKING_NUMBER_REGEX, "<TRACKING_NUMBER>");
}

/**
 * Resolves natural parish names against the current list of active parishes.
 * Performs resilient normalization (punctuation, 'St.' vs 'Saint', trailing 'Parish').
 *
 * @param {string} rawParishName
 * @param {Array<{ id: number, parishName: string }>} activeParishes
 * @returns {{ id: number, parishName: string } | null}
 */
export function resolveParish(rawParishName, activeParishes = []) {
  if (!rawParishName || typeof rawParishName !== "string" || !Array.isArray(activeParishes)) {
    return null;
  }

  const clean = (str) =>
    str
      .toLowerCase()
      .replace(/[\.,'-]/g, " ")
      .replace(/\bst\b/g, "saint")
      .replace(/\bparish\b/g, "")
      .replace(/\bchurch\b/g, "")
      .replace(/\bof\b/g, "")
      .replace(/\bthe\b/g, "")
      .replace(/\bour\s+lady\b/g, "lady")
      .replace(/\s+/g, " ")
      .trim();

  const queryNorm = clean(rawParishName);
  if (!queryNorm) return null;

  // 1. Exact match on cleaned name
  for (const parish of activeParishes) {
    const parishNorm = clean(parish.parishName);
    if (parishNorm === queryNorm) {
      return parish;
    }
  }

  // 2. Contains match: e.g. query "guadalupe" matches "our lady of guadalupe",
  // "st joseph" matches "st. joseph parish"
  for (const parish of activeParishes) {
    const parishNorm = clean(parish.parishName);
    if (parishNorm.includes(queryNorm) || queryNorm.includes(parishNorm)) {
      return parish;
    }
  }

  // 3. Word tokens match (e.g. "Joseph" in "Saint Joseph")
  const queryTokens = queryNorm.split(" ").filter((t) => t.length > 2);
  if (queryTokens.length > 0) {
    for (const parish of activeParishes) {
      const parishNorm = clean(parish.parishName);
      if (queryTokens.every((token) => parishNorm.includes(token))) {
        return parish;
      }
    }
  }

  return null;
}

/**
 * Validates and normalizes document type against canonical TESTIMONIUM document config.
 * Specifically checks for unsupported document types (e.g. Death Certificate) to ensure
 * they are NEVER silently mapped to supported types.
 *
 * @param {string} rawDocType
 * @returns {{ documentType: string | null, isSupported: boolean, unsupportedReason?: string }}
 */
export function resolveDocumentType(rawDocType) {
  if (!rawDocType || typeof rawDocType !== "string") {
    return { documentType: null, isSupported: false };
  }

  const trimmed = rawDocType.trim();
  const lower = trimmed.toLowerCase();

  // Explicit check for known unsupported document types
  if (
    lower.includes("death") ||
    lower.includes("patay") ||
    lower.includes("burial cert") ||
    lower.includes("libing cert")
  ) {
    return {
      documentType: null,
      isSupported: false,
      unsupportedReason: "DEATH_CERTIFICATE",
    };
  }

  // Semantic document concept mapping
  if (/\b(baptism|baptismal|binyag)\b/i.test(lower)) {
    return { documentType: "BAPTISMAL_CERTIFICATE", isSupported: true };
  }
  if (/\b(confirmation|kumpil)\b/i.test(lower)) {
    return { documentType: "CONFIRMATION_CERTIFICATE", isSupported: true };
  }
  if (/\b(marriage|wedding|kasal)\s*(certificate|cert)?\b/i.test(lower) && !lower.includes("banns") && !lower.includes("permit")) {
    return { documentType: "MARRIAGE_CERTIFICATE", isSupported: true };
  }
  if (/\b(first\s+communion|communion|komunyon)\b/i.test(lower)) {
    return { documentType: "FIRST_COMMUNION_CERTIFICATE", isSupported: true };
  }
  if (/\b(marriage\s+banns|banns|tawag\s+sa\s+kasal)\b/i.test(lower)) {
    return { documentType: "MARRIAGE_BANNS", isSupported: true };
  }
  if (/\b(permit\s+to\s+marry|marriage\s+permit)\b/i.test(lower)) {
    return { documentType: "PERMIT_TO_MARRY", isSupported: true };
  }
  if (/\b(status\s+of\s+liberty|status\s+liber|liberty\s+cert)\b/i.test(lower)) {
    return { documentType: "STATUS_OF_LIBERTY", isSupported: true };
  }

  // Canonical normalization
  const normalized = normalizeDocumentType(trimmed);
  if (normalized && CANONICAL_DOCUMENT_TYPES.includes(normalized)) {
    return { documentType: normalized, isSupported: true };
  }

  return { documentType: null, isSupported: false, unsupportedReason: "UNKNOWN_DOCUMENT" };
}

/**
 * Validates and resolves schedule event against canonical 16 ScheduleEventType enum values.
 *
 * @param {string} rawEventType
 * @returns {string | null}
 */
export function resolveScheduleEventType(rawEventType) {
  if (!rawEventType || typeof rawEventType !== "string") {
    return null;
  }

  const clean = rawEventType.toUpperCase().replace(/[\s-]+/g, "_").trim();
  if (CANONICAL_SCHEDULE_EVENTS.includes(clean)) {
    return clean;
  }

  const lower = rawEventType.toLowerCase().trim();
  for (const [event, synonyms] of Object.entries(SCHEDULE_EVENT_SYNONYMS)) {
    for (const syn of synonyms) {
      if (lower.includes(syn)) {
        return event;
      }
    }
  }

  return null;
}

/**
 * Resolves natural date phrases in Asia/Manila context into YYYY-MM-DD.
 *
 * @param {string} datePhrase e.g. "tomorrow", "next Saturday", "2026-09-12"
 * @param {Date} [referenceDate] Optional reference date (defaults to current Date)
 * @returns {string | null} YYYY-MM-DD in Asia/Manila or null
 */
export function resolveManilaDate(datePhrase, referenceDate = new Date()) {
  if (!datePhrase || typeof datePhrase !== "string") {
    return null;
  }

  const text = datePhrase.trim();
  const lower = text.toLowerCase();

  // 1. Direct ISO match: YYYY-MM-DD
  const isoMatch = text.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
  if (isoMatch) {
    const candidate = isoMatch[1];
    if (isValidStrictManilaDate(candidate)) {
      return candidate;
    }
  }

  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  // 2. "today"
  if (/\btoday\b/i.test(lower)) {
    return getManilaDateString(now);
  }

  // 3. "tomorrow"
  if (/\btomorrow\b/i.test(lower)) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return getManilaDateString(tomorrow);
  }

  // 4. Day of the week (e.g. "Saturday", "next Saturday", "on Sunday")
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let targetDay = 0; targetDay < 7; targetDay++) {
    const name = dayNames[targetDay];
    if (lower.includes(name)) {
      // Determine day of week in Asia/Manila
      const manilaDateStr = getManilaDateString(now); // YYYY-MM-DD
      const [year, month, day] = manilaDateStr.split("-").map(Number);
      const manilaToday = new Date(Date.UTC(year, month - 1, day));
      const currentDay = manilaToday.getUTCDay();

      let diffDays = targetDay - currentDay;
      if (lower.includes("next")) {
        // "next Saturday": if today is Saturday (diff=0), next Saturday is +7
        // if today is before Saturday, "next Saturday" conventionally means the upcoming or the following week.
        // In scheduling inquiries: "next Saturday" is the upcoming Saturday (+7 if diff <= 0, else diff + (diff <= 0 ? 7 : 0))
        if (diffDays <= 0) diffDays += 7;
      } else {
        if (diffDays <= 0) diffDays += 7;
      }

      const targetDate = new Date(manilaToday.getTime() + diffDays * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().slice(0, 10);
    }
  }

  return null;
}
