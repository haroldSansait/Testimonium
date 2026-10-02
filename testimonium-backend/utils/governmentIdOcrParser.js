import {
  SUPPORTED_GOVERNMENT_IDS,
  GOVERNMENT_ID_REJECTION_REASONS,
} from "../config/governmentIdVerification.js";

/**
 * Identifies the Government ID type from OCR text using deterministic multi-marker rules.
 *
 * @param {string} frontText - OCR text extracted from front of card
 * @param {string} [backText=""] - OCR text extracted from back of card
 * @returns {object|null} The matched configuration object from SUPPORTED_GOVERNMENT_IDS, or null
 */
export function identifyGovernmentIdType(frontText, backText = "") {
  if (!frontText || typeof frontText !== "string") return null;

  const combinedFront = frontText.replace(/\s+/g, " ");
  const combinedBack = (backText || "").replace(/\s+/g, " ");

  const matchingTypes = [];

  for (const [key, idConfig] of Object.entries(SUPPORTED_GOVERNMENT_IDS)) {
    // Every front marker in frontMarkers must match
    const frontMatches = idConfig.frontMarkers.every((marker) =>
      marker.pattern.test(combinedFront)
    );

    if (frontMatches) {
      // Optional check if back markers strengthen identification
      let backScore = 0;
      if (idConfig.backMarkers && idConfig.backMarkers.length > 0 && combinedBack) {
        for (const backMarker of idConfig.backMarkers) {
          if (backMarker.test(combinedBack)) {
            backScore += 1;
          }
        }
      }

      matchingTypes.push({
        idConfig,
        backScore,
      });
    }
  }

  if (matchingTypes.length === 0) {
    return null;
  }

  if (matchingTypes.length === 1) {
    return matchingTypes[0].idConfig;
  }

  // If multiple match, sort by backScore descending
  matchingTypes.sort((a, b) => b.backScore - a.backScore);
  if (matchingTypes[0].backScore > matchingTypes[1].backScore) {
    return matchingTypes[0].idConfig;
  }

  // Ambiguous match without decisive winner
  return null;
}

/**
 * Parses a date string into a Date object.
 * Supports:
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - MM-DD-YYYY, MM/DD/YYYY
 * - DD Month YYYY, Month DD, YYYY
 *
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  const clean = dateStr.trim();

  const createUtcDate = (year, month, day) => {
    if (year <= 1950 || year >= 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
      ? parsed
      : null;
  };

  // Check numeric patterns: YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    return createUtcDate(year, month, day);
  }

  // Check numeric patterns: DD-MM-YYYY or MM-DD-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    // If part1 > 12, part1 is day, part2 is month
    let day = part1;
    let month = part2;
    if (part1 <= 12 && part2 > 12) {
      month = part1;
      day = part2;
    }
    return createUtcDate(year, month, day);
  }

  // Only delegate clearly month-named formats to Date parsing.
  if (/^(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/.test(clean)) {
    const standardDate = new Date(`${clean} UTC`);
    if (!isNaN(standardDate.getTime()) && standardDate.getUTCFullYear() > 1950 && standardDate.getUTCFullYear() < 2100) {
      return standardDate;
    }
  }

  return null;
}

/**
 * Extracts and validates the expiration date from card OCR text.
 *
 * @param {string} fullOcrText
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ found: boolean, expiresAt: Date|null, isExpired: boolean, rawMatch?: string }}
 */
export function extractExpiryDate(fullOcrText, referenceDate = new Date()) {
  if (!fullOcrText || typeof fullOcrText !== "string") {
    return { found: false, expiresAt: null, isExpired: false };
  }

  const normalized = fullOcrText.replace(/\r\n/g, "\n");

  // Specific label-preceded patterns
  const labeledPatterns = [
    /(?:EXPIRATION(?:\s+DATE)?|EXPIRES|EXPIRY(?:\s+DATE)?|EXP|VALID(?:\s+UNTIL|\s+THRU|\s+UP\s+TO)|DATE\s+OF\s+EXPIRATION)\s*[:.-]?\s*([0-9]{4}[-/._][0-9]{1,2}[-/._][0-9]{1,2})/i,
    /(?:EXPIRATION(?:\s+DATE)?|EXPIRES|EXPIRY(?:\s+DATE)?|EXP|VALID(?:\s+UNTIL|\s+THRU|\s+UP\s+TO)|DATE\s+OF\s+EXPIRATION)\s*[:.-]?\s*([0-9]{1,2}[-/._][0-9]{1,2}[-/._][0-9]{4})/i,
    /(?:EXPIRATION(?:\s+DATE)?|EXPIRES|EXPIRY(?:\s+DATE)?|EXP|VALID(?:\s+UNTIL|\s+THRU|\s+UP\s+TO)|DATE\s+OF\s+EXPIRATION)\s*[:.-]?\s*([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i,
    /(?:EXPIRATION(?:\s+DATE)?|EXPIRES|EXPIRY(?:\s+DATE)?|EXP|VALID(?:\s+UNTIL|\s+THRU|\s+UP\s+TO)|DATE\s+OF\s+EXPIRATION)\s*[:.-]?\s*([A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const parsed = parseDateString(match[1].trim());
      if (parsed) {
        return {
          found: true,
          expiresAt: parsed,
          isExpired: parsed <= referenceDate,
          rawMatch: match[1].trim(),
        };
      }
    }
  }

  // Fallback: look for general year 2020-2040 dates following an EXP keyword on the same or next line
  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(?:EXP|EXPIRY|EXPIRES|EXPIRATION|VALID\s+(?:UNTIL|THRU|UP\s+TO))\b/i.test(line)) {
      // Check this line and next line for a date pattern
      const candidateText = `${line} ${lines[i + 1] || ""}`;
      const generalDateMatch = candidateText.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/) ||
                               candidateText.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/);
      if (generalDateMatch && generalDateMatch[1]) {
        const parsed = parseDateString(generalDateMatch[1]);
        if (parsed) {
          return {
            found: true,
            expiresAt: parsed,
            isExpired: parsed <= referenceDate,
            rawMatch: generalDateMatch[1],
          };
        }
      }
    }
  }

  return { found: false, expiresAt: null, isExpired: false };
}
