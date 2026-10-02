import rateLimit from "express-rate-limit";
import { logger } from "../config/logger.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { env } from "../config/env.js";
import { createRateLimitStore } from "../config/rateLimitStore.js";

// Deduplication map to prevent log spamming on repeated blocked requests within a 30s window
const recentViolationLogs = new Map();

function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Smart Rate Limit Key Generator.
 * Authenticated: Prefer req.user.id -> req.firebaseUser.uid -> IP.
 * Anonymous: IP only.
 * Login: Strictly IP-based regardless of auth state.
 */
function getRateLimitKey(req, prefix = "rl:", forceIpOnly = false) {
  const clientIp = getClientIp(req);

  if (forceIpOnly) {
    return `${prefix}:ip:${clientIp}`;
  }

  if (req.user?.id) {
    return `${prefix}:user:${req.user.id}`;
  }

  if (req.firebaseUser?.uid) {
    return `${prefix}:uid:${req.firebaseUser.uid}`;
  }

  return `${prefix}:ip:${clientIp}`;
}

/**
 * Route-prefix skip helper for health checks, static files, and metadata.
 */
function skipStaticAndHealth(req) {
  const path = req.originalUrl || req.url || "";
  const prefixes = [
    "/health",
    "/api/v1/health",
    "/favicon.ico",
    "/static/",
    "/assets/",
    "/public/",
    "/robots.txt",
    "/sitemap.xml",
  ];
  return prefixes.some((p) => path.startsWith(p));
}

/**
 * Standardized rate limit error response handler & structured logger.
 */
function handleRateLimitExceeded(req, res, limiterName, customMessage) {
  const clientIp = getClientIp(req);
  const endpoint = req.originalUrl || req.url;
  const requestId = req.id || req.headers["x-request-id"] || null;
  const userAgent = req.headers["user-agent"] || null;
  const userId = req.user?.id || req.firebaseUser?.uid || "anonymous";
  const role = req.user?.role || "guest";

  const resetTime = req.rateLimit?.resetTime;
  const retryAfter = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : 900;

  res.setHeader("Retry-After", String(retryAfter));

  // Log deduplication (log max once per 30s per user/ip/limiter key)
  const logKey = `${limiterName}:${userId}:${clientIp}`;
  const now = Date.now();
  const lastLogTime = recentViolationLogs.get(logKey) || 0;

  if (now - lastLogTime > 30000) {
    recentViolationLogs.set(logKey, now);

    logger.warn(
      {
        limiter: limiterName,
        requestId,
        userId,
        role,
        clientIp,
        userAgent,
        endpoint,
        retryAfter,
        remaining: 0,
      },
      `[RateLimit] ${limiterName} quota exceeded for ${userId} (${clientIp})`
    );

    // Audit log entry for security sensitive limiters
    if (limiterName.includes("Login") || limiterName.includes("Password") || limiterName.includes("UserCreation")) {
      AuditLogService.log(null, "AUTH_RATE_LIMIT_EXCEEDED", null, true, {
        ipAddress: String(clientIp),
        userAgent,
        metadata: { limiter: limiterName, endpoint, requestId },
      }).catch((err) => {
        logger.error({ err }, "[RateLimit] Failed to log audit entry for rate limit violation");
      });
    }
  }

  return res.status(429).json({
    success: false,
    message: customMessage || "Rate limit exceeded. Please wait before retrying.",
    errors: [
      {
        message: customMessage || "Rate limit exceeded. Too many requests.",
      },
    ],
    retryAfter,
  });
}

// ── LAYER 1: Infrastructure Protection (Global Fallback) ────────────────────
export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.rateLimits.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l1:global:"),
  keyGenerator: (req) => getRateLimitKey(req, "l1:global:", true), // IP only for infrastructure protection
  skip: (req) => skipStaticAndHealth(req) || req.method === "OPTIONS",
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "globalApiRateLimiter",
      "Global infrastructure rate limit exceeded. Please wait 15 minutes."
    ),
});

// ── LAYER 2: Endpoint-Specific Protection ────────────────────────────────────

// 2.1 Login Rate Limiter (POST /auth/login) — Strictly IP-based
export const authLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.rateLimits.authLoginMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:login:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:login:", true), // Strictly IP-based
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "authLoginRateLimiter",
      "Too many login attempts. Please wait 15 minutes before trying again."
    ),
});

// 2.2 Password Reset Limiter — Strictly IP-based
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.rateLimits.passwordResetMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:pwreset:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:pwreset:", true),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "passwordResetRateLimiter",
      "Too many password reset requests. Please wait an hour before trying again."
    ),
});

// 2.3 User Creation Limiter — Strictly IP-based
export const userCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.rateLimits.userCreationMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:usercreate:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:usercreate:", true),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "userCreationRateLimiter",
      "Too many account creation requests. Please wait an hour before trying again."
    ),
});

// 2.3.1 Resend Verification Limiter — Strictly IP-based (3/hour/IP)
export const resendVerificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:resendverif:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:resendverif:", true),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "resendVerificationRateLimiter",
      "Too many verification email resend requests. Maximum 3 requests per hour allowed."
    ),
});

// 2.4 OCR Processing Limiter
export const ocrRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: env.rateLimits.ocrMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:ocr:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:ocr:"),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "ocrRateLimiter",
      "Too many OCR verification requests. Maximum 10 requests per 10 minutes allowed."
    ),
});

// 2.5 Receipt Upload Limiter
export const receiptUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.rateLimits.receiptUploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:receipt:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:receipt:"),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "receiptUploadRateLimiter",
      "Too many receipt uploads. Maximum 5 uploads per 15 minutes allowed."
    ),
});

// 2.6 Parish Image Upload Limiter
export const parishImageUploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.rateLimits.imageUploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:image:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:image:"),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "parishImageUploadRateLimiter",
      "Too many image uploads. Maximum 5 uploads per minute allowed."
    ),
});

// 2.7 Map Save Limiter
export const mapSaveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.rateLimits.mapSaveMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l2:mapsave:"),
  keyGenerator: (req) => getRateLimitKey(req, "l2:mapsave:"),
  handler: (req, res) =>
    handleRateLimitExceeded(
      req,
      res,
      "mapSaveRateLimiter",
      "Too many map saves. Maximum 20 saves per minute allowed."
    ),
});

// ── LAYER 3: Adaptive Application Traffic (Read vs Write, Auth vs Anon) ────

// 3.1 Adaptive READ Limiter (GET / HEAD)
// Authenticated: 2,500 / 15m | Anonymous: 800 / 15m (Dev: 100,000)
export const adaptiveReadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    const isAuthenticated = Boolean(req.user?.id || req.firebaseUser?.uid);
    return isAuthenticated ? env.rateLimits.authReadMax : env.rateLimits.anonReadMax;
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l3:read:"),
  keyGenerator: (req) => getRateLimitKey(req, "l3:read:"),
  skip: (req) =>
    skipStaticAndHealth(req) ||
    req.method === "OPTIONS" ||
    (req.method !== "GET" && req.method !== "HEAD"),
  handler: (req, res) => {
    const isAuthenticated = Boolean(req.user?.id || req.firebaseUser?.uid);
    const limit = isAuthenticated ? env.rateLimits.authReadMax : env.rateLimits.anonReadMax;
    return handleRateLimitExceeded(
      req,
      res,
      "adaptiveReadRateLimiter",
      `Too many read requests. Maximum ${limit} requests per 15 minutes allowed.`
    );
  },
});

// 3.2 Adaptive WRITE Limiter (POST / PUT / PATCH / DELETE)
// Authenticated: 500 / 15m | Anonymous: 100 / 15m (Dev: 100,000)
export const adaptiveWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    const isAuthenticated = Boolean(req.user?.id || req.firebaseUser?.uid);
    return isAuthenticated ? env.rateLimits.authWriteMax : env.rateLimits.anonWriteMax;
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("l3:write:"),
  keyGenerator: (req) => getRateLimitKey(req, "l3:write:"),
  skip: (req) =>
    skipStaticAndHealth(req) ||
    req.method === "OPTIONS" ||
    req.method === "GET" ||
    req.method === "HEAD",
  handler: (req, res) => {
    const isAuthenticated = Boolean(req.user?.id || req.firebaseUser?.uid);
    const limit = isAuthenticated ? env.rateLimits.authWriteMax : env.rateLimits.anonWriteMax;
    return handleRateLimitExceeded(
      req,
      res,
      "adaptiveWriteRateLimiter",
      `Too many modification requests. Maximum ${limit} write operations per 15 minutes allowed.`
    );
  },
});

// 4.1 Chat General Abuse Limiter (prevents DoS/spam for all queries; default: 60 / 10m)
export const chatGeneralAbuseLimiter = rateLimit({
  windowMs: env.chatbot?.rateLimits?.generalWindowMs || 10 * 60 * 1000,
  max: env.chatbot?.rateLimits?.generalAbuseMax || 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:chatbot:abuse:"),
  keyGenerator: (req) => getRateLimitKey(req, "rl:chatbot:abuse:"),
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 600;
    res.setHeader("Retry-After", String(retryAfter));

    return res.status(429).json({
      success: false,
      code: "CHATBOT_RATE_LIMITED",
      message: "You're sending messages too quickly. Please wait a moment.",
      errors: [
        {
          code: "CHATBOT_RATE_LIMITED",
          message: "You're sending messages too quickly. Please wait a moment.",
          retryAfter,
        },
      ],
    });
  },
});

// Backward-compatible exports
export const chatbotUserTenMinuteLimiter = chatGeneralAbuseLimiter;
export const chatbotUserDailyLimiter = (req, res, next) => next();

// 5.1 Government ID Verification Limiter (~3 attempts per 10 minutes per authenticated user)
export const governmentIdRateLimiter = rateLimit({
  windowMs: env.identity?.rateLimitWindowMs || 10 * 60 * 1000,
  max: env.identity?.rateLimitMax || 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:id_verify:"),
  keyGenerator: (req) => getRateLimitKey(req, "rl:id_verify:"),
  handler: (req, res) => {
    return handleRateLimitExceeded(
      req,
      res,
      "governmentIdRateLimiter",
      "Too many Government ID verification attempts. Maximum 3 attempts per 10 minutes allowed."
    );
  },
});
