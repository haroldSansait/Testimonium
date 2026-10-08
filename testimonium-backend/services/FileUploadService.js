import crypto from "crypto";
import { logger } from "../config/logger.js";
import { prisma } from "../config/db.js";
import { R2Service } from "./R2Service.js";
import { FileValidator } from "../utils/fileValidator.js";
import { isSelfRelationship } from "../config/relationshipEvidence.js";

const r2Service = new R2Service();

export class FileUploadService {
  /**
   * Generates a deterministic, collision-free object key.
   */
  static generateKey(requestId, category, fileName) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `documents/req_${requestId}/${category}/${Date.now()}_${sanitizedName}`;
  }

  static generateOpaqueAuthorizationKey(requestId) {
    return `documents/req_${Number(requestId)}/authorization_letter/${crypto.randomUUID()}`;
  }

  /** Serializes Authorization Letter replacement with submission/resubmission. */
  static async uploadAuthorizationLetter(requestId, userId, file) {
    FileValidator.validateAuthorizationLetter(file);
    const numericRequestId = Number(requestId);
    const key = this.generateOpaqueAuthorizationKey(numericRequestId);

    let publicUrl;
    try {
      publicUrl = await r2Service.upload({ key, body: file.buffer, contentType: file.mimetype });
    } catch (uploadErr) {
      logger.error({ err: uploadErr }, "Failed to upload Authorization Letter to R2");
      throw uploadErr;
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw`SELECT "request_id" FROM "document_requests" WHERE "request_id" = ${numericRequestId} FOR UPDATE`;
        }
        const request = await tx.documentRequest.findFirst({
          where: { id: numericRequestId, userId: Number(userId) },
          select: { id: true, isDraft: true, status: true, relationship: true, correctionRequirementIds: true },
        });
        if (!request) {
          const error = new Error("Request not found or does not belong to this user.");
          error.statusCode = 404;
          throw error;
        }
        if (isSelfRelationship(request.relationship)) {
          const error = new Error("Authorization letter is only applicable to non-Self requests.");
          error.statusCode = 400;
          error.code = "INVALID_ATTACHMENT_CATEGORY";
          throw error;
        }
        const correctionAllowed = request.status === "NEEDS_CORRECTION" &&
          (request.correctionRequirementIds || []).includes("authorization_letter");
        if (!request.isDraft && !correctionAllowed) {
          const error = new Error("Authorization Letter evidence is immutable in the request's current status.");
          error.statusCode = 409;
          error.code = "RELATIONSHIP_EVIDENCE_UPLOAD_CONFLICT";
          throw error;
        }

        const existing = await tx.requestAttachment.findFirst({
          where: { requestId: numericRequestId, category: "authorization_letter" },
          orderBy: { id: "desc" },
        });
        const attachment = await tx.requestAttachment.create({
          data: { requestId: numericRequestId, fileName: file.originalname, r2ObjectKey: key,
            fileType: file.mimetype, fileSize: file.size, category: "authorization_letter" },
        });
        if (existing) await tx.requestAttachment.delete({ where: { id: existing.id } });
        return { attachment, oldObjectKey: existing?.r2ObjectKey || null };
      }, { maxWait: 10000, timeout: 20000 });
    } catch (dbErr) {
      try { await r2Service.delete(key); }
      catch (cleanupErr) { logger.error({ err: cleanupErr }, "Failed to clean up an uncommitted Authorization Letter object"); }
      throw dbErr;
    }

    if (result.oldObjectKey) {
      try { await r2Service.delete(result.oldObjectKey); }
      catch (cleanupErr) { logger.error({ err: cleanupErr }, "Failed to delete a superseded Authorization Letter object"); }
    }
    return { ...result.attachment, publicUrl };
  }

  /**
   * Uploads request supporting files / authorization letters to Cloudflare R2 and records in RequestAttachment.
   * Enforces:
   *  - Category-based file signature & MIME validation
   *  - R2 upload success -> DB write failure -> newly uploaded R2 object cleanup
   *  - Replacement invariant: persist new authoritative attachment before cleaning up old file
   */
  static async uploadAttachment(requestId, file, category = "supporting", dbClient = prisma) {
    if (category === "authorization_letter") {
      FileValidator.validateAuthorizationLetter(file);
    } else {
      FileValidator.validateSupportingDocument(file);
    }

    const key = this.generateKey(requestId, category, file.originalname);

    // Query existing attachment for this category before creating new one
    const existing = await dbClient.requestAttachment.findFirst({
      where: { requestId, category },
    });

    // 1. Upload new object to R2
    let publicUrl;
    try {
      publicUrl = await r2Service.upload({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch (uploadErr) {
      logger.error({ uploadErr, key }, "Failed to upload attachment to R2");
      throw uploadErr;
    }

    // 2. Persist new DB record
    let attachment;
    try {
      attachment = await dbClient.requestAttachment.create({
        data: {
          requestId,
          fileName: file.originalname,
          r2ObjectKey: key,
          fileType: file.mimetype,
          fileSize: file.size,
          category,
        },
      });
    } catch (dbErr) {
      // Cleanup orphan R2 object if DB creation fails
      try {
        await r2Service.delete(key);
      } catch (cleanupErr) {
        logger.error({ cleanupErr, key }, "Failed to clean up orphan R2 object after DB error");
      }
      throw dbErr;
    }

    // 3. Only after DB success, clean up old attachment
    if (existing) {
      try {
        await dbClient.requestAttachment.delete({
          where: { id: existing.id },
        });
        await r2Service.delete(existing.r2ObjectKey);
      } catch (err) {
        // Do not fail new attachment if cleanup of stale file fails
        logger.error({ err, r2ObjectKey: existing.r2ObjectKey }, "Failed to delete stale attachment key from R2");
      }
    }

    return { ...attachment, publicUrl };
  }

  /**
   * Uploads payment receipts to R2 and records in ReceiptUpload.
   * Enforces:
   *  - Receipt signature & MIME validation (JPEG/PNG <= 5MB)
   *  - R2 upload success -> DB write failure -> newly uploaded R2 object cleanup
   *  - Attempt versioning support
   */
  static async uploadReceipt(requestId, paymentTransactionId, file, attemptVersion = 1, dbClient = prisma) {
    FileValidator.validateReceipt(file);

    const key = this.generateKey(requestId, "receipts", file.originalname);
    const imageHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    // Stream upload to R2
    let publicUrl;
    try {
      publicUrl = await r2Service.upload({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch (uploadErr) {
      logger.error({ uploadErr, key }, "Failed to upload receipt to R2");
      throw uploadErr;
    }

    // Persist DB record with orphan cleanup on failure
    let receipt;
    try {
      receipt = await dbClient.receiptUpload.create({
        data: {
          paymentTransactionId,
          r2ObjectKey: key,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          imageHash,
          attemptVersion,
          isSuperseded: false,
        },
      });
    } catch (dbErr) {
      try {
        await r2Service.delete(key);
      } catch (cleanupErr) {
        logger.error({ cleanupErr, key }, "Failed to clean up orphan receipt from R2 after DB error");
      }
      throw dbErr;
    }

    return { ...receipt, publicUrl };
  }

  /**
   * Deletes a file from both R2 and database.
   */
  static async deleteAttachment(attachmentId) {
    const attachment = await prisma.requestAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new Error("Attachment not found.");
    }

    // Delete from R2
    await r2Service.delete(attachment.r2ObjectKey);

    // Delete from DB
    await prisma.requestAttachment.delete({
      where: { id: attachmentId },
    });
  }
}
