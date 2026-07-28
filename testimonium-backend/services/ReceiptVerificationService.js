import { prisma } from "../config/db.js";
import { FileUploadService } from "./FileUploadService.js";
import { StubOcrProvider } from "./ocr/StubOcrProvider.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
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

      if (request.status !== "PAYMENT_PENDING" && request.status !== "PAYMENT_NEEDS_CORRECTION") {
        const error = new Error("This request is not awaiting payment or correction.");
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
      // OCR auto-verification is disabled per instructions. Every upload routes to manual review.
      const isAutoVerified = false;

      if (isAutoVerified) {
        // unreachable block, kept for structure
      } else {
        console.log(`[ReceiptVerificationService] Routing upload to manual review (PAYMENT_UNDER_REVIEW)`);

        const oldStatus = request.status;
        const targetStatus = "PAYMENT_UNDER_REVIEW";

        // Update request paymentStatus to PROOF_SUBMITTED and status to PAYMENT_UNDER_REVIEW
        const updatedRequest = await tx.documentRequest.update({
          where: { id: requestId },
          data: {
            paymentStatus: "PROOF_SUBMITTED",
            status: targetStatus,
          },
        });

        // Create Request History entry
        const isResubmission = oldStatus === "PAYMENT_NEEDS_CORRECTION";
        const actionLabel = isResubmission ? "CORRECTED_PAYMENT_SUBMITTED" : "RECEIPT_UPLOADED";
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

        // Fetch parishioner name for notifications
        const user = await tx.user.findUnique({
          where: { id: userId },
        });
        const parishionerName = user ? user.fullName : "Parishioner";

        // Dispatch notifications
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

        await AuditLogService.log(userId, `Receipt uploaded for request ${request.trackingNumber}, transitioned to PAYMENT_UNDER_REVIEW`, tx);

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
