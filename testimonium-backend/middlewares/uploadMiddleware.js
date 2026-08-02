import multer from "multer";
import path from "path";

// Allowed MIME types for general document attachments (requirements, IDs, etc.)
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

// Allowed MIME types for payment receipt uploads.
// Restricted to JPEG and PNG only — required for OCR.space processing.
// HEIC (iPhone) and PDF are NOT accepted at this stage.
const RECEIPT_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const RECEIPT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check MIME Type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error(
      `Invalid file type: ${file.mimetype}. Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  // Check Extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error(
      `Invalid extension: ${ext}. Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  return cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

// Middleware for multiple attachment uploads (limit 10 files)
export const uploadRequestFiles = (req, res, next) => {
  const uploadArray = upload.array("files", 10);
  uploadArray(req, res, (err) => {
    if (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message,
        errors: [],
      });
    }

    // Additional check: Check for zero-byte empty files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        if (file.size === 0) {
          return res.status(400).json({
            success: false,
            message: `File ${file.originalname} is empty (0 bytes).`,
            errors: [],
          });
        }
      }
    }

    return next();
  });
};

// Receipt-specific file filter: JPEG and PNG only.
// Produces a user-friendly error for HEIC (common iPhone format).
const receiptFileFilter = (req, file, cb) => {
  const normalizedMime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();

  // Detect HEIC/HEIF specifically for a helpful error message
  if (normalizedMime === "image/heic" || normalizedMime === "image/heif" ||
      ext === ".heic" || ext === ".heif") {
    const err = new Error(
      "HEIC/HEIF images (iPhone format) are not supported. " +
      "Please convert your receipt image to JPEG or PNG before uploading."
    );
    err.statusCode = 415;
    return cb(err, false);
  }

  if (!RECEIPT_MIME_TYPES.has(normalizedMime)) {
    const err = new Error(
      `Invalid file type for receipt: ${file.mimetype}. ` +
      "Only JPEG and PNG images are accepted for payment receipts."
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  if (!RECEIPT_EXTENSIONS.has(ext)) {
    const err = new Error(
      `Invalid file extension: ${ext}. ` +
      "Only .jpg, .jpeg, and .png files are accepted for payment receipts."
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  return cb(null, true);
};

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB — backend will compress before sending to OCR
  },
  fileFilter: receiptFileFilter,
});

// Middleware for single payment receipt upload
export const uploadReceiptFile = (req, res, next) => {
  const uploadSingle = receiptUpload.single("receipt");
  uploadSingle(req, res, (err) => {
    if (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message,
        errors: [],
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No receipt file uploaded.",
        errors: [],
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded receipt file is empty (0 bytes).",
        errors: [],
      });
    }

    return next();
  });
};

