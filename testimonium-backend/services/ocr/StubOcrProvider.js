import { OcrProviderInterface } from "./OcrProviderInterface.js";
import { logger } from "../../config/logger.js";

/**
 * StubOcrProvider — development/testing implementation.
 *
 * Returns a zero-confidence result by default to force manual secretary review.
 * If the filename contains "gcash" or "receipt_verified", simulates a successful
 * extraction to support developer workflow testing without real API credentials.
 *
 * This provider is selected when OCR_PROVIDER is unset or set to "stub".
 */
export class StubOcrProvider extends OcrProviderInterface {
  get providerName() {
    return "stub";
  }

  /**
   * @param {Buffer} imageBuffer
   * @param {string} mimeType
   * @param {string} [fileName]
   * @returns {Promise<{ rawText: string, ocrSuccess: boolean, failureReason: string|null }>}
   */
  async extractFromReceipt(imageBuffer, mimeType, fileName = "") {
    logger.debug({ mimeType, bufferSize: imageBuffer?.length ?? 0 }, "[StubOcrProvider] Analyzing receipt");

    const lowerName = (fileName || "").toLowerCase();

    // Simulate a successful GCash extraction for named test files
    if (lowerName.includes("gcash") || lowerName.includes("receipt_verified")) {
      const rawText = [
        "GCash Express Send",
        "Amount: PHP 100.00",
        "Ref No: 901234567890",
        `Date: ${new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`,
        "Time: 10:30 AM",
        "Status: Successful",
      ].join("\n");

      return { rawText, ocrSuccess: true, failureReason: null, httpStatusCode: 200 };
    }

    // Default: return empty text — triggers manual review
    return {
      rawText: `STUB OCR: Manual review required. Buffer size: ${imageBuffer?.length ?? 0}`,
      ocrSuccess: false,
      failureReason: "Stub provider — no real OCR performed",
      httpStatusCode: 200,
    };
  }

  /**
   * Generic text extraction alias for extractFromReceipt.
   */
  async extractText(imageBuffer, mimeType, fileName = "") {
    return this.extractFromReceipt(imageBuffer, mimeType, fileName);
  }
}
