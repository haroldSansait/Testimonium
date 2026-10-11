import multer from "multer";
import path from "path";
import { FileValidator, FileValidationError } from "../utils/fileValidator.js";

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
  const rawMime = (file.mimetype || "").trim().toLowerCase();
  const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;

  // Check MIME Type
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    const err = new Error(
      `Invalid file type: ${file.mimetype}. Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.`
    );
    err.statusCode = 415;
    return cb(err, false);
  }
  file.mimetype = normalizedMime;

  // Check Extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error(
      `Invalid extension: ${ext}. Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.`
    );
    err.statusCode = 415;
    return cb(err, false);
  }

  return cb(null, true);
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 5,                  // Maximum 5 files per request
  },
  fileFilter,
});

// Middleware for multiple attachment uploads (limit 5 files, 5MB each)
export const uploadRequestFiles = (req, res, next) => {
  const uploadArray = upload.array("files", 5);
  uploadArray(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "File size exceeds the allowable 5MB limit.",
            errors: [{ field: "files", message: "File exceeds 5MB." }],
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            message: "Too many files uploaded. Maximum of 5 files allowed per request.",
            errors: [{ field: "files", message: "Maximum 5 files." }],
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: [],
        });
      }

      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message,
        errors: [],
      });
    }

    // Synchronously validate file signatures, MIME, and bounds
    if (req.files && Array.isArray(req.files)) {
      const category = (req.body?.category || "").trim();
      for (const file of req.files) {
        if (file.size === 0) {
          return res.status(400).json({
            success: false,
            message: `File ${file.originalname} is empty (0 bytes).`,
            errors: [],
          });
        }
        try {
          if (category === "authorization_letter") {
            FileValidator.validateAuthorizationLetter(file);
          } else {
            FileValidator.validateSupportingDocument(file);
          }
        } catch (validationErr) {
          return res.status(validationErr.statusCode || 400).json({
            success: false,
            code: validationErr.code || "INVALID_FILE",
            message: validationErr.message,
            errors: validationErr.field ? [{ field: validationErr.field, message: validationErr.message }] : [],
          });
        }
      }
    }

    return next();
  });
};

// Receipt-specific file filter: JPEG, PNG, and WEBP.
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
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,                  // Single file
  },
  fileFilter: receiptFileFilter,
});

// Middleware for single payment receipt upload
export const uploadReceiptFile = (req, res, next) => {
  const uploadSingle = receiptUpload.single("receipt");
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "Payment receipt exceeds the allowable 5MB limit.",
            errors: [{ field: "receipt", message: "Receipt file exceeds 5MB." }],
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: [],
        });
      }

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
        code: "PAYMENT_PROOF_INVALID_IMAGE",
        message: "Uploaded receipt file is empty (0 bytes).",
        errors: [],
      });
    }

    // Synchronously validate binary signature (magic bytes), MIME, and bounds
    try {
      FileValidator.validateReceipt(req.file);
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({
        success: false,
        code: validationErr.code || "PAYMENT_PROOF_INVALID_IMAGE",
        message: validationErr.message,
        errors: validationErr.field ? [{ field: validationErr.field, message: validationErr.message }] : [],
      });
    }

    return next();
  });
};

// Government ID front and back upload handler
const idUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const rawMime = (file.mimetype || "").trim().toLowerCase();
    const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
    if (normalizedMime !== "image/jpeg" && normalizedMime !== "image/png") {
      const err = new Error(
        `Invalid file format for ${file.fieldname}: ${file.mimetype}. Only JPEG and PNG images are allowed.`
      );
      err.statusCode = 400;
      err.code = "INVALID_FILE_FORMAT";
      return cb(err, false);
    }
    file.mimetype = normalizedMime;
    return cb(null, true);
  },
});

export const uploadGovernmentIdFiles = (req, res, next) => {
  const fields = idUpload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]);

  fields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "ID image file exceeds the allowable 10MB limit.",
            errors: [{ message: "File exceeds 10MB." }],
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: [],
        });
      }

      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: err.code || "INVALID_UPLOAD",
        message: err.message,
        errors: [],
      });
    }

    return next();
  });
};

const registrantIdUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 2, parts: 4 },
  fileFilter: (_req, file, cb) => {
    const rawMime = String(file.mimetype || "").trim().toLowerCase();
    const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
    if (!["image/jpeg", "image/png"].includes(normalizedMime)) {
      const error = new Error("Registrant ID images must be JPEG or PNG.");
      error.statusCode = 415;
      error.code = "REGISTRANT_ID_UNSUPPORTED_TYPE";
      return cb(error, false);
    }
    file.mimetype = normalizedMime;
    return cb(null, true);
  },
});

export const uploadRegistrantIdFiles = (req, res, next) => {
  registrantIdUpload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) {
      const tooLarge = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : (err.statusCode || 400)).json({
        success: false,
        code: tooLarge ? "REGISTRANT_ID_FILE_TOO_LARGE" : (err.code || "INVALID_MULTIPART_UPLOAD"),
        message: tooLarge ? "Registrant ID image exceeds the 5 MB limit." : "Invalid registrant ID multipart upload.",
        errors: [],
      });
    }
    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];
    if (!front && !back) {
      return res.status(400).json({ success: false, code: "REGISTRANT_ID_REQUIRED", message: "Upload a front or back registrant ID image.", errors: [] });
    }
    try {
      if (front) await FileValidator.validateRegistrantIdImage(front, "front");
      if (back) await FileValidator.validateRegistrantIdImage(back, "back");
      return next();
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({
        success: false,
        code: validationErr.code || "REGISTRANT_ID_INVALID_IMAGE",
        message: validationErr.message,
        errors: validationErr.field ? [{ field: validationErr.field, message: validationErr.message }] : [],
      });
    }
  });
};

const singleDocumentUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

export const uploadReturnDocumentFile = (req, res, next) => {
  singleDocumentUpload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            code: "RETURN_FILE_TOO_LARGE",
            message: "Return document exceeds the allowable 5MB limit.",
            errors: [{ field: "file", message: "File exceeds 5MB." }],
          });
        }
        return res.status(400).json({
          success: false,
          code: "INVALID_MULTIPART_UPLOAD",
          message: err.message,
          errors: [],
        });
      }
      return res.status(err.statusCode || 400).json({
        success: false,
        code: err.code || "INVALID_FILE_TYPE",
        message: err.message,
        errors: [],
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "RETURN_FILE_REQUIRED",
        message: "A defective document file is required.",
        errors: [{ field: "file", message: "File is required." }],
      });
    }

    try {
      FileValidator.validateReturnDocument(req.file, "file");
      return next();
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({
        success: false,
        code: validationErr.code || "RETURN_FILE_INVALID",
        message: validationErr.message,
        errors: validationErr.field ? [{ field: validationErr.field, message: validationErr.message }] : [],
      });
    }
  });
};

export const uploadCorrectedDocumentFile = (req, res, next) => {
  singleDocumentUpload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            code: "CORRECTED_FILE_TOO_LARGE",
            message: "Corrected document exceeds the allowable 5MB limit.",
            errors: [{ field: "file", message: "File exceeds 5MB." }],
          });
        }
        return res.status(400).json({
          success: false,
          code: "INVALID_MULTIPART_UPLOAD",
          message: err.message,
          errors: [],
        });
      }
      return res.status(err.statusCode || 400).json({
        success: false,
        code: err.code || "INVALID_FILE_TYPE",
        message: err.message,
        errors: [],
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "CORRECTED_FILE_REQUIRED",
        message: "A corrected document file is required.",
        errors: [{ field: "file", message: "File is required." }],
      });
    }

    try {
      FileValidator.validateCorrectedDocument(req.file, "file");
      return next();
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({
        success: false,
        code: validationErr.code || "CORRECTED_FILE_INVALID",
        message: validationErr.message,
        errors: validationErr.field ? [{ field: validationErr.field, message: validationErr.message }] : [],
      });
    }
  });
};
