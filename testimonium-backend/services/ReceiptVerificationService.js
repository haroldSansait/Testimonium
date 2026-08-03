import { logger } from "../config/logger.js";
import { prisma } from "../config/db.js";
import { FileUploadService } from "./FileUploadService.js";
import { OcrProcessingService } from "./OcrProcessingService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { AuditLogService } from "./AuditLogService.js";

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

      // ── Step 3: Upload ORIGINAL to Cloudflare R2 ────────────────────────────
      // The original buffer is uploaded exactly as-is. It is NEVER compressed.
      const receipt = await FileUploadService.uploadReceipt(
        requestId,
        transaction.id,
        file,
        tx
      );

      // ── Step 4: Create initial OcrResult with PENDING status ────────────────
      const ocrRecord = await tx.ocrResult.create({
        data: {
          receiptUploadId: receipt.id,
          status: "PENDING",
          confidenceScore: 0,
        },
      });

      // ── Step 5: Update payment proof reference on the request ───────────────
      await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          paymentProofObjectKey: receipt.r2ObjectKey,
        },
      });

      // ── Step 6: Always route to manual secretary review ─────────────────────
      logger.info(
        { requestId },
        "[ReceiptVerificationService] Routing request to manual review (PAYMENT_UNDER_REVIEW)"
      );

      const oldStatus = request.status;
      const targetStatus = "PAYMENT_UNDER_REVIEW";

      const updatedRequest = await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          paymentStatus: "PROOF_SUBMITTED",
          status: targetStatus,
        },
      });

      // ── Step 7: Create audit history entry ──────────────────────────────────
      const isResubmission = oldStatus === "PAYMENT_NEEDS_CORRECTION";
      const actionLabel = isResubmission
        ? "CORRECTED_PAYMENT_SUBMITTED"
        : "RECEIPT_UPLOADED";
      const remarksText = isResubmission
        ? "Corrected payment proof uploaded, pending manual verification by coordinator"
        : "Receipt uploaded, pending manual verification by coordinator";

      await tx.requestHistory.create({
        data: {
          requestId,
          actorId: userId,
          action: actionLabel,
          oldStatus,
          newStatus: targetStatus,
          remarks: remarksText,
        },
      });

      // ── Step 8: Fetch parishioner name for notifications ────────────────────
      const user = await tx.user.findUnique({ where: { id: userId } });
      const parishionerName = user?.fullName ?? "Parishioner";

      // ── Step 9: Dispatch notifications ─────────────────────────────────────
      if (isResubmission) {
        await NotificationDispatcher.notifyReceiptResubmitted(
          {
            parishionerId: userId,
            parishionerName,
            parishId: request.parishId,
            requestId: request.id,
            trackingNumber: request.trackingNumber,
          },
          tx
        );
      } else {
        await NotificationDispatcher.notifyReceiptUploaded(
          {
            parishionerId: userId,
            parishId: request.parishId,
            requestId: request.id,
            trackingNumber: request.trackingNumber,
          },
          tx
        );
      }

      await AuditLogService.log(
        userId,
        `Receipt uploaded for request ${request.trackingNumber}, transitioned to PAYMENT_UNDER_REVIEW`,
        tx
      );

      return {
        receiptId: receipt.id,
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
      ocrStatus: "PENDING",
      request: result.request,
    };
  }
}
