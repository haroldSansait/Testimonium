/**
 * Abstract class defining the OCR provider interface.
 * All OCR providers (Stub, OCRSpace, Google Vision, Azure, etc.) must implement this interface.
 *
 * Contract:
 *   - extractFromReceipt() receives a COMPRESSED buffer ready for API submission.
 *   - The raw OCR text must be returned in rawText for ReceiptParser processing.
 *   - Providers must NEVER auto-approve payments — only return raw extraction data.
 */
export class OcrProviderInterface {
  /**
   * Returns the provider identifier string used for logging and audit records.
   * @returns {string}
   */
  get providerName() {
    throw new Error("Property 'providerName' must be implemented.");
  }

  /**
   * Extracts raw OCR text from a receipt image buffer.
   * Receives a compressed, OCR-optimized buffer (not the original upload).
   *
   * @param {Buffer} imageBuffer - Compressed image buffer for OCR submission.
   * @param {string} mimeType    - MIME type of the compressed image ('image/jpeg').
   * @returns {Promise<{
   *   rawText: string,
   *   ocrSuccess: boolean,
   *   failureReason: string|null,
   *   httpStatusCode: number|null
   * }>}
   */
  async extractFromReceipt(_imageBuffer, _mimeType) {
    throw new Error("Method 'extractFromReceipt()' must be implemented.");
  }
}
