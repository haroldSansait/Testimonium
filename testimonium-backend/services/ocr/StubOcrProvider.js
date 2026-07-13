import { OcrProviderInterface } from "./OcrProviderInterface.js";

export class StubOcrProvider extends OcrProviderInterface {
  /**
   * Stub implementation of receipt processing.
   * Returns a low confidence score to trigger manual review by default,
   * but supports mock parsing for developer testing if filename contains specific keywords.
   */
  async extractFromReceipt(imageBuffer, mimeType, fileName = "") {
    console.log(`[StubOcrProvider] Analyzing receipt ${fileName} (${mimeType})`);

    // Standard stub fallback (manual review required)
    const result = {
      referenceNumber: null,
      amount: null,
      paymentDate: null,
      provider: null,
      confidenceScore: 0.0,
      rawText: "STUB OCR: Manual review required. Uploaded buffer size: " + (imageBuffer ? imageBuffer.length : 0),
    };

    // If filename has test keywords, simulate highly-confident OCR extraction
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes("gcash") || lowerName.includes("receipt_verified")) {
      result.provider = "GCash";
      result.referenceNumber = "901234567890";
      result.amount = "100.00";
      result.paymentDate = new Date().toISOString();
      result.confidenceScore = 0.95; // High confidence to trigger auto-verify
      result.rawText = `GCash Express Send. Amount: PHP 100.00. Ref No: 901234567890. Success.`;
    }

    return result;
  }
}
