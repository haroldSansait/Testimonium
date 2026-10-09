/**
 * Conservative language-alignment guard.
 *
 * Prompt policy remains the primary language mechanism. This local check only
 * rejects the confirmed high-confidence failure mode: a clearly English current
 * message receiving a clearly Philippine-language response. Ambiguous and mixed
 * messages are deliberately accepted so legitimate code-switching is preserved.
 */

const ENGLISH_SIGNAL = /\b(the|is|are|can|could|would|should|what|who|whose|why|how|where|when|do|does|did|not|need|prepare|file|receive|requesting|someone|about|from|with|for|my|mine|your|hers|own|adult|sister|parent|child|documents?|upload)\b/gi;
const PHILIPPINE_SIGNAL = /\b(ang|mga|kailangan|kinahanglan|kinahanglanon|mangyaring|maaari|hindi|indi|dili|inyong|imong|ninyo|nimo|iyong|para\s+sa|ano|unsa|tagpila|pila|sang|gid|bala|ukon|kag|nga|ug|po|opo)\b/gi;

function countDistinctMatches(text, pattern) {
  const matches = String(text || "").toLowerCase().match(pattern) || [];
  return new Set(matches.map((value) => value.trim())).size;
}

export function isClearlyEnglishCurrentMessage(text) {
  const englishSignals = countDistinctMatches(text, ENGLISH_SIGNAL);
  const philippineSignals = countDistinctMatches(text, PHILIPPINE_SIGNAL);
  return englishSignals >= 3 && philippineSignals === 0;
}

export function isClearlyPhilippineLanguageText(text) {
  return countDistinctMatches(text, PHILIPPINE_SIGNAL) >= 3;
}

export function isCurrentMessageLanguageConsistent(currentMessage, responseText) {
  if (!currentMessage || !responseText) return true;
  if (!isClearlyEnglishCurrentMessage(currentMessage)) return true;
  return !isClearlyPhilippineLanguageText(responseText);
}
