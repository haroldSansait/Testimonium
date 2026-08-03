import { logger } from "../../config/logger.js";

/**
 * OcrLogger - Handles structured, production-friendly logging for OCR activities.
 * Ensures that no sensitive information (API keys, PII, raw text) is ever logged.
 */
export class OcrLogger {
  /**
   * Logs structured OCR metrics and status.
   *
   * @param {object} params
   * @param {number} params.receiptId
   * @param {number} params.requestId
   * @param {string} params.provider
   * @param {number|null} params.ocrDurationMs
   * @param {number|null} params.compressionDurationMs
   * @param {number|null} params.totalAsyncDurationMs
   * @param {number|null} params.compressionRatio
   * @param {string|null} params.ocrEngine
   * @param {number|null} params.confidence - Final combined confidence score
   * @param {number} params.retryCount
   * @param {string} params.ocrStatus - PENDING, PROCESSING, COMPLETED, FAILED
   * @param {string|null} params.failureReason
   */
  static log(params) {
    const {
      receiptId,
      requestId,
      provider,
      ocrDurationMs,
      compressionDurationMs,
      totalAsyncDurationMs,
      compressionRatio,
      ocrEngine,
      confidence,
      retryCount,
      ocrStatus,
      failureReason,
    } = params;

    const logPayload = {
      receiptId,
      requestId,
      provider,
      ocrDurationMs,
      compressionDurationMs,
      totalAsyncDurationMs,
      compressionRatio: compressionRatio ? parseFloat(compressionRatio.toFixed(2)) : null,
      ocrEngine,
      confidence: confidence != null ? parseFloat(confidence.toFixed(4)) : null,
      retryCount,
      ocrStatus,
      failureReason: failureReason || null,
    };

    if (ocrStatus === "FAILED" || failureReason) {
      logger.error(logPayload, "[OCR-FAIL] OCR processing failed");
    } else {
      logger.info(logPayload, "[OCR] OCR processing metric");
    }
  }
}

