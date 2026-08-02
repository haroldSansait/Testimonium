import rateLimit from "express-rate-limit";

// Rate limiter for payment receipt uploads.
// Restricts users to 5 uploads per 15 minutes per authenticated user.
// Keyed by user ID (fallback to IP for unauthenticated requests).
export const receiptUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user to 5 receipt uploads per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => String(req.user?.id || "unauthenticated"),
  skipSuccessfulRequests: false, // Count all successful requests
  skipFailedRequests: false, // Count all failed requests (quota usage check)
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many receipt uploads. Please wait 15 minutes before trying again.",
      errors: [
        {
          message: "Rate limit exceeded. Maximum 5 uploads per 15 minutes allowed.",
        },
      ],
    });
  },
});

// Rate limiter for map configurations batch save.
// Restricts users to 20 saves per 1 minute per authenticated user.
export const mapSaveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 saves per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || "unauthenticated"),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many map saves. Please wait 1 minute before trying again.",
      errors: [
        {
          message: "Rate limit exceeded. Maximum 20 saves per minute allowed.",
        },
      ],
    });
  },
});

// Rate limiter for parish image uploads.
// Restricts users to 5 uploads per 1 minute per authenticated user.
export const parishImageUploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each user to 5 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || "unauthenticated"),
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many image uploads. Please wait 1 minute before trying again.",
      errors: [
        {
          message: "Rate limit exceeded. Maximum 5 uploads per minute allowed.",
        },
      ],
    });
  },
});

