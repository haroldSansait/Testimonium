/**
 * Formats an OCR-extracted or transaction monetary amount for peso display.
 * Strips erroneous labels ("Amount", "Total Amount") and duplicated currency
 * prefixes/symbols ("₱", "PHP", "Php", "P") from raw strings so existing and
 * newly processed records render cleanly as "₱<amount>".
 */
export function formatOcrAmount(rawAmount: string | number | null | undefined): string | null {
  if (rawAmount === null || rawAmount === undefined) return null;

  if (typeof rawAmount === 'number') {
    return Number.isFinite(rawAmount) ? `₱${rawAmount}` : null;
  }

  let cleaned = String(rawAmount).trim();
  if (!cleaned) return null;

  let previous: string;
  do {
    previous = cleaned;
    cleaned = cleaned
      .replace(/^(?:₱+|php|p(?=\s*[\d,.])|total\s+amount|amount\s+paid|amount)\s*:?\s*/i, '')
      .trim();
  } while (cleaned !== previous && cleaned.length > 0);

  cleaned = cleaned.replace(/\s*(?:₱+|php)$/i, '').trim();
  if (!cleaned) return null;

  return `₱${cleaned}`;
}

