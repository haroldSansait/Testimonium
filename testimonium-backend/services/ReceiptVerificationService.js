import { prisma } from "../config/db.js";
import { FileUploadService } from "./FileUploadService.js";
import { StubOcrProvider } from "./ocr/StubOcrProvider.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";

const ocrProvider = new StubOcrProvider();

export class ReceiptVerificationService {
  /**
   * Process uploaded payment receipt and run OCR checks.
   */
  static async processReceipt(requestId, userId, file) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve request and check ownership
      const request = await tx.documentRequest.findFirst({
        where: { id: requestId, userId },
      });

      if (!request) {
        const error = new Error("Request not found or does not belong to this user.");
        error.statusCode = 404;
        throw error;
      }

      if (request.status !== "PAYMENT_PENDING") {
        const error = new Error("This request is not awaiting payment.");
        error.statusCode = 400;
        throw error;
      }

      // 2. Resolve or create PaymentTransaction
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

      // 3. Stream receipt file upload to Cloudflare R2
      const receipt = await FileUploadService.uploadReceipt(requestId, transaction.id, file, tx);

      // 4. Trigger OCR analysis
      const ocrData = await ocrProvider.extractFromReceipt(file.buffer, file.mimetype, file.originalname);

      // Save OCR results to database
      const ocrRecord = await tx.ocrResult.create({
        data: {
          receiptUploadId: receipt.id,
          referenceNumber: ocrData.referenceNumber,
          amount: ocrData.amount,
          paymentDate: ocrData.paymentDate,
          provider: ocrData.provider,
          confidenceScore: ocrData.confidenceScore,
          rawText: ocrData.rawText,
        },
      });

      // Update payment proof metadata in request table
      await tx.documentRequest.update({
        where: { id: requestId },
        data: {
          paymentProofObjectKey: receipt.r2ObjectKey,
        },
      });

      // 5. Automatic Verification Logic
      const CONFIDENCE_THRESHOLD = 0.90;
      const isAutoVerified = ocrData.confidenceScore >= CONFIDENCE_THRESHOLD;

      if (isAutoVerified) {
        console.log(`[ReceiptVerificationService] Auto-verifying request ${request.trackingNumber} via OCR`);

        // Update Payment Transaction
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "VERIFIED",
            amount: ocrData.amount ? parseFloat(ocrData.amount) : null,
            provider: ocrData.provider,
            referenceNumber: ocrData.referenceNumber,
            verifiedAt: new Date(),
          },
        });

        // Update Document Request
        const updatedRequest = await tx.documentRequest.update({
          where: { id: requestId },
          data: {
            paymentStatus: "CONFIRMED",
            status: "PAYMENT_VERIFIED", // Move request to PAYMENT_VERIFIED state
          },
        });

        // Create Request History entry
        await tx.requestHistory.create({
          data: {
            requestId,
            actorId: userId,
            action: "PAYMENT_AUTO_VERIFIED",
            oldStatus: "PAYMENT_PENDING",
            newStatus: "PAYMENT_VERIFIED",
            remarks: `Payment auto-verified by OCR (Ref: ${ocrData.referenceNumber}, Conf: ${ocrData.confidenceScore * 100}%)`,
          },
        });

        // Send notifications
        await RequestNotificationService.notifyStatusChange(
          userId,
          request.id,
          request.trackingNumber,
          "PAYMENT_PENDING",
          "PAYMENT_VERIFIED",
          tx
        );

        await AuditLogService.log(userId, `Receipt auto-verified via OCR for request ${request.trackingNumber}`, tx);

        return {
          success: true,
          autoVerified: true,
          ocrResult: ocrRecord,
          request: updatedRequest,
        };
      } else {
        console.log(`[ReceiptVerificationService] OCR confidence too low (${ocrData.confidenceScore}), routing to manual review`);

        // Update request paymentStatus to PROOF_SUBMITTED so staff is aware
        const updatedRequest = await tx.documentRequest.update({
          where: { id: requestId },
          data: {
            paymentStatus: "PROOF_SUBMITTED",
          },
        });

        // Create Request History entry
        await tx.requestHistory.create({
          data: {
            requestId,
            actorId: userId,
            action: "RECEIPT_UPLOADED",
            oldStatus: "PAYMENT_PENDING",
            newStatus: "PAYMENT_PENDING",
            remarks: "Receipt uploaded, pending manual verification by coordinator",
          },
        });

        // Notify
        await RequestNotificationService.send(
          userId,
          "Payment Proof Submitted",
          `Your payment proof for request ${request.trackingNumber} has been uploaded and is undergoing verification.`,
          "IN_APP",
          tx
        );

        await AuditLogService.log(userId, `Receipt uploaded for request ${request.trackingNumber}, pending manual check`, tx);

        return {
          success: true,
          autoVerified: false,
          ocrResult: ocrRecord,
          request: updatedRequest,
        };
      }
    });
  }
}
