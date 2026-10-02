import crypto from "crypto";
import sharp from "sharp";
import { GOVERNMENT_ID_REJECTION_REASONS } from "../config/governmentIdVerification.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MIN_LONG_EDGE = 400;
const MIN_SHORT_EDGE = 250;
const DEFAULT_SHARPNESS_THRESHOLD = 15;

/**
 * Validates magic bytes for JPEG and PNG formats.
 * @param {Buffer} buffer
 * @returns {string|null} "image/jpeg", "image/png", or null if invalid
 */
export function detectImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return null;

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

/**
 * Calculates a sharpness score using Laplacian edge convolution variance.
 * Higher score = sharper image; lower score = blurry/flat image.
 *
 * @param {Buffer} buffer
 * @returns {Promise<number>}
 */
export async function calculateSharpness(buffer) {
  const { data } = await sharp(buffer)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = data.length;
  if (n === 0) return 0;

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const val = data[i];
    sum += val;
    sumSq += val * val;
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return variance;
}

/**
 * Validates an uploaded ID image buffer for:
 * 1. Existence and size bounds
 * 2. Magic bytes (JPEG/PNG)
 * 3. Decodability via Sharp
 * 4. Dimensional constraints for card-shaped IDs
 * 5. Sharpness / blurriness
 *
 * @param {Buffer} buffer
 * @param {object} [options]
 * @param {number} [options.sharpnessThreshold=DEFAULT_SHARPNESS_THRESHOLD]
 * @returns {Promise<{ valid: boolean, error?: string, rejectionReason?: string, mimeType?: string, width?: number, height?: number, sharpness?: number }>}
 */
export async function validateIdImage(buffer, options = {}) {
  const sharpnessThreshold = options.sharpnessThreshold ?? DEFAULT_SHARPNESS_THRESHOLD;

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      valid: false,
      error: "Image buffer is empty or missing.",
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 10MB limit. Current size: ${(buffer.length / (1024 * 1024)).toFixed(1)}MB`,
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
    };
  }

  const mimeType = detectImageMagicBytes(buffer);
  if (!mimeType) {
    return {
      valid: false,
      error: "Invalid image format. Only JPEG and PNG files are supported.",
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
    };
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (decodeErr) {
    return {
      valid: false,
      error: `Could not decode image: ${decodeErr.message}`,
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.UNSUPPORTED_OR_INVALID_DOCUMENT,
    };
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);

  if (longEdge < MIN_LONG_EDGE || shortEdge < MIN_SHORT_EDGE) {
    return {
      valid: false,
      error: `Image resolution too low (${width}x${height}). Minimum dimension required is ${MIN_LONG_EDGE}x${MIN_SHORT_EDGE}.`,
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY,
    };
  }

  // Sharpness metric
  let sharpness = 0;
  try {
    sharpness = await calculateSharpness(buffer);
  } catch (sharpErr) {
    return {
      valid: false,
      error: `Failed to calculate sharpness: ${sharpErr.message}`,
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY,
    };
  }

  if (sharpness < sharpnessThreshold) {
    return {
      valid: false,
      error: `Image is too blurry (sharpness score: ${sharpness.toFixed(2)}, required: ${sharpnessThreshold}).`,
      rejectionReason: GOVERNMENT_ID_REJECTION_REASONS.IMAGE_BLURRY,
      sharpness,
    };
  }

  return {
    valid: true,
    mimeType,
    width,
    height,
    sharpness,
  };
}

/**
 * Verifies that front and back buffers are not identical duplicates.
 * @param {Buffer} frontBuffer
 * @param {Buffer} backBuffer
 * @returns {boolean} true if distinct, false if identical
 */
export function areFrontAndBackDistinct(frontBuffer, backBuffer) {
  if (!frontBuffer || !backBuffer) return false;
  if (frontBuffer.length !== backBuffer.length) return true;

  const frontHash = crypto.createHash("sha256").update(frontBuffer).digest("hex");
  const backHash = crypto.createHash("sha256").update(backBuffer).digest("hex");

  return frontHash !== backHash;
}

/**
 * Normalizes an accepted image for long-term private R2 storage:
 * - Auto-rotates based on EXIF orientation
 * - Strips all EXIF / GPS / metadata
 * - Converts to high-quality JPEG
 * - Caps max dimension at 1920px (preserving aspect ratio)
 *
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function normalizeForR2Storage(buffer) {
  return sharp(buffer)
    .rotate() // auto-rotate and strip EXIF
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: false })
    .toBuffer();
}
