import sharp from "sharp";
import { env } from "../config/env.js";

// Disable Sharp's internal cache to prevent native memory fragmentation
// during concurrent image uploads from multiple parishioners.
sharp.cache(false);

// MIME types supported for OCR compression.
// HEIC is explicitly excluded — iPhones using HEIC will be rejected at upload.
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export class ImageCompressionService {
  /**
   * Compresses an image buffer for OCR processing.
   *
   * The original image buffer is NEVER modified — this produces a separate
   * in-memory compressed copy intended solely for OCR API submission.
   *
   * Pipeline:
   *   1. Auto-rotate using EXIF metadata (strips EXIF after)
   *   2. Resize to max width (default 1200px), preserving aspect ratio
   *   3. Normalize contrast
   *   4. Sharpen lightly for OCR readability
   *   5. Convert to JPEG at quality 80
   *   6. If output > OCR_MAX_SIZE_KB, run adaptive compression loop
   *
   * @param {Buffer} imageBuffer   - Original image buffer (unchanged)
   * @param {string} mimeType      - MIME type of the original image
   * @returns {Promise<{
   *   compressedBuffer: Buffer,
   *   originalSize: number,
   *   compressedSize: number,
   *   compressionDurationMs: number
   * }>}
   * @throws {Error} If the MIME type is unsupported (HEIC, GIF, SVG, PDF, etc.)
   */
  static async compress(imageBuffer, mimeType) {
    const startTime = Date.now();
    const originalSize = imageBuffer.length;

    // Guard: reject unsupported formats gracefully before attempting Sharp
    const normalizedMime = (mimeType || "").toLowerCase();
    if (!SUPPORTED_MIME_TYPES.has(normalizedMime)) {
      // Provide a friendly, specific message for HEIC (common iPhone format)
      if (normalizedMime === "image/heic" || normalizedMime === "image/heif") {
        const err = new Error(
          "HEIC/HEIF images from iPhone are not supported for OCR processing. " +
          "Please convert your image to JPEG or PNG before uploading."
        );
        err.statusCode = 415;
        err.code = "UNSUPPORTED_FORMAT_HEIC";
        throw err;
      }
      const err = new Error(
        `Unsupported image format for OCR: ${mimeType}. ` +
        "Only JPEG and PNG images are accepted."
      );
      err.statusCode = 415;
      err.code = "UNSUPPORTED_FORMAT";
      throw err;
    }

    const maxSizeBytes = env.ocr.maxSizeKb * 1024;
    const maxWidth = env.ocr.compressionWidth;
    const baseQuality = env.ocr.compressionQuality;

    // Initial compression pass
    let compressedBuffer = await ImageCompressionService._compress(
      imageBuffer,
      maxWidth,
      baseQuality
    );

    // Adaptive compression loop if output still exceeds OCR.space limits
    if (compressedBuffer.length > maxSizeBytes) {
      const qualitySteps = [70, 60];
      for (const quality of qualitySteps) {
        if (compressedBuffer.length <= maxSizeBytes) break;
        compressedBuffer = await ImageCompressionService._compress(
          imageBuffer,
          maxWidth,
          quality
        );
      }

      // If still too large, reduce width progressively
      const widthSteps = [1000, 900];
      for (const width of widthSteps) {
        if (compressedBuffer.length <= maxSizeBytes) break;
        compressedBuffer = await ImageCompressionService._compress(
          imageBuffer,
          width,
          60
        );
      }

      // Final fallback — log a warning if still over limit, but continue
      if (compressedBuffer.length > maxSizeBytes) {
        const finalKb = Math.round(compressedBuffer.length / 1024);
        console.warn(
          `[ImageCompressionService] Could not compress image below ${env.ocr.maxSizeKb} KB. ` +
          `Final size: ${finalKb} KB. Proceeding with best effort.`
        );
      }
    }

    const compressionDurationMs = Date.now() - startTime;
    const compressedSize = compressedBuffer.length;

    console.log(
      `[ImageCompressionService] Compressed: ` +
      `${Math.round(originalSize / 1024)} KB → ${Math.round(compressedSize / 1024)} KB ` +
      `in ${compressionDurationMs}ms`
    );

    return {
      compressedBuffer,
      originalSize,
      compressedSize,
      compressionDurationMs,
    };
  }

  /**
   * Internal Sharp compression helper.
   * Produces a JPEG buffer from the original image at the given width and quality.
   *
   * @param {Buffer} imageBuffer
   * @param {number} maxWidth   - Maximum output width in pixels
   * @param {number} quality    - JPEG quality (1–100)
   * @returns {Promise<Buffer>}
   */
  static async _compress(imageBuffer, maxWidth, quality) {
    return sharp(imageBuffer)
      .rotate()           // Auto-rotate using EXIF orientation, strips EXIF
      .resize({
        width: maxWidth,
        withoutEnlargement: true,  // Never upscale a small screenshot
        fit: "inside",
      })
      .normalize()        // Stretch contrast for better OCR readability
      .sharpen({ sigma: 0.5, m1: 0.5, m2: 2 }) // Light sharpening
      .jpeg({ quality, mozjpeg: false })
      .toBuffer();
  }
}
