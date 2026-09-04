/**
 * FileValidator — Centralized binary signature (magic bytes), MIME type,
 * and size validation for TESTIMONIUM file uploads.
 *
 * Rules:
 *  - Payment Receipts: JPEG, PNG only, <= 5 MB.
 *  - Authorization Letters: PDF, JPEG, PNG only, <= 5 MB (no WebP).
 *  - Supporting Documents: PDF, JPEG, PNG, WebP, <= 5 MB.
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class FileValidationError extends Error {
  constructor(message, { code = "INVALID_FILE", statusCode = 400, field = null } = {}) {
    super(message);
    this.name = "FileValidationError";
    this.code = code;
    this.statusCode = statusCode;
    this.field = field;
  }
}

/**
 * Inspects buffer magic bytes to determine genuine binary file signature.
 * Returns canonical file type: "pdf" | "jpeg" | "png" | "webp" | null
 */
export function detectFileSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  // PNG: 0x89 0x50 0x4E 0x47 (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // WebP: RIFF at byte 0-3 and WEBP at byte 8-11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export class FileValidator {
  /**
   * Validates Payment Receipt uploads:
   *  - JPEG and PNG only
   *  - Max 5 MB
   *  - Verified by magic byte signature
   */
  static validateReceipt(file) {
    if (!file) {
      throw new FileValidationError("Receipt file is required.", {
        code: "PAYMENT_PROOF_INVALID_IMAGE",
        statusCode: 400,
        field: "receipt",
      });
    }

    if (file.size === 0 || !file.buffer || file.buffer.length === 0) {
      throw new FileValidationError("Uploaded receipt file is empty (0 bytes).", {
        code: "PAYMENT_PROOF_INVALID_IMAGE",
        statusCode: 400,
        field: "receipt",
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        "Payment receipt exceeds the allowable 5MB limit.",
        {
          code: "PAYMENT_PROOF_INVALID_IMAGE",
          statusCode: 413,
          field: "receipt",
        }
      );
    }

    const rawMime = (file.mimetype || "").toLowerCase().trim();
    const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;

    // Detect HEIC specifically to give a helpful rejection message
    if (
      normalizedMime === "image/heic" ||
      normalizedMime === "image/heif" ||
      (file.originalname && /\.(heic|heif)$/i.test(file.originalname))
    ) {
      throw new FileValidationError(
        "HEIC/HEIF images (iPhone format) are not supported. Please convert your receipt to JPEG or PNG.",
        {
          code: "PAYMENT_PROOF_INVALID_IMAGE",
          statusCode: 415,
          field: "receipt",
        }
      );
    }

    // Check MIME
    const allowedReceiptMimes = ["image/jpeg", "image/png"];
    if (!allowedReceiptMimes.includes(normalizedMime)) {
      throw new FileValidationError(
        `Invalid receipt format (${file.mimetype || "unknown"}). Only JPEG and PNG images are accepted.`,
        {
          code: "PAYMENT_PROOF_INVALID_IMAGE",
          statusCode: 400,
          field: "receipt",
        }
      );
    }

    // Inspect real binary signature
    const signature = detectFileSignature(file.buffer);
    if (!signature || (signature !== "jpeg" && signature !== "png")) {
      throw new FileValidationError(
        "Payment proof image verification failed. File content does not match genuine JPEG or PNG format.",
        {
          code: "PAYMENT_PROOF_INVALID_IMAGE",
          statusCode: 400,
          field: "receipt",
        }
      );
    }

    return { signature, normalizedMime };
  }

  /**
   * Validates Authorization Letter uploads:
   *  - PDF, JPEG, and PNG only (NO WebP, NO executables, NO disguised files)
   *  - Max 5 MB
   *  - Verified by magic byte signature
   */
  static validateAuthorizationLetter(file) {
    if (!file) {
      throw new FileValidationError("Authorization letter file is required.", {
        code: "AUTHORIZATION_LETTER_INVALID",
        statusCode: 400,
        field: "authorization_letter",
      });
    }

    if (file.size === 0 || !file.buffer || file.buffer.length === 0) {
      throw new FileValidationError(
        "Uploaded authorization letter file is empty (0 bytes).",
        {
          code: "AUTHORIZATION_LETTER_INVALID",
          statusCode: 400,
          field: "authorization_letter",
        }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        "Authorization letter exceeds the allowable 5MB limit.",
        {
          code: "AUTHORIZATION_LETTER_INVALID",
          statusCode: 413,
          field: "authorization_letter",
        }
      );
    }

    const rawMime = (file.mimetype || "").toLowerCase().trim();
    const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;

    // Disallow WebP explicitly for authorization letters
    if (normalizedMime === "image/webp" || (file.originalname && /\.webp$/i.test(file.originalname))) {
      throw new FileValidationError(
        "WebP format is not accepted for authorization letters. Please provide a PDF, JPEG, or PNG document.",
        {
          code: "AUTHORIZATION_LETTER_INVALID",
          statusCode: 400,
          field: "authorization_letter",
        }
      );
    }

    // Allowed MIME types for authorization letters
    const allowedLetterMimes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedLetterMimes.includes(normalizedMime)) {
      throw new FileValidationError(
        `Invalid file type (${file.mimetype || "unknown"}) for authorization letter. Only PDF, JPEG, and PNG files are allowed.`,
        {
          code: "AUTHORIZATION_LETTER_INVALID",
          statusCode: 400,
          field: "authorization_letter",
        }
      );
    }

    // Inspect real binary signature
    const signature = detectFileSignature(file.buffer);
    if (!signature || (signature !== "pdf" && signature !== "jpeg" && signature !== "png")) {
      throw new FileValidationError(
        "Authorization letter file signature verification failed. The uploaded file is corrupted or not a valid PDF, JPEG, or PNG.",
        {
          code: "AUTHORIZATION_LETTER_INVALID",
          statusCode: 400,
          field: "authorization_letter",
        }
      );
    }

    return { signature, normalizedMime };
  }

  /**
   * Validates General Supporting Document uploads:
   *  - PDF, PNG, JPEG, WebP
   *  - Max 5 MB
   *  - Verified by magic byte signature
   */
  static validateSupportingDocument(file) {
    if (!file) {
      throw new FileValidationError("Attachment file is required.", {
        code: "INVALID_ATTACHMENT",
        statusCode: 400,
      });
    }

    if (file.size === 0 || !file.buffer || file.buffer.length === 0) {
      throw new FileValidationError("Uploaded attachment file is empty (0 bytes).", {
        code: "INVALID_ATTACHMENT",
        statusCode: 400,
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        "Attachment exceeds the allowable 5MB limit.",
        {
          code: "FILE_TOO_LARGE",
          statusCode: 413,
        }
      );
    }

    const rawMime = (file.mimetype || "").toLowerCase().trim();
    const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;

    const allowedMimes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedMimes.includes(normalizedMime)) {
      throw new FileValidationError(
        `Invalid file type: ${file.mimetype}. Only PDF, PNG, JPEG, and WEBP files are allowed.`,
        {
          code: "INVALID_FILE_TYPE",
          statusCode: 415,
        }
      );
    }

    const signature = detectFileSignature(file.buffer);
    if (!signature || !["pdf", "jpeg", "png", "webp"].includes(signature)) {
      throw new FileValidationError(
        "File signature validation failed. The file is corrupted or its contents do not match allowed formats.",
        {
          code: "INVALID_FILE_SIGNATURE",
          statusCode: 400,
        }
      );
    }

    return { signature, normalizedMime };
  }
}
