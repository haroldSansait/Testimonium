/**
 * Abstract class defining the OCR provider interface.
 * All OCR providers (Tesseract, Gemini, Google Vision, etc.) must implement this interface.
 */
export class OcrProviderInterface {
  /**
   * Extracts data from a receipt image buffer.
   * @param {Buffer} imageBuffer - File buffer of the receipt image.
   * @param {string} mimeType - MIME type of the file.
   * @returns {Promise<{
   *   referenceNumber: string|null,
   *   amount: string|null,
   *   paymentDate: string|null,
   *   provider: string|null,
   *   confidenceScore: number,
   *   rawText: string
   * }>}
   */
  async extractFromReceipt(_imageBuffer, _mimeType) {
    throw new Error("Method 'extractFromReceipt()' must be implemented.");
  }
}
