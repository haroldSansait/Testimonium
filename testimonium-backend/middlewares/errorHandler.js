export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `TESTIMONIUM endpoint not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

export const errorHandler = (err, _req, res, _next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;

  if (statusCode >= 500) {
    console.error("[TESTIMONIUM] Unexpected server error:", err.message);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "TESTIMONIUM encountered an internal server error."
        : err.message,
    errors: err.errors || [],
  });
};
