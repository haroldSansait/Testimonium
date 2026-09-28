import { logger } from "../config/logger.js";
import { prisma } from "../config/db.js";
import { FileUploadService } from "./FileUploadService.js";
import { OcrProcessingService } from "./OcrProcessingService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { AuditLogService } from "./AuditLogService.js";
import { assertParishionerOwnerRole } from "./ParishionerRequestService.js";

export class ReceiptVerificationService {
  /**
   * Processes an uploaded payment receipt:
   *
   * Phase A (Synchronous, inside Prisma transaction):
   *   1. Validate request ownership and status
   *   2. Resolve or create PaymentTransaction
   *   3. Upload ORIGINAL buffer to Cloudflare R2 (evidence, unchanged)
   *   4. Create initial OcrResult record with PENDING status
   *   5. Update request status to PAYMENT_UNDER_REVIEW
   *   6. Create request history log
   *   7. Dispatch notifications
   *   8. Commit transaction and return immediately.
   *
   * Phase B (Asynchronous, outside transaction):
   *   Triggers OcrProcessingService.processAsync() in the background via setImmediate.
   *
   * @param {number} requestId
   * @param {number} userId
   * @param {Express.Multer.File} file  - { buffer, mimetype, originalname, size }
   */
  static async processReceipt(requestId, userId, file) {
    // Phase A: Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      await assertParishionerOwnerRole(userId, tx);
      // ── Step 0: Pessimistic Row Lock on DocumentRequest ─────────────────────
      // Serializes concurrent receipt uploads for the same request to guarantee
      // that concurrent uploads cannot create duplicate PaymentTransactions
      // or interleave attempt allocation.
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`
          SELECT "request_id"
          FROM "document_requests"
          WHERE "request_id" = ${Number(requestId)}
          FOR UPDATE
        `;
      }

      // ── Step 1: Validate request ownership and status ───────────────────────
      const request = await tx.documentRequest.findFirst({
        where: { id: requestId, userId },
      });

      if (!request) {
        const error = new Error("Request not found or does not belong to this user.");
        error.statusCode = 404;
        throw error;
      }

      if (
        request.status !== "PAYMENT_PENDING" &&
        request.status !== "PAYMENT_NEEDS_CORRECTION"
      ) {
        const error = new Error("This request is not awaiting payment or correction.");
        error.statusCode = 400;
        throw error;
      }

      // ── Step 2: Resolve or create PaymentTransaction ────────────────────────
      let transaction = await tx.paymentTransaction.findFirst({
        where: { requestId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });

      if (!transaction) {
        transaction = await tx.paymentTransaction.create({
          data: {
            requestId,
            status: "PENDING",
          },
        });
      }

      // ── Step 2.1: Pessimistic Row Lock on PaymentTransaction ────────────────
      // Explicitly locks the PaymentTransaction row inside the transaction to
      // serialize attemptVersion allocation and avoid race conditions.
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`
          SELECT "payment_id"
          FROM "payment_transactions"
          WHERE "payment_id" = ${Number(transaction.id)}
          FOR UPDATE
        `;
      }

      // ── Step 2.5: Atomically allocate attemptVersion & mark superseded ────
      const latestReceipt = await tx.receiptUpload.findFirst({
        where: { paymentTransactionId: transaction.id },
        orderBy: { attemptVersion: "desc" },
      });
      const nextAttemptVersion = (latestReceipt?.attemptVersion || 0) + 1;

      // Mark all existing receipts for this transaction as superseded
      await tx.receiptUpload.updateMany({
        where: {
          paymentTransactionId: transaction.id,
          isSuperseded: false,
        },
        data: {
          isSuperseded: true,
        },
      });

      // ── Step 3: Upload ORIGINAL to Cloudflare R2 ────────────────────────────
      // The original buffer is uploaded exactly as-is. It is NEVER compressed.
      const receipt = await FileUploadService.uploadReceipt(
        requestId,
        transaction.id,
        file,
        nextAttemptVersion,
        tx
      );

      // Fraud Check: Image Hash Deduplication against verified payments
      let isDuplicateHash = false;
      let duplicateReqId = null;

      if (receipt.imageHash) {
        const priorVerifiedReceipt = await tx.receiptUpload.findFirst({
          where: {
            imageHash: receipt.imageHash,
            id: { not: receipt.id },
            transaction: {
              status: "VERIFIED",
              requestId: { not: requestId },
            },
          },
          include: { transaction: true },
        });

        if (priorVerifiedReceipt) {
          isDuplicateHash = true;
          duplicateReqId = priorVerifiedReceipt.transaction.requestId;
          logger.warn(
            { requestId, duplicateRequestId: duplicateReqId, imageHash: receipt.imageHash },
            "[ReceiptVerificationService] Fraud Alert: Duplicate receipt image hash detected against verified request"
          );
        }
      }

      // ── Step 4: Create initial OcrResult with PENDING status ────────────────
      const ocrRecord = await tx.ocrResult.create({
        data: {
          receiptUploadId: receipt.id,
          status: "PENDING",
          confidenceScore: 0,
          isDuplicate: isDuplicateHash,
          duplicateRequestId: duplicateReqId,
          duplicateReason: isDuplicateHash ? "DUPLICATE_IMAGE_HASH" : null,
        },
      });

      // ── Step 5: Update payment proof reference on the request ───────────────
      const oldStatus = request.status;
      const updatedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          paymentProofObjectKey: receipt.r2ObjectKey,
          paymentStatus: "PROOF_SUBMITTED",
        },
      });

      // ── Step 6: Create audit history entry for upload attempt ───────────────
      const isResubmission = oldStatus === "PAYMENT_NEEDS_CORRECTION";
      const actionLabel = isResubmission
        ? "CORRECTED_RECEIPT_UPLOADED"
        : "RECEIPT_UPLOADED";
      const remarksText = isResubmission
        ? `Corrected payment proof uploaded (Attempt #${nextAttemptVersion}), quality readability analysis in progress`
        : `Receipt uploaded (Attempt #${nextAttemptVersion}), quality readability analysis in progress`;

      await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: actionLabel,
          oldStatus,
          newStatus: oldStatus,
          remarks: remarksText,
        },
      });

      await AuditLogService.log(
        userId,
        "Receipt Uploaded",
        tx,
        false,
        {
          affectedTable: "document_requests",
          affectedRecordId: request.id,
          parishId: request.parishId,
          previousValues: {
            status: request.status,
          },
          newValues: {
            status: request.status,
          },
          metadata: {
            trackingNumber: request.trackingNumber,
            receiptId: receipt.id,
            attemptVersion: nextAttemptVersion,
          },
        }
      );

      return {
        receiptId: receipt.id,
        attemptVersion: nextAttemptVersion,
        ocrResult: ocrRecord,
        request: updatedRequest,
      };
    }, {
      timeout: 15000, // Reduced from 30s as OCR is outside the transaction now
    });

    // Phase B: Asynchronous background processing (outside transaction)
    setImmediate(() => {
      OcrProcessingService.processAsync(result.receiptId).catch((err) => {
        logger.error(
          { err, receiptId: result.receiptId },
          "[ReceiptVerificationService] Background OCR dispatch error for receiptId"
        );
      });
    });

    return {
      success: true,
      autoVerified: false,
      ocrPending: true,
      receiptId: result.receiptId,
      attemptVersion: result.attemptVersion,
      ocrStatus: "PENDING",
      request: result.request,
    };
  }
}
