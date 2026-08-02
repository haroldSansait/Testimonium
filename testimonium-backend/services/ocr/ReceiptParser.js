/**
 * ReceiptParser — Converts raw OCR text into structured receipt data.
 *
 * Responsibilities:
 *   - Extract merchant/platform (GCash, Maya, BPI, etc.)
 *   - Extract PHP/USD amount
 *   - Extract normalized decimal amount (e.g. "500.00")
 *   - Extract transaction reference number (supports GCash, Maya M- prefix, etc.)
 *   - Extract transaction date and normalized ISO date (YYYY-MM-DD)
 *   - Extract transaction time
 *   - Extract account name (sender/receiver) with heuristics to filter noise
 *   - Extract currency (PHP, USD, etc.)
 *   - Calculate parser confidence based on matched fields + time bonus
 *   - Sanitize raw OCR text before storage (remove HTML/scripts)
 */
export class ReceiptParser {
  /**
   * Sanitizes raw OCR text for safe PostgreSQL storage.
   * Strips HTML tags, script content, and embedded markup.
   *
   * @param {string} rawText
   * @returns {string}
   */
  static sanitize(rawText) {
    if (!rawText || typeof rawText !== "string") return "";

    return rawText
      // Remove <script>...</script> blocks (with content)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse excessive whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Parses sanitized OCR text into a structured receipt object.
   *
   * @param {string} rawText  - Sanitized OCR output text
   * @returns {{
   *   merchant: string|null,
   *   amount: string|null,
   *   normalizedAmount: string|null,
   *   paymentDate: string|null,
   *   normalizedDate: string|null,
   *   paymentTime: string|null,
   *   accountName: string|null,
   *   referenceNumber: string|null,
   *   currency: string,
   *   parserConfidence: number,
   *   provider: string|null
   * }}
   */
  static parse(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return ReceiptParser._emptyResult();
    }

    const text = rawText;
    const upperText = text.toUpperCase();

    const merchant = ReceiptParser._extractMerchant(upperText);
    const amount = ReceiptParser._extractAmount(text);
    const normalizedAmount = ReceiptParser._normalizeAmount(amount);
    const referenceNumber = ReceiptParser._extractReferenceNumber(text);
    const paymentDate = ReceiptParser._extractDate(text);
    const normalizedDate = ReceiptParser._normalizeDate(paymentDate);
    const paymentTime = ReceiptParser._extractTime(text);
    const accountName = ReceiptParser._extractAccountName(text);
    const currency = ReceiptParser._extractCurrency(text);

    // Confidence: each of the 4 primary fields is worth 25%
    let score = 0;
    if (merchant) score += 25;
    if (amount) score += 25;
    if (paymentDate) score += 25;
    if (referenceNumber) score += 25;
    
    // Confidence boost: award +5% bonus if paymentTime is also found
    if (paymentTime && score > 0) {
      score += 5;
    }
    
    const parserConfidence = Math.min(score / 100, 1.0);

    return {
      merchant,
      amount,
      normalizedAmount,
      paymentDate,
      normalizedDate,
      paymentTime,
      accountName,
      referenceNumber,
      currency,
      parserConfidence,
      provider: merchant,  // "provider" field stores the payment platform name
    };
  }

  // ─── Private extraction helpers ────────────────────────────────────────────

  static _emptyResult() {
    return {
      merchant: null,
      amount: null,
      normalizedAmount: null,
      paymentDate: null,
      normalizedDate: null,
      paymentTime: null,
      accountName: null,
      referenceNumber: null,
      currency: "PHP",
      parserConfidence: 0,
      provider: null,
    };
  }

  /**
   * Detects the payment platform/merchant from the OCR text.
   * Returns a normalized name (e.g., "GCash", "Maya", "BPI", "SeaBank").
   */
  static _extractMerchant(upperText) {
    const platformPatterns = [
      { pattern: /\bGCASH\b/, name: "GCash" },
      { pattern: /\bMAYA\b|\bPAYMAYA\b/, name: "Maya" },
      { pattern: /\bBPI\b|\bBANK\s+OF\s+THE\s+PHILIPPINE\s+ISLANDS\b/, name: "BPI" },
      { pattern: /\bBDO\b|\bBDO\s+UNIBANK\b/, name: "BDO" },
      { pattern: /\bUNIONBANK\b|\bUNION\s+BANK\b/, name: "UnionBank" },
      { pattern: /\bMETROBANK\b|\bMETROPOLITAN\s+BANK\b/, name: "Metrobank" },
      { pattern: /\bPNB\b|\bPHILIPPINE\s+NATIONAL\s+BANK\b/, name: "PNB" },
      { pattern: /\bSECURITY\s+BANK\b/, name: "Security Bank" },
      { pattern: /\bRCBC\b/, name: "RCBC" },
      { pattern: /\bEASTWEST\b|\bEAST\s+WEST\s+BANK\b/, name: "EastWest Bank" },
      { pattern: /\bLANDBANK\b|\bLBP\b/, name: "Landbank" },
      { pattern: /\bDBP\b|\bDEVELOPMENT\s+BANK\b/, name: "DBP" },
      { pattern: /\bINSTAPAY\b/, name: "InstaPay" },
      { pattern: /\bPESO\s*NET\b/, name: "PESONet" },
      { pattern: /\bSHOPEEPAY\b|\bSHOPEE\s+PAY\b/, name: "ShopeePay" },
      { pattern: /\bGRABPAY\b|\bGRAB\s+PAY\b/, name: "GrabPay" },
      { pattern: /\bCOINS\.PH\b|\bCOINS\b/, name: "Coins.ph" },
      { pattern: /\bGOTYME\b/, name: "GoTyme" },
      { pattern: /\bSEABANK\b/, name: "SeaBank" },
      { pattern: /\bCIMB\b/, name: "CIMB" },
    ];

    for (const { pattern, name } of platformPatterns) {
      if (pattern.test(upperText)) return name;
    }
    return null;
  }

  /**
   * Extracts a monetary amount string.
   * Matches: "PHP 500.00", "₱500.00", "PHP500", "P 1,000.00"
   */
  static _extractAmount(text) {
    const patterns = [
      // PHP prefix with optional space and comma-formatted amount
      /(?:PHP|₱|Php)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
      // Amount label
      /amount[:\s]+(?:PHP|₱|Php)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
      // "P " prefix (common in older GCash screenshots)
      /\bP\s+([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    return null;
  }

  /**
   * Normalizes extracted amount to standard double-decimal string "500.00"
   */
  static _normalizeAmount(amountStr) {
    if (!amountStr) return null;
    // Strip everything except digits and dot
    const clean = amountStr.replace(/[^0-9.]/g, "");
    const num = parseFloat(clean);
    if (isNaN(num)) return null;
    return num.toFixed(2);
  }

  /**
   * Extracts transaction reference numbers.
   * Supports GCash (12+ digits, potentially spaced) and Maya reference formats (M- prefix, 10 digits).
   */
  static _extractReferenceNumber(text) {
    const patterns = [
      // Maya reference number format: M- followed by 10 digits
      /\b(M-[0-9]{10})\b/i,
      /(?:ref(?:erence)?(?:\s*(?:no\.?|num\.?|number|#))?)[:\s\.]+(M-[0-9]{10})/i,
      // Labeled reference with optional spaces between digits (e.g. Ref No. 4022 039 962551)
      /(?:ref(?:erence)?(?:\s*(?:no\.?|num\.?|number|#))?)[: \t\.]+\s*([0-9][0-9 \t]{8,22}[0-9])/i,
      // Labeled reference (highest confidence)
      /(?:ref(?:erence)?(?:\s*(?:no|num|number|#))?)[:\s]+([0-9]{10,20})/i,
      // Transaction ID variations
      /(?:transaction\s+(?:id|no|number))[:\s]+([A-Z0-9]{8,20})/i,
      // Confirmation number
      /(?:confirmation\s+(?:no|number|code))[:\s]+([A-Z0-9]{8,20})/i,
      // Plain 12–20 digit sequence (fallback, only if labeled field not found)
      /\b([0-9]{12,20})\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const matchedStr = match[1] ? match[1].trim() : match[0].trim();
        const cleaned = matchedStr.replace(/\s/g, "");
        if (cleaned.length >= 10 && cleaned.length <= 20) {
          return cleaned;
        }
      }
    }
    return null;
  }

  /**
   * Extracts a transaction date.
   */
  static _extractDate(text) {
    const patterns = [
      // "Month Day, Year" (most common in GCash/Maya)
      /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4})\b/i,
      // "Day Month Year"
      /\b(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/i,
      // ISO: "2026-07-31"
      /\b(\d{4}-\d{2}-\d{2})\b/,
      // PH format: "07/31/2026" or "31/07/2026"
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1] ? match[1].trim() : match[0].trim();
    }
    return null;
  }

  /**
   * Normalizes various date formats to ISO YYYY-MM-DD
   */
  static _normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    // Try parsing ISO date format first
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return dateStr;

    const monthMap = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12"
    };

    // Try parsing "Month Day, Year" or "Day Month Year"
    const cleanStr = dateStr.replace(/,/g, "").trim();
    const tokens = cleanStr.split(/\s+/);
    if (tokens.length === 3) {
      let day = null;
      let month = null;
      let year = null;

      const t0Lower = tokens[0].toLowerCase();
      const t1Lower = tokens[1].toLowerCase();

      if (monthMap[t0Lower]) {
        month = monthMap[t0Lower];
        day = tokens[1].padStart(2, "0");
        year = tokens[2];
      } else if (monthMap[t1Lower]) {
        month = monthMap[t1Lower];
        day = tokens[0].padStart(2, "0");
        year = tokens[2];
      }

      if (day && month && year && year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }

    // Try parsing slashes (MM/DD/YYYY or DD/MM/YYYY)
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      const y = slashMatch[3];
      
      let month = null;
      let day = null;
      if (p1 > 12) {
        day = p1;
        month = p2;
      } else {
        month = p1;
        day = p2;
      }
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // Fallback using standard JS Date parser
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
    } catch (e) {
      // Ignore
    }

    return null;
  }

  /**
   * Extracts transaction time.
   */
  static _extractTime(text) {
    const match = text.match(
      /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\b/i
    );
    return match ? match[1].trim() : null;
  }

  /**
   * Extracts account name sender/receiver.
   * Filters out all-caps text with > 4 words to avoid noisy receipt headers.
   * Restricts spaces to same line to avoid matching multiline text.
   */
  static _extractAccountName(text) {
    const patterns = [
      /(?:from|sender|account\s+name|name)[: \t]+([A-Z][A-Za-z \t,.-•*·]{3,50})/i,
      /(?:to|recipient|beneficiary)[: \t]+([A-Z][A-Za-z \t,.-•*·]{3,50})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
        
        // Enforce capital letter start (since /i makes [A-Z] match lowercase too)
        if (!/^[A-Z]/.test(name)) {
          continue;
        }

        // Reject if all-caps and > 4 words
        const words = name.split(/\s+/);
        const isAllCaps = name === name.toUpperCase();
        if (isAllCaps && words.length > 4) {
          continue;
        }

        // Sanity check: must look like a name
        if (name.length >= 4 && name.length <= 60) {
          return name;
        }
      }
    }
    return null;
  }

  /**
   * Extracts currency (defaults to PHP).
   */
  static _extractCurrency(text) {
    if (/(?:PHP|₱|Php|PESO|Pesos)/i.test(text)) {
      return "PHP";
    }
    if (/\bUSD\b|\b\$\b/i.test(text)) {
      return "USD";
    }
    return "PHP";
  }
}
