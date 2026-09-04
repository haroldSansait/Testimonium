import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";
import { R2Service } from "./R2Service.js";
import { ImageCompressionService } from "./ImageCompressionService.js";
import { OcrProviderFactory } from "./ocr/OcrProviderFactory.js";
import { ReceiptParser } from "./ocr/ReceiptParser.js";
import { OcrLogger } from "./ocr/OcrLogger.js";
import { OcrCacheService } from "./ocr/OcrCacheService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { AuditLogService } from "./AuditLogService.js";
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
 *   - TOCTOU protected: atomically verifies authoritative attempt under row lock inside transaction.
 *   - Distinguishes genuine low-confidence image from OCR failure / provider unavailability.
 *   - Clears obsolete paymentCorrectionNote when newer proof passes quality gate.
 */
export class OcrProcessingService {
  /**
   * Evaluates whether a receipt attempt is still authoritative.
   */
  static isAttemptAuthoritative(receipt) {
    return Boolean(
      receipt &&
      !receipt.isSuperseded &&
      receipt.transaction?.request?.paymentProofObjectKey === receipt.r2ObjectKey
    );
  }

  /**
   * Evaluates payment quality gate threshold and returns target transition state.
   */
  static evaluateQualityGate(finalConfidence, minConfidence = 0.75) {
    const passed = finalConfidence >= minConfidence;
    return {
      passed,
      status: passed ? "PAYMENT_UNDER_REVIEW" : "PAYMENT_NEEDS_CORRECTION",
      paymentStatus: passed ? "PROOF_SUBMITTED" : "UNPAID",
      action: passed ? "RECEIPT_QUALITY_PASSED" : "PAYMENT_PROOF_LOW_CONFIDENCE",
      paymentCorrectionNote: passed
        ? null
        : "The payment proof image is unclear or blurry. Please upload a clearer image.",
    };
  }

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

    // Scope variables outside try block to avoid ReferenceError in catch/logging paths
    let ocrDurationMs = 0;
    let compressionDurationMs = 0;
    let compressionRatio = null;
    let retryCount = 0;

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
      compressionDurationMs = Date.now() - compressStart;
      compressionRatio = compressed.originalSize / compressed.compressedSize;

      // ── Step 5: Check OCR Cache (accidental duplicate uploads) ─────────────
      const imageHash = OcrCacheService.hash(compressed.compressedBuffer);
      let ocrOutput = OcrCacheService.get(imageHash);

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

      // ── Step 6.5: Verify OCR Success / Distinguish Failure Types ───────────
      // If ocrOutput is missing or ocrSuccess is false, this is NOT a genuine low-confidence
      // image result. It is either an analysis failure or provider unavailability.
      // Do NOT blame the user or claim the image is blurry.
      if (!ocrOutput || ocrOutput.ocrSuccess === false) {
        const statusCode = ocrOutput?.httpStatusCode;
        const failureReason = ocrOutput?.failureReason || "OCR processing failed";
        const isUnavailable =
          [408, 429, 500, 502, 503, 504].includes(statusCode) ||
          failureReason.toLowerCase().includes("timed out") ||
          failureReason.toLowerCase().includes("network error") ||
          failureReason.toLowerCase().includes("stub") ||
          failureReason.toLowerCase().includes("unavailable");

        const failureAction = isUnavailable
          ? "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE"
          : "PAYMENT_PROOF_ANALYSIS_FAILED";
        const failureRemarks = isUnavailable
          ? "Automated proof quality check was unavailable; forwarded to parish staff for manual verification."
          : "Automated proof quality check could not process receipt; forwarded to parish staff for manual verification.";

        await prisma.ocrResult.update({
          where: { receiptUploadId: receiptId },
          data: {
            status: "FAILED",
            rawText: `OCR processing error: ${failureReason}`,
            confidenceScore: null,
            ocrProvider: providerName,
            ocrDurationMs,
            originalFileSize: receipt.fileSize,
            compressedFileSize: compressed.compressedSize,
            ocrEngine,
            compressionWidth: env.ocr.compressionWidth,
            compressionQuality: env.ocr.compressionQuality,
          },
        });

        OcrLogger.log({
          receiptId,
          requestId,
          provider: providerName,
          ocrDurationMs,
          compressionDurationMs,
          totalAsyncDurationMs: Date.now() - startTime,
          compressionRatio,
          ocrEngine,
          confidence: null,
          retryCount,
          ocrStatus: "FAILED",
          failureReason,
        });

        // Atomic locked authority check before mutating request state
        await prisma.$transaction(async (tx) => {
          if (typeof tx.$queryRaw === "function") {
            await tx.$queryRaw`
              SELECT "request_id"
              FROM "document_requests"
              WHERE "request_id" = ${Number(requestId)}
              FOR UPDATE
            `;
          }

          const lockedReceipt = await tx.receiptUpload.findUnique({
            where: { id: receiptId },
            include: {
              transaction: {
                include: {
                  request: true,
                },
              },
            },
          });

          const isAuthoritative = OcrProcessingService.isAttemptAuthoritative(lockedReceipt);
          if (!isAuthoritative) {
            logger.info(
              { receiptId },
              "[OcrProcessingService] Stale receipt attempt failed OCR — superseded by newer receipt. Discarding status mutation."
            );
            return;
          }

          const activeRequest = lockedReceipt.transaction.request;
          await tx.documentRequest.update({
            where: { id: activeRequest.id },
            data: {
              status: "PAYMENT_UNDER_REVIEW",
              paymentStatus: "PROOF_SUBMITTED",
            },
          });

          await tx.requestHistory.create({
            data: {
              requestId: activeRequest.id,
              actorId: activeRequest.userId,
              action: failureAction,
              oldStatus: activeRequest.status,
              newStatus: "PAYMENT_UNDER_REVIEW",
              remarks: failureRemarks,
            },
          });

          await NotificationDispatcher.notifyReceiptUploaded(
            {
              parishionerId: activeRequest.userId,
              parishId: activeRequest.parishId,
              requestId: activeRequest.id,
              trackingNumber: activeRequest.trackingNumber,
            },
            tx
          );
        });

        return;
      }

      // ── Step 7: Parse and Sanitize extracted text (Real OCR success) ────────
      const sanitizedText = ReceiptParser.sanitize(ocrOutput.rawText || "");
      const parsed = ReceiptParser.parse(sanitizedText);

      // ── Step 8: Calculate Combined Confidence Score ────────────────────────
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

      // ── Step 9.5: Atomic Quality Gate & Stale Attempt Guard ─────────────────
      // Atomically verify authoritative attempt under row lock inside transaction.
      // Eliminates TOCTOU race condition where a newer receipt uploaded while OCR
      // was processing could be overwritten by this stale attempt.
      const minConfidence = env.ocr.minConfidence ?? 0.75;
      const roundedConfidencePct = Math.round(finalConfidence * 100);

      await prisma.$transaction(async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`
            SELECT "request_id"
            FROM "document_requests"
            WHERE "request_id" = ${Number(requestId)}
            FOR UPDATE
          `;
        }

        const lockedReceipt = await tx.receiptUpload.findUnique({
          where: { id: receiptId },
          include: {
            transaction: {
              include: {
                request: true,
              },
            },
          },
        });

        const isStillAuthoritative = OcrProcessingService.isAttemptAuthoritative(lockedReceipt);

        if (!isStillAuthoritative) {
          logger.info(
            {
              receiptId,
              isSuperseded: lockedReceipt?.isSuperseded,
              requestPointer: lockedReceipt?.transaction?.request?.paymentProofObjectKey,
              receiptKey: lockedReceipt?.r2ObjectKey,
            },
            "[OcrProcessingService] Stale receipt attempt completed — superseded by newer receipt. Discarding status mutation and notifications."
          );
          return;
        }

        const activeRequest = lockedReceipt.transaction.request;

        if (finalConfidence >= minConfidence) {
          // High confidence (>= 75%): Transition to PAYMENT_UNDER_REVIEW for manual staff verification
          // Atomically clear obsolete paymentCorrectionNote left by any previous low-confidence attempt!
          logger.info(
            { requestId: activeRequest.id, receiptId, finalConfidence, minConfidence },
            `[OcrProcessingService] Payment proof passed quality threshold (${roundedConfidencePct}% >= ${Math.round(minConfidence * 100)}%). Transitioning to PAYMENT_UNDER_REVIEW.`
          );

          await tx.documentRequest.update({
            where: { id: activeRequest.id },
            data: {
              status: "PAYMENT_UNDER_REVIEW",
              paymentStatus: "PROOF_SUBMITTED",
              paymentCorrectionNote: null, // Clear obsolete correction note!
            },
          });

          await tx.requestHistory.create({
            data: {
              requestId: activeRequest.id,
              actorId: activeRequest.userId,
              action: "RECEIPT_QUALITY_PASSED",
              oldStatus: activeRequest.status,
              newStatus: "PAYMENT_UNDER_REVIEW",
              remarks: `Payment proof passed quality readability check (${roundedConfidencePct}%). Forwarded for manual staff verification.`,
            },
          });

          await NotificationDispatcher.notifyReceiptUploaded(
            {
              parishionerId: activeRequest.userId,
              parishId: activeRequest.parishId,
              requestId: activeRequest.id,
              trackingNumber: activeRequest.trackingNumber,
            },
            tx
          );

          await AuditLogService.log(
            activeRequest.userId,
            "Payment Proof Quality Passed",
            tx,
            false,
            {
              affectedTable: "document_requests",
              affectedRecordId: activeRequest.id,
              parishId: activeRequest.parishId,
              metadata: {
                receiptId,
                finalConfidence,
                minConfidence,
              },
            }
          );
        } else {
          // Low confidence (< 75%): Request clearer re-upload
          logger.info(
            { requestId: activeRequest.id, receiptId, finalConfidence, minConfidence },
            `[OcrProcessingService] Payment proof below quality threshold (${roundedConfidencePct}% < ${Math.round(minConfidence * 100)}%). Transitioning to PAYMENT_NEEDS_CORRECTION.`
          );

          await tx.documentRequest.update({
            where: { id: activeRequest.id },
            data: {
              status: "PAYMENT_NEEDS_CORRECTION",
              paymentStatus: "UNPAID",
              paymentCorrectionNote: "The payment proof image is unclear or blurry. Please upload a clearer image.",
            },
          });

          await tx.requestHistory.create({
            data: {
              requestId: activeRequest.id,
              actorId: activeRequest.userId,
              action: "PAYMENT_PROOF_LOW_CONFIDENCE",
              oldStatus: activeRequest.status,
              newStatus: "PAYMENT_NEEDS_CORRECTION",
              remarks: `Payment proof image is unclear or blurry (${roundedConfidencePct}%). A clearer re-upload is required.`,
            },
          });

          await NotificationDispatcher.notifyReceiptQualityFailed(
            {
              parishionerId: activeRequest.userId,
              parishId: activeRequest.parishId,
              requestId: activeRequest.id,
              trackingNumber: activeRequest.trackingNumber,
            },
            tx
          );

          await AuditLogService.log(
            activeRequest.userId,
            "Payment Proof Low Confidence",
            tx,
            false,
            {
              affectedTable: "document_requests",
              affectedRecordId: activeRequest.id,
              parishId: activeRequest.parishId,
              metadata: {
                receiptId,
                finalConfidence,
                minConfidence,
              },
            }
          );
        }
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
        ocrDurationMs,
        compressionDurationMs,
        totalAsyncDurationMs,
        compressionRatio,
        ocrEngine,
        confidence: null,
        retryCount,
        ocrStatus: "FAILED",
        failureReason,
      });

      // ── Step 10.5: OCR Provider Outage / Exception Guard ───────────────────
      // If OCR throws or is unavailable, re-check authoritative attempt atomically
      // under row lock before modifying request state.
      try {
        await prisma.$transaction(async (tx) => {
          if (requestId && typeof tx.$queryRaw === "function") {
            await tx.$queryRaw`
              SELECT "request_id"
              FROM "document_requests"
              WHERE "request_id" = ${Number(requestId)}
              FOR UPDATE
            `;
          }

          const errorReceiptState = await tx.receiptUpload.findUnique({
            where: { id: receiptId },
            include: {
              transaction: {
                include: {
                  request: true,
                },
              },
            },
          });

          const isErrorAuthoritative = OcrProcessingService.isAttemptAuthoritative(errorReceiptState);

          if (isErrorAuthoritative && errorReceiptState?.transaction?.request) {
            const req = errorReceiptState.transaction.request;
            // Do NOT blame user or call image blurry. Route safely to PAYMENT_UNDER_REVIEW for staff inspection.
            logger.warn(
              { requestId: req.id, receiptId, failureReason },
              "[OcrProcessingService] Readability analysis exception. Preserving recoverable state and forwarding to staff review."
            );

            await tx.documentRequest.update({
              where: { id: req.id },
              data: {
                status: "PAYMENT_UNDER_REVIEW",
                paymentStatus: "PROOF_SUBMITTED",
              },
            });

            await tx.requestHistory.create({
              data: {
                requestId: req.id,
                actorId: req.userId,
                action: "PAYMENT_PROOF_ANALYSIS_UNAVAILABLE",
                oldStatus: req.status,
                newStatus: "PAYMENT_UNDER_REVIEW",
                remarks: "Automated proof quality check was unavailable; forwarded to parish staff for manual verification.",
              },
            });

            await NotificationDispatcher.notifyReceiptUploaded(
              {
                parishionerId: req.userId,
                parishId: req.parishId,
                requestId: req.id,
                trackingNumber: req.trackingNumber,
              },
              tx
            );
          } else {
            logger.info(
              { receiptId },
              "[OcrProcessingService] Stale receipt attempt failed with exception — superseded by newer receipt. Discarding status mutation."
            );
          }
        });
      } catch (txErr) {
        logger.error({ txErr, receiptId }, "[OcrProcessingService] Error in fallback transaction");
      }
    }
  }
}
