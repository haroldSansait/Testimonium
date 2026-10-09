/**
 * Canonical Citation Parser & Sanitizer for Caloy
 *
 * Enforces strict separation between visible human-facing text and internal
 * machine citation-control markers (e.g. [CITATIONS: 50], [CITATIONS: 19, 20, 54]).
 *
 * Invariants:
 * 1. Internal citation-control markers MUST NOT leak into visible assistant text.
 * 2. Citation markers are parsed across the entire response (supports multiple markers,
 *    trailing lines, and inline markers at sentence endings).
 * 3. Normal bracketed content (e.g. Markdown links, bracketed numbers/enums, currency)
 *    is NEVER accidentally stripped.
 */

const CITATION_MARKER_REGEX = /\[(?:CITATIONS?|CHUNKS?):\s*([0-9,\s]+)\]/gi;

/**
 * Sanitizes visible text by removing all internal citation markers while preserving
 * normal Markdown, links, parentheses, status enums, numbers, and currency.
 *
 * @param {string} text - Raw text containing potential citation markers.
 * @returns {string} Clean, natural human-readable text.
 */
export function sanitizeCitationMarkers(text) {
  if (!text || typeof text !== "string") return "";

  // 1. Remove markers immediately preceding sentence punctuation (e.g., "proof [CITATIONS: 50].")
  //    This ensures that removing the marker attaches the punctuation cleanly to the preceding word.
  let cleaned = text.replace(/\s*\[(?:CITATIONS?|CHUNKS?):[^\]\r\n]*\](?=[\s.,!?;:])/gi, "");

  // 2. Remove any remaining citation markers (e.g., standalone lines, sentence endings "proof. [CITATIONS: 50]")
  cleaned = cleaned.replace(/\s*\[(?:CITATIONS?|CHUNKS?):[^\]\r\n]*\]/gi, "");

  // 3. Normalize multiple horizontal spaces on the same line to a single space
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");

  // 4. Collapse 3+ consecutive newlines to at most 2 newlines (paragraph separation)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

/**
 * Authoritative citation extractor and sanitizer.
 * Extracts all chunk IDs from any citation markers in rawText. When an allow-list
 * is supplied, out-of-evidence IDs are reported separately rather than silently
 * discarded. This lets the service reject the entire citation contract.
 *
 * @param {string} rawText - Model-generated response text.
 * @param {Set<number>|Array<number>|null} [validEvidenceIds=null] - Allowed chunk IDs.
 * @returns {{ cleanedAnswer: string, citedChunkIds: number[], invalidCitedChunkIds: number[] }}
 */
export function extractCitationsAndSanitize(rawText, validEvidenceIds = null) {
  if (!rawText || typeof rawText !== "string") {
    return { cleanedAnswer: "", citedChunkIds: [], invalidCitedChunkIds: [] };
  }

  const validSet =
    validEvidenceIds instanceof Set
      ? validEvidenceIds
      : Array.isArray(validEvidenceIds)
      ? new Set(validEvidenceIds.map(Number))
      : null;

  const citedChunkIds = [];
  const invalidCitedChunkIds = [];
  const regex = new RegExp(CITATION_MARKER_REGEX.source, "gi");
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const rawIds = match[1]
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    for (const id of rawIds) {
      if (!citedChunkIds.includes(id)) {
        citedChunkIds.push(id);
      }
      if (validSet && !validSet.has(id) && !invalidCitedChunkIds.includes(id)) {
        invalidCitedChunkIds.push(id);
      }
    }
  }

  const cleanedAnswer = sanitizeCitationMarkers(rawText);

  return {
    cleanedAnswer,
    citedChunkIds,
    invalidCitedChunkIds,
  };
}
