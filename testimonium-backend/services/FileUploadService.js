import { prisma } from "../config/db.js";
import { R2Service } from "./R2Service.js";

const r2Service = new R2Service();

export class FileUploadService {
  /**
   * Generates a deterministic, collision-free object key.
   */
  static generateKey(requestId, category, fileName) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `documents/req_${requestId}/${category}/${Date.now()}_${sanitizedName}`;
  }

  /**
   * Uploads request supporting files to Cloudflare R2 and records in RequestAttachment.
   */
  static async uploadAttachment(requestId, file, category = "supporting", dbClient = prisma) {
    const key = this.generateKey(requestId, category, file.originalname);

    // Stream upload to R2
    const publicUrl = await r2Service.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Clean up existing attachment for this category/requirement
    const existing = await dbClient.requestAttachment.findFirst({
      where: { requestId, category },
    });
    if (existing) {
      try {
        await r2Service.delete(existing.r2ObjectKey);
      } catch (err) {
        console.error(`Failed to delete old attachment key ${existing.r2ObjectKey} from R2:`, err);
      }
      await dbClient.requestAttachment.delete({
        where: { id: existing.id },
      });
    }

    // Create DB record
    const attachment = await dbClient.requestAttachment.create({
      data: {
        requestId,
        fileName: file.originalname,
        r2ObjectKey: key,
        fileType: file.mimetype,
        fileSize: file.size,
        category,
      },
    });

    return { ...attachment, publicUrl };
  }

  /**
   * Uploads payment receipts to R2 and records in ReceiptUpload.
   */
  static async uploadReceipt(requestId, paymentTransactionId, file, dbClient = prisma) {
    const key = this.generateKey(requestId, "receipts", file.originalname);

    // Stream upload to R2
    const publicUrl = await r2Service.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Create DB record
    const receipt = await dbClient.receiptUpload.create({
      data: {
        paymentTransactionId,
        r2ObjectKey: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });

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
