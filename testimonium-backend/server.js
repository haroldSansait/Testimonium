import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { prisma } from "./config/db.js";
import { env, getMissingRequiredConfig } from "./config/env.js";
import { logger } from "./config/logger.js";
import { httpLogger } from "./middlewares/httpLogger.js";
import {
  globalApiRateLimiter,
  adaptiveReadRateLimiter,
  adaptiveWriteRateLimiter,
} from "./middlewares/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

import activityLogRoutes from "./routes/activityLogRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import dioceseRoutes from "./routes/dioceseRoutes.js";
import documentRequestRoutes from "./routes/documentRequestRoutes.js";
import parishRoutes from "./routes/parishRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import parishionerRequestRoutes from "./routes/parishionerRequestRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import documentRequirementRoutes from "./routes/documentRequirementRoutes.js";
import parishAvailabilityRoutes from "./routes/parishAvailabilityRoutes.js";
import massScheduleRoutes from "./routes/massScheduleRoutes.js";
import parishEventRoutes from "./routes/parishEventRoutes.js";

const app = express();
app.set("etag", false);

// Disable client caching for dynamic API endpoints to prevent 304 stale data
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const apiVersion = "/api/v1";

if (env.trustProxy !== false) {
  app.set("trust proxy", env.trustProxy);
}

const missingConfig = getMissingRequiredConfig();
if (missingConfig.length > 0) {
  logger.warn(
    `[TESTIMONIUM] Missing environment configuration keys: ${missingConfig.join(", ")}`
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by TESTIMONIUM CORS."));
  },
  credentials: true,
};

app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

app.get("/", (_req, res) => {
  res.json({
    name: "TESTIMONIUM Backend API",
    status: "online",
    version: "v1",
  });
});

// Apply Layer 1 Global & Layer 3 Adaptive Rate Limiters across API routes
app.use(apiVersion, globalApiRateLimiter);
app.use(apiVersion, adaptiveReadRateLimiter);
app.use(apiVersion, adaptiveWriteRateLimiter);

// API Routes
app.use(`${apiVersion}/health`, healthRoutes);
app.use(`${apiVersion}/auth`, authRoutes);
app.use(`${apiVersion}/dashboard`, dashboardRoutes);
app.use(`${apiVersion}/document-requests`, documentRequestRoutes);
app.use(`${apiVersion}/document-requirements`, documentRequirementRoutes);
app.use(`${apiVersion}/parish-availabilities`, parishAvailabilityRoutes);
app.use(`${apiVersion}/requests`, parishionerRequestRoutes);
app.use(`${apiVersion}/payment`, paymentRoutes);
app.use(`${apiVersion}/parishes`, parishRoutes);
app.use(`${apiVersion}/users`, userRoutes);
app.use(`${apiVersion}/schedule-requests`, scheduleRoutes);
app.use(`${apiVersion}/notifications`, notificationRoutes);
app.use(`${apiVersion}/calendar`, calendarRoutes);
app.use(`${apiVersion}/activity-log`, activityLogRoutes);
app.use(`${apiVersion}/diocese`, dioceseRoutes);
app.use(`${apiVersion}/analytics`, analyticsRoutes);
app.use(`${apiVersion}/mass-schedules`, massScheduleRoutes);
app.use(`${apiVersion}/parish-events`, parishEventRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const validateParishesOnStartup = async () => {
  if (process.env.NODE_ENV === "production" || env.nodeEnv === "production") {
    return;
  }
  try {
    const mdPath = path.join(process.cwd(), "address_parishes.md");
    if (!fs.existsSync(mdPath)) {
      logger.warn(`[Startup Validation] address_parishes.md not found at ${mdPath}`);
      return;
    }
    const content = fs.readFileSync(mdPath, "utf-8");
    const expectedNames = [...content.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());

    if (expectedNames.length === 0) {
      logger.warn("[Startup Validation] Could not parse any parish names from address_parishes.md");
      return;
    }

    const dbParishes = await prisma.parish.findMany();

    if (dbParishes.length !== expectedNames.length) {
      logger.warn(
        `[Startup Validation] WARNING: Database contains ${dbParishes.length} parishes, but address_parishes.md specifies ${expectedNames.length}!`
      );
    }

    for (const expectedName of expectedNames) {
      const dbParish = dbParishes.find((p) => p.parishName === expectedName);
      if (!dbParish) {
        logger.warn(
          `[Startup Validation] WARNING: Parish from canonical dataset not found in database: "${expectedName}"`
        );
        continue;
      }

      if (
        dbParish.latitude === null ||
        dbParish.latitude === undefined ||
        dbParish.longitude === null ||
        dbParish.longitude === undefined
      ) {
        logger.warn(`[Startup Validation] Missing coordinates for: ${dbParish.parishName}`);
      } else {
        if (
          dbParish.latitude < -90 ||
          dbParish.latitude > 90 ||
          dbParish.longitude < -180 ||
          dbParish.longitude > 180
        ) {
          logger.warn(`[Startup Validation] Invalid coordinate range for: ${dbParish.parishName}`);
        } else if (dbParish.latitude === 0 && dbParish.longitude === 0) {
          logger.warn(
            `[Startup Validation] WARNING: Coordinates are set to (0,0) (potential stub value) for: ${dbParish.parishName}`
          );
        }
      }

      if (!dbParish.feastDay) {
        logger.warn(`[Startup Validation] Missing feast day for: ${dbParish.parishName}`);
      }

      if (!dbParish.coverImage) {
        logger.warn(`[Startup Validation] WARNING: Missing cover image for: ${dbParish.parishName}`);
      }
    }
  } catch (err) {
    logger.error({ err }, "[Startup Validation] Error during startup validation");
  }
};

const logRateLimitSummary = () => {
  logger.info(
    {
      global: `${env.rateLimits.globalMax} / 15m`,
      authRead: `${env.rateLimits.authReadMax} / 15m`,
      authWrite: `${env.rateLimits.authWriteMax} / 15m`,
      anonRead: `${env.rateLimits.anonReadMax} / 15m`,
      anonWrite: `${env.rateLimits.anonWriteMax} / 15m`,
      login: `${env.rateLimits.authLoginMax} / 15m`,
      passwordReset: `${env.rateLimits.passwordResetMax} / 1h`,
      userCreation: `${env.rateLimits.userCreationMax} / 1h`,
      ocr: `${env.rateLimits.ocrMax} / 10m`,
      receiptUpload: `${env.rateLimits.receiptUploadMax} / 15m`,
      imageUpload: `${env.rateLimits.imageUploadMax} / 1m`,
      mapSave: `${env.rateLimits.mapSaveMax} / 1m`,
      storeBackend: `${env.rateLimits.storeType}Store (${env.nodeEnv})`,
    },
    "[RateLimit] Effective rate limiting configuration active"
  );
};

export const logAuthenticationPolicy = () => {
  const isProd = env.nodeEnv === "production";
  const staffVerificationState = (!isProd && !env.adminEmailVerificationRequired) ? "DISABLED" : "REQUIRED";

  if (isProd && process.env.ADMIN_EMAIL_VERIFICATION_REQUIRED === "false") {
    logger.warn(
      "[SECURITY WARNING] ADMIN_EMAIL_VERIFICATION_REQUIRED=false configured in PRODUCTION environment! Email verification bypass is disabled for production safety."
    );
  }

  const envDisplay = env.nodeEnv.toUpperCase();

  console.log("====================================");
  console.log("Authentication Policy");
  console.log("------------------------------------");
  console.log(`Environment: ${envDisplay}`);
  console.log("Parishioner Verification : REQUIRED");
  console.log(`Staff Verification       : ${staffVerificationState}`);
  console.log("Provider Override        : Google Always Verified");
  console.log("====================================");

  logger.info(
    {
      environment: envDisplay,
      parishionerVerification: "REQUIRED",
      staffVerification: staffVerificationState,
      providerOverride: "Google Always Verified",
    },
    "[AuthPolicy] Effective authentication verification policy active"
  );
};

const server = app.listen(env.port, () => {
  logger.info(`[TESTIMONIUM] API server listening on port ${env.port} (${env.nodeEnv})`);
  logAuthenticationPolicy();
  logRateLimitSummary();
  validateParishesOnStartup();
});

// Graceful Shutdown Management
let isShuttingDown = false;

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[TESTIMONIUM] Shutdown signal received (${signal}). Gracefully stopping server...`);

  server.close(async () => {
    logger.info("[TESTIMONIUM] HTTP server closed.");
    try {
      await prisma.$disconnect();
      logger.info("[TESTIMONIUM] Prisma DB connection closed.");
    } catch (err) {
      logger.error({ err }, "[TESTIMONIUM] Error closing Prisma DB connection.");
    } finally {
      if (typeof logger.flush === "function") {
        logger.flush();
      }
      process.exit(exitCode);
    }
  });

  setTimeout(() => {
    logger.error("[TESTIMONIUM] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "[TESTIMONIUM] Fatal Uncaught Exception encountered.");
  gracefulShutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "[TESTIMONIUM] Unhandled Promise Rejection encountered.");
  gracefulShutdown("unhandledRejection", 1);
});

export default app;
