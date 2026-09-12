import { CANONICAL_DOCUMENT_TYPES, normalizeDocumentType } from "../../config/documents.js";
import { getManilaDateString, isValidStrictManilaDate } from "../ConflictHelper.js";
import { normalizeTimeSlotString } from "../BookingValidator.js";

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
    if (synonyms.some((syn) => lower === syn)) {
      return event;
    }
  }

  const orderedAliases = Object.entries(SCHEDULE_EVENT_SYNONYMS)
    .flatMap(([event, synonyms]) => synonyms.map((synonym) => ({ event, synonym })))
    .sort((a, b) => b.synonym.length - a.synonym.length);
  for (const { event, synonym } of orderedAliases) {
    if (lower.includes(synonym)) {
      return event;
    }
  }

  return null;
}

function isMinorRelativeDateMisspelling(token, canonical) {
  if (token === canonical) return true;
  const maxEdits = canonical.length >= 7 ? 2 : 1;
  if (Math.abs(token.length - canonical.length) > maxEdits) return false;

  let left = 0;
  let right = 0;
  let edits = 0;
  while (left < token.length && right < canonical.length) {
    if (token[left] === canonical[right]) {
      left += 1;
      right += 1;
      continue;
    }

    if (
      token.length === canonical.length &&
      left + 1 < token.length &&
      token[left] === canonical[right + 1] &&
      token[left + 1] === canonical[right]
    ) {
      edits += 1;
      left += 2;
      right += 2;
    } else if (token.length > canonical.length) {
      edits += 1;
      left += 1;
    } else if (token.length < canonical.length) {
      edits += 1;
      right += 1;
    } else {
      edits += 1;
      left += 1;
      right += 1;
    }

    if (edits > maxEdits) return false;
  }

  if (left < token.length || right < canonical.length) edits += 1;
  return edits <= maxEdits;
}

const MONTH_MAP = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/**
 * Resolves natural date phrases in Asia/Manila context into YYYY-MM-DD.
 * Supports absolute natural dates (e.g. "September 17", "Sept 17th", "17 September"),
 * ISO format ("2026-09-17"), relative English terms ("tomorrow", "today", day-of-week),
 * and safe local-language terms ("bukas", "ugma").
 *
 * @param {string} datePhrase e.g. "tomorrow", "September 17", "next Saturday", "2026-09-12"
 * @param {Date} [referenceDate] Optional reference date (defaults to current Date)
 * @returns {string | null} YYYY-MM-DD in Asia/Manila or null
 */
export function resolveManilaDate(datePhrase, referenceDate = new Date()) {
  if (!datePhrase || typeof datePhrase !== "string") {
    return null;
  }

  const text = datePhrase.trim();
  const lower = text.toLowerCase();
  const dateWords = lower.match(/[a-z]+/g) || [];

  // 1. Direct ISO match: YYYY-MM-DD
  const isoMatch = text.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
  if (isoMatch) {
    const candidate = isoMatch[1];
    if (isValidStrictManilaDate(candidate)) {
      return candidate;
    }
  }

  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const manilaDateStr = getManilaDateString(now); // YYYY-MM-DD
  const [currentYear, currentMonth, currentDay] = manilaDateStr.split("-").map(Number);
  const manilaToday = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));

  // 2. "today", "ngayon", "karun"
  if (
    dateWords.some((word) => isMinorRelativeDateMisspelling(word, "today")) ||
    /\b(ngayon|karun)\b/i.test(lower)
  ) {
    return manilaDateStr;
  }

  // 3. "tomorrow", "bukas", "ugma"
  if (
    dateWords.some((word) => isMinorRelativeDateMisspelling(word, "tomorrow")) ||
    /\b(bukas|ugma)\b/i.test(lower)
  ) {
    const tomorrow = new Date(manilaToday.getTime() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  }

  // 4. Absolute natural dates: Month + Day (e.g. "September 17", "Sept 17th", "on September 17", "September 17, 2026")
  const monthDayMatch = lower.match(
    /(?:on\s+)?\b(january|february|march|april|may|june|july|august|september|sept|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i
  );
  if (monthDayMatch) {
    const monthName = monthDayMatch[1].toLowerCase();
    const month = MONTH_MAP[monthName];
    const day = parseInt(monthDayMatch[2], 10);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : currentYear;

    if (month && day >= 1 && day <= 31) {
      const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (isValidStrictManilaDate(candidate)) {
        return candidate;
      }
    }
  }

  // 5. Absolute natural dates: Day + Month (e.g. "17 September", "17th of September", "17 Sept 2026")
  const dayMonthMatch = lower.match(
    /(?:on\s+)?\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(january|february|march|april|may|june|july|august|september|sept|sep|october|oct|november|nov|december|dec)\.?(?:\s*,?\s*(\d{4}))?\b/i
  );
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthName = dayMonthMatch[2].toLowerCase();
    const month = MONTH_MAP[monthName];
    const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : currentYear;

    if (month && day >= 1 && day <= 31) {
      const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (isValidStrictManilaDate(candidate)) {
        return candidate;
      }
    }
  }

  // 6. Day of the week (e.g. "Saturday", "next Saturday", "on Sunday", "sa lunes")
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const localDayNames = {
    linggo: 0,
    lunes: 1,
    martes: 2,
    miyerkules: 3,
    miyerkoles: 3,
    huwebes: 4,
    biyernes: 5,
    sabado: 6,
  };

  for (let targetDay = 0; targetDay < 7; targetDay++) {
    const name = dayNames[targetDay];
    if (lower.includes(name)) {
      const currentDayOfWeek = manilaToday.getUTCDay();
      let diffDays = targetDay - currentDayOfWeek;
      if (diffDays <= 0) diffDays += 7;

      const targetDate = new Date(manilaToday.getTime() + diffDays * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().slice(0, 10);
    }
  }

  for (const [localDay, dayNum] of Object.entries(localDayNames)) {
    if (new RegExp(`\\b${localDay}\\b`, "i").test(lower)) {
      const currentDayOfWeek = manilaToday.getUTCDay();
      let diffDays = dayNum - currentDayOfWeek;
      if (diffDays <= 0) diffDays += 7;

      const targetDate = new Date(manilaToday.getTime() + diffDays * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Resolves natural language time slot phrase into normalized "HH:MM AM/PM".
 * e.g. "2 PM" -> "02:00 PM", "2:00 PM" -> "02:00 PM", "10 in the morning" -> "10:00 AM", "at 2" -> "02:00 PM"
 */
export function resolveManilaTimeSlot(timePhrase) {
  if (!timePhrase || typeof timePhrase !== "string") return null;
  const text = timePhrase.trim();

  // 1. Direct standard format (e.g. "02:00 PM", "2:00 PM", "10:30 AM")
  const standard = normalizeTimeSlotString(text);
  if (standard) return standard;

  const lower = text.toLowerCase();

  // 2. Hour with AM/PM (e.g. "2 PM", "2pm", "10am", "10 AM")
  const hourAmPm = lower.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (hourAmPm) {
    const hour = Number(hourAmPm[1]);
    const period = hourAmPm[2].toUpperCase();
    if (hour >= 1 && hour <= 12) {
      return `${String(hour).padStart(2, "0")}:00 ${period}`;
    }
  }

  // 3. 24-hour time (e.g. "14:00", "09:30")
  const milTime = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (milTime) {
    let hour = Number(milTime[1]);
    const minute = milTime[2];
    if (hour >= 0 && hour <= 23) {
      const period = hour >= 12 ? "PM" : "AM";
      if (hour > 12) hour -= 12;
      if (hour === 0) hour = 12;
      return `${String(hour).padStart(2, "0")}:${minute} ${period}`;
    }
  }

  // 4. Natural language: "2 in the afternoon", "10 in the morning", "at 2"
  const naturalHour = lower.match(/\b(?:at|around|for)?\s*(\d{1,2})\s*(?:o'clock)?\s*(in\s+the\s+(morning|afternoon|evening))?\b/i);
  if (naturalHour && naturalHour[1]) {
    const hour = Number(naturalHour[1]);
    const tod = naturalHour[3];
    if (hour >= 1 && hour <= 12) {
      let period = "AM";
      if (tod === "afternoon" || tod === "evening") {
        period = "PM";
      } else if (!tod) {
        // Standard church scheduling: 1, 2, 3, 4, 5 default to afternoon PM
        if (hour >= 1 && hour <= 5) period = "PM";
        else period = "AM";
      }
      return `${String(hour).padStart(2, "0")}:00 ${period}`;
    }
  }

  // 5. Broad periods of the day: "morning" -> "09:00 AM", "afternoon" -> "02:00 PM"
  if (/\bafternoon\b/i.test(lower)) {
    return "02:00 PM";
  }
  if (/\bmorning\b/i.test(lower)) {
    return "09:00 AM";
  }

  return null;
}

/**
 * Extracts a time slot from natural language text if present.
 * e.g. "Can I book at 2 PM?" -> "02:00 PM"
 * e.g. "Is Fr. Julius free at 2?" -> "02:00 PM"
 */
export function extractTimeSlotFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Check for explicit time with AM/PM (e.g. "at 2:00 PM", "2 PM", "10:30am")
  const amPmMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (amPmMatch) {
    return resolveManilaTimeSlot(amPmMatch[1]);
  }

  // Check for "at 2", "at 10", "around 2"
  const atMatch = text.match(/\b(?:at|around|for)\s+(\d{1,2}(?::\d{2})?)\s*(?:o'clock)?(?:\s*in\s+the\s+(morning|afternoon|evening))?\b/i);
  if (atMatch) {
    const combined = atMatch[2] ? `${atMatch[1]} in the ${atMatch[2]}` : atMatch[1];
    return resolveManilaTimeSlot(combined);
  }

  return null;
}

/**
 * Extracts priest name or clergy title reference from natural language text.
 * e.g. "Is Fr. Julius free?" -> "Julius" or "Fr. Julius"
 * e.g. "Can Rev. Fr. Julius L. Montaño celebrate our wedding?" -> "Julius L. Montaño"
 */
export function extractPriestReference(text) {
  if (!text || typeof text !== "string") return null;

  const match = text.match(/\b(?:Rev\.?\s*Fr\.?|Fr\.?|Father)\s+([A-Za-z]+(?:\s+[A-Za-z]\.?)?(?:\s+[A-Za-z]+)?)\b/i);
  if (match) {
    return match[1].trim();
  }

  if (/\b(parish\s+priest|pastor)\b/i.test(text)) {
    return "parish priest";
  }

  return null;
}
