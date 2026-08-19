import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `TESTIMONIUM endpoint not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

export const errorHandler = (err, req, res, _next) => {
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Payload too large: File size exceeds the allowable 5MB limit.",
        errors: [{ message: "File exceeds 5MB limit." }],
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded. Maximum 5 files per request.",
        errors: [{ message: "Maximum 5 files allowed." }],
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: [],
    });
  }

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isProduction = env.nodeEnv === "production";

  if (statusCode >= 500) {
    logger.error(
      {
        err,
        statusCode,
        method: req.method,
        url: req.originalUrl || req.url,
        userId: req.user?.id || null,
        clientIp: req.ip || req.headers["x-forwarded-for"],
      },
      `[TESTIMONIUM] Internal server error: ${err.message}`
    );
  } else {
    logger.warn(
      {
        statusCode,
        method: req.method,
        url: req.originalUrl || req.url,
        message: err.message,
      },
      `[TESTIMONIUM] Request handling warning: ${err.message}`
    );
  }

  const responseBody = {
    success: false,
    message:
      statusCode >= 500 && isProduction
        ? "TESTIMONIUM encountered an internal server error."
        : err.message,
    errors: err.errors || [],
  };

  if (!isProduction && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

