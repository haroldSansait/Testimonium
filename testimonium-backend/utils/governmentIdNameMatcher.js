/**
 * Government ID Name Matching Utility
 *
 * Enforces deterministic, conservative fail-closed name matching.
 * Matches parishioner profile name against OCR extracted text.
 */

/**
 * Normalizes text for name matching:
 * - Converts to uppercase
 * - Strips diacritics / accents
 * - Replaces punctuation with spaces
 * - Collapses whitespace
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeNameText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ") // replace non-alphanumeric with space
    .replace(/\s+/g, " ")
    .trim();
}

export function isMaterialGovernmentIdNameChange(previousName, nextName) {
  return normalizeNameText(previousName) !== normalizeNameText(nextName);
}

/**
 * Common Philippine and Western suffixes to handle cleanly.
 */
const COMMON_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

/**
 * Extracts meaningful name tokens from a full name string.
 * Ignores single-letter initials and standard suffixes.
 *
 * @param {string} fullName
 * @returns {{ tokens: string[], surname: string, suffix: string|null }}
 */
export function extractProfileNameTokens(fullName) {
  const normalized = normalizeNameText(fullName);
  if (!normalized) return { tokens: [], surname: "", suffix: null };

  const parts = normalized.split(" ").filter(Boolean);
  let suffix = null;

  // Check if last token is a suffix
  if (parts.length > 1 && COMMON_SUFFIXES.has(parts[parts.length - 1])) {
    suffix = parts.pop();
  }

  // Meaningful tokens: words with length >= 2
  const meaningfulTokens = parts.filter((token) => token.length >= 2);
  const surname = parts.length > 0 ? parts[parts.length - 1] : "";

  return {
    tokens: meaningfulTokens,
    surname,
    suffix,
  };
}

/**
 * Determines whether the OCR text contains the profile name.
 *
 * Deterministic requirements:
 * 1. Surname (last name) MUST appear in the ID text as a distinct word boundary.
 * 2. First name and every surname token must match exactly.
 * 3. Interior name tokens must match either exactly or as a single-letter initial.
 *
 * @param {string} profileFullName
 * @param {string} ocrText
 * @returns {{ matches: boolean, reason?: string, matchedTokens?: string[], missingTokens?: string[] }}
 */
export function matchProfileNameToIdText(profileFullName, ocrText) {
  if (!profileFullName || typeof profileFullName !== "string") {
    return { matches: false, reason: "Profile full name is missing." };
  }

  if (!ocrText || typeof ocrText !== "string") {
    return { matches: false, reason: "OCR text is empty." };
  }

  const normalizedOcr = ` ${normalizeNameText(ocrText)} `;
  const { tokens, surname } = extractProfileNameTokens(profileFullName);

  if (tokens.length === 0 || !surname) {
    return { matches: false, reason: "Could not extract valid name tokens from profile name." };
  }

  // 1. Mandatory surname match
  const surnameRegex = new RegExp(`\\b${surname}\\b`, "i");
  if (!surnameRegex.test(normalizedOcr)) {
    return {
      matches: false,
      reason: `Surname "${surname}" was not found on the ID card.`,
    };
  }

  // 2. Conservative token match check. A missing interior token may be represented
  // by its initial, but a different full middle name cannot satisfy the match.
  const matchedTokens = [];
  const missingTokens = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const tokenRegex = new RegExp(`\\b${token}\\b`, "i");
    const isInteriorToken = index > 0 && index < tokens.length - 1;
    const initialRegex = new RegExp(`\\b${token[0]}\\b`, "i");
    if (tokenRegex.test(normalizedOcr) || (isInteriorToken && initialRegex.test(normalizedOcr))) {
      matchedTokens.push(token);
    } else {
      missingTokens.push(token);
    }
  }

  if (matchedTokens.length < tokens.length) {
    return {
      matches: false,
      reason: `Missing or conflicting name tokens: ${missingTokens.join(", ")}`,
      matchedTokens,
      missingTokens,
    };
  }

  return {
    matches: true,
    matchedTokens,
    missingTokens,
  };
}
