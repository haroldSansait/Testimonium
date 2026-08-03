import { randomUUID } from "crypto";
import { R2Service } from "./R2Service.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const r2Service = new R2Service();

export class ParishImageService {
  /**
   * Helper to extract the R2 key from a public URL.
   */
  static getR2KeyFromUrl(url) {
    if (!url) return null;
    const cleanUrl = url.split("?")[0];
    const publicUrl = env.r2.publicUrl;
    if (cleanUrl.startsWith(publicUrl)) {
      return cleanUrl.slice(publicUrl.length).replace(/^\//, "");
    }
    return null;
  }

  /**
   * Validate image MIME type, magic bytes, and file size.
   */
  static validateImage(file) {
    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      const err = new Error("File size exceeds 5MB limit.");
      err.statusCode = 400;
      throw err;
    }

    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimes.includes((file.mimetype || "").toLowerCase())) {
      const err = new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP are allowed.`);
      err.statusCode = 400;
      throw err;
    }

    const buffer = file.buffer;
    if (!buffer || buffer.length < 12) {
      const err = new Error("Invalid or empty file buffer.");
      err.statusCode = 400;
      throw err;
    }

    // Check magic bytes for JPEG, PNG, and WebP
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                   buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

    if (!isJpg && !isPng && !isWebp) {
      const err = new Error("File content does not match allowed image formats. Only JPEG, PNG, and WebP are allowed.");
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Upload cover or logo image for a parish.
   */
  static async uploadParishImage(parishId, file, type = "cover", actorId = null) {
    const numericId = parseInt(parishId, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    if (type !== "cover" && type !== "logo") {
      const err = new Error("Invalid image type. Must be 'cover' or 'logo'.");
      err.statusCode = 400;
      throw err;
    }

    this.validateImage(file);

    // Fetch parish to get old image and check existence
    const parish = await prisma.parish.findUnique({
      where: { id: numericId },
    });
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      throw err;
    }

    const oldImageUrl = type === "cover" ? parish.coverImage : parish.logoImage;
    const oldKey = this.getR2KeyFromUrl(oldImageUrl);

    // Generate versioned UUID key to prevent name collision or caching issues
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const newKey = `parishes/parish_${numericId}/${type}/${randomUUID()}_${sanitizedName}`;

    let publicUrl;
    try {
      // 1. Upload to R2
      publicUrl = await r2Service.upload({
        key: newKey,
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch (err) {
      logger.error({ err }, "[ParishImageService] Failed to upload image to R2");
      const uploadErr = new Error("Failed to upload image to R2 storage.");
      uploadErr.statusCode = 500;
      throw uploadErr;
    }

    try {
      // 2. Update Database
      const updateData = type === "cover" 
        ? { coverImage: publicUrl }
        : { logoImage: publicUrl };

      await prisma.parish.update({
        where: { id: numericId },
        data: updateData,
      });
    } catch (dbErr) {
      // 3. Rollback: delete the newly uploaded object from R2
      logger.error({ err: dbErr }, "[ParishImageService] Database update failed, rolling back R2 upload");
      try {
        await r2Service.delete(newKey);
      } catch (delErr) {
        logger.error({ err: delErr, key: newKey }, "[ParishImageService] Failed to clean up R2 key during rollback");
      }
      throw dbErr;
    }

    // 4. Cleanup old image if successfully replaced and not matching placeholders
    if (oldKey && !oldImageUrl.includes("unsplash.com")) {
      try {
        await r2Service.delete(oldKey);
      } catch (err) {
        logger.error({ err, oldKey }, "[ParishImageService] Failed to delete old image from R2");
      }
    }

    return publicUrl;
  }
}

