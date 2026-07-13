import multer from "multer";
import path from "path";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

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

// Middleware for single payment receipt upload
export const uploadReceiptFile = (req, res, next) => {
  const uploadSingle = upload.single("receipt");
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

