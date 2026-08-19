import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { R2Service } from "./R2Service.js";
import { ImageCompressionService } from "./ImageCompressionService.js";
import { OcrProviderFactory } from "./ocr/OcrProviderFactory.js";
import { ReceiptParser } from "./ocr/ReceiptParser.js";
import { OcrLogger } from "./ocr/OcrLogger.js";
import { OcrCacheService } from "./ocr/OcrCacheService.js";
import { env } from "../config/env.js";

const r2Service = new R2Service();

/**
 * OcrProcessingService — Orchestrates the asynchronous, background OCR processing flow.
 *
 * Guarantees:
 *   - Runs fully outside the main Express upload transaction.
 *   - Never blocks receipt uploads (HTTP response completes first).
 *   - Never allows unhandled promise rejections or uncaught event loop crashes.
 *   - Uses R2 as the source of truth for original image download (memory efficiency).
 *   - Race condition protection: checks OcrResult status before processing.
 *   - Handles retries with exponential backoff on transient OCR provider errors.
 *   - Uses OcrCacheService to reuse OCR results for identical image hashes.
 */
export class OcrProcessingService {
  /**
   * Performs async OCR processing for an uploaded receipt.
   *
   * @param {number} receiptId
   */
  static async processAsync(receiptId) {
    const startTime = Date.now();
    let requestId = null;
    let originalFileSize = null;
    let providerName = env.ocr.provider ?? "stub";
    let ocrEngine = env.ocr.spaceEngine ?? "2";

    try {
      // ── Step 1: Re-fetch receipt from database ─────────────────────────────
      const receipt = await prisma.receiptUpload.findUnique({
        where: { id: receiptId },
        include: {
          transaction: true,
          ocrResult: true,
        },
      });

      if (!receipt) {
        OcrLogger.log({
          receiptId,
          requestId: null,
          provider: providerName,
          ocrDurationMs: null,
          compressionDurationMs: null,
          totalAsyncDurationMs: Date.now() - startTime,
          compressionRatio: null,
          ocrEngine,
          confidence: null,
          retryCount: 0,
          ocrStatus: "FAILED",
          failureReason: "Receipt record not found in database",
        });
        return;
      }

      requestId = receipt.transaction.requestId;
      originalFileSize = receipt.fileSize;

      // ── Step 2: Race condition & Idempotency check ─────────────────────────
      // If OcrResult already exists and is not PENDING (i.e. PROCESSING, COMPLETED, FAILED),
      // we skip to prevent duplicate simultaneous executions.
      if (receipt.ocrResult) {
        if (receipt.ocrResult.status !== "PENDING") {
          return; // Skip: already handled or currently running
        }

        // Exists with PENDING status, transition to PROCESSING
        await prisma.ocrResult.update({
          where: { id: receipt.ocrResult.id },
          data: { status: "PROCESSING" },
        });
      } else {
        // Create initial OcrResult with PROCESSING status
        await prisma.ocrResult.create({
          data: {
            receiptUploadId: receiptId,
            status: "PROCESSING",
            confidenceScore: 0,
          },
        });
      }

      // ── Step 3: Download original image from R2 ────────────────────────────
      let downloadResponse;
      try {
        downloadResponse = await r2Service.download(receipt.r2ObjectKey);
      } catch (err) {
        throw new Error(`Failed to download receipt from R2: ${err.message}`);
      }

      let originalBuffer;
      try {
        const uint8Array = await downloadResponse.Body.transformToByteArray();
        originalBuffer = Buffer.from(uint8Array);
      } catch (err) {
        throw new Error(`Failed to read download stream from R2: ${err.message}`);
      }

      // ── Step 4: Pre-process/Compress receipt using Sharp ───────────────────
      const compressStart = Date.now();
      const compressed = await ImageCompressionService.compress(
        originalBuffer,
        receipt.mimeType || "image/jpeg"
      );
      const compressionDurationMs = Date.now() - compressStart;
      const compressionRatio = compressed.originalSize / compressed.compressedSize;

      // ── Step 5: Check OCR Cache (accidental duplicate uploads) ─────────────
      const imageHash = OcrCacheService.hash(compressed.compressedBuffer);
      let ocrOutput = OcrCacheService.get(imageHash);
      let retryCount = 0;
      let ocrDurationMs = 0;

      if (!ocrOutput) {
        // ── Step 6: OCR API call with intelligent retry orchestrator ──────────
        const ocrProvider = OcrProviderFactory.create();
        providerName = ocrProvider.providerName;

        const maxRetries = env.ocr.maxRetries ?? 2;
        const baseDelay = env.ocr.retryBaseDelayMs ?? 1000;

        let lastResult = null;

        while (retryCount <= maxRetries) {
          const ocrStart = Date.now();
          lastResult = await ocrProvider.extractFromReceipt(
            compressed.compressedBuffer,
            "image/jpeg",
            receipt.fileName
          );
          ocrDurationMs += Date.now() - ocrStart;

          if (lastResult.ocrSuccess) {
            ocrOutput = lastResult;
            break;
          }

          // Decide if transient retryable error
          const status = lastResult.httpStatusCode;
          const isTransient =
            status === 408 || // Timeout
            status === 429 || // Too Many Requests / Rate limit
            status === 500 || // Internal Server Error
            status === 502 || // Bad Gateway
            status === 503;   // Service Unavailable

          if (!isTransient || retryCount === maxRetries) {
            ocrOutput = lastResult;
            break;
          }

          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } else {
        // Cache Hit
        logger.info({ receiptId, imageHashPrefix: imageHash.slice(0, 10) }, "[OcrProcessingService] Cache hit for receipt OCR");
      }

      // ── Step 7: Parse and Sanitize extracted text ──────────────────────────
      const sanitizedText = ReceiptParser.sanitize(ocrOutput.rawText || "");
      const parsed = ReceiptParser.parse(sanitizedText);

      // ── Step 8: Calculate Combined Confidence Score ────────────────────────
      // parserConfidence: fraction of required fields parsed (0.0 to 1.0)
      // ocrConfidence: Mean confidence if provided by OCR engine (or null if unavailable)
      // Engine 2 does not provide character level confidence, so default to parser.
      const ocrConfidence = ocrOutput.ocrConfidence ?? null;
      let finalConfidence = parsed.parserConfidence;

      if (ocrConfidence !== null) {
        finalConfidence = parsed.parserConfidence * 0.6 + ocrConfidence * 0.4;
      }

      const totalAsyncDurationMs = Date.now() - startTime;

      // ── Step 8.5: Fraud Check — Reference Number Deduplication ─────────────
      let isDuplicate = receipt.ocrResult?.isDuplicate || false;
      let duplicateRequestId = receipt.ocrResult?.duplicateRequestId || null;
      let duplicateReason = receipt.ocrResult?.duplicateReason || null;

      if (!isDuplicate && parsed.referenceNumber && parsed.referenceNumber.trim().length >= 6) {
        const cleanRef = parsed.referenceNumber.trim();
        const priorVerifiedTx = await prisma.paymentTransaction.findFirst({
          where: {
            referenceNumber: cleanRef,
            status: "VERIFIED",
            requestId: { not: requestId },
          },
        });

        if (priorVerifiedTx) {
          isDuplicate = true;
          duplicateRequestId = priorVerifiedTx.requestId;
          duplicateReason = "DUPLICATE_REFERENCE_NUMBER";
          logger.warn(
            { requestId, duplicateRequestId, referenceNumber: cleanRef },
            "[OcrProcessingService] Fraud Alert: Duplicate payment reference number matches verified payment"
          );
        } else {
          const priorOcrMatch = await prisma.ocrResult.findFirst({
            where: {
              referenceNumber: cleanRef,
              receipt: {
                transaction: {
                  requestId: { not: requestId },
                  request: {
                    status: { notIn: ["REJECTED", "CANCELLED"] },
                  },
                },
              },
            },
            include: { receipt: { include: { transaction: true } } },
          });

          if (priorOcrMatch) {
            isDuplicate = true;
            duplicateRequestId = priorOcrMatch.receipt?.transaction?.requestId || null;
            duplicateReason = "DUPLICATE_REFERENCE_NUMBER";
            logger.warn(
              { requestId, duplicateRequestId, referenceNumber: cleanRef },
              "[OcrProcessingService] Fraud Alert: Duplicate payment reference number matches active in-flight request"
            );
          }
        }
      }

      // ── Step 9: Save completed OcrResult to database ────────────────────────
      await prisma.ocrResult.update({
        where: { receiptUploadId: receiptId },
        data: {
          status: "COMPLETED",
          referenceNumber: parsed.referenceNumber,
          amount: parsed.amount,
          paymentDate: parsed.paymentDate,
          provider: parsed.provider,
          confidenceScore: finalConfidence,
          rawText: sanitizedText,
          merchant: parsed.merchant,
          paymentTime: parsed.paymentTime,
          accountName: parsed.accountName,
          ocrProvider: providerName,
          ocrDurationMs,
          originalFileSize: receipt.fileSize,
          compressedFileSize: compressed.compressedSize,

          // Fraud & Deduplication fields
          isDuplicate,
          duplicateRequestId,
          duplicateReason,

          // Phase 2 new fields
          ocrConfidence,
          parserConfidence: parsed.parserConfidence,
          finalConfidence,
          ocrEngine,
          ocrLanguage: "eng",
          compressionWidth: env.ocr.compressionWidth,
          compressionQuality: env.ocr.compressionQuality,
          normalizedAmount: parsed.normalizedAmount,
          normalizedDate: parsed.normalizedDate,
        },
      });

      // Populate Cache with successful result details
      OcrCacheService.set(imageHash, ocrOutput);

      // Log success
      OcrLogger.log({
        receiptId,
        requestId,
        provider: providerName,
        ocrDurationMs,
        compressionDurationMs,
        totalAsyncDurationMs,
        compressionRatio,
        ocrEngine,
        confidence: finalConfidence,
        retryCount,
        ocrStatus: "COMPLETED",
        failureReason: null,
      });

    } catch (err) {
      // ── Step 10: Graceful fallback error handler (never throw) ──────────────
      const totalAsyncDurationMs = Date.now() - startTime;
      const failureReason = err.message || "Unknown background OCR error";

      logger.error(
        { err, receiptId },
        "[OcrProcessingService] Background processing failed for receiptId"
      );

      try {
        await prisma.ocrResult.update({
          where: { receiptUploadId: receiptId },
          data: {
            status: "FAILED",
            rawText: `OCR processing failed: ${failureReason}`,
          },
        });
      } catch (dbErr) {
        logger.error(
          { err: dbErr, receiptId },
          "[OcrProcessingService] Failed to set status to FAILED in DB for receiptId"
        );
      }

      // Log failure with [OCR-FAIL] prefix
      OcrLogger.log({
        receiptId,
        requestId,
        provider: providerName,
        ocrDurationMs: null,
        compressionDurationMs: null,
        totalAsyncDurationMs,
        compressionRatio: null,
        ocrEngine,
        confidence: null,
        retryCount: 0,
        ocrStatus: "FAILED",
        failureReason,
      });
    }
  }
}
