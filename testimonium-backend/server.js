import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { prisma } from "./config/db.js";
import { env, getMissingRequiredConfig } from "./config/env.js";
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
const apiVersion = "/api/v1";

const missingConfig = getMissingRequiredConfig();
if (missingConfig.length > 0) {
  console.warn(
    `[TESTIMONIUM] Missing configuration keys: ${missingConfig.join(", ")}`,
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

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.json({
    name: "TESTIMONIUM Backend API",
    status: "online",
    version: "v1",
  });
});

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
      console.warn(`[Startup Validation] address_parishes.md not found at ${mdPath}`);
      return;
    }
    const content = fs.readFileSync(mdPath, "utf-8");
    const expectedNames = [...content.matchAll(/^\d+\.\s+(.+)$/gm)].map(m => m[1].trim());

    if (expectedNames.length === 0) {
      console.warn("[Startup Validation] Could not parse any parish names from address_parishes.md");
      return;
    }

    const dbParishes = await prisma.parish.findMany();

    if (dbParishes.length !== expectedNames.length) {
      console.warn(`[Startup Validation] WARNING: Database contains ${dbParishes.length} parishes, but address_parishes.md specifies ${expectedNames.length}!`);
    }

    for (const expectedName of expectedNames) {
      const dbParish = dbParishes.find(p => p.parishName === expectedName);
      if (!dbParish) {
        console.warn(`[Startup Validation] WARNING: Parish from canonical dataset not found in database: "${expectedName}"`);
        continue;
      }

      if (dbParish.latitude === null || dbParish.latitude === undefined || dbParish.longitude === null || dbParish.longitude === undefined) {
        console.warn(`[Startup Validation] Missing coordinates:\n${dbParish.parishName}`);
      } else {
        if (dbParish.latitude < -90 || dbParish.latitude > 90 || dbParish.longitude < -180 || dbParish.longitude > 180) {
          console.warn(`[Startup Validation] Invalid coordinate range:\n${dbParish.parishName}`);
        } else if (dbParish.latitude === 0 && dbParish.longitude === 0) {
          console.warn(`[Startup Validation] WARNING: Coordinates are set to (0,0) (potential stub value):\n${dbParish.parishName}`);
        }
      }

      if (!dbParish.feastDay) {
        console.warn(`[Startup Validation] Missing feast day:\n${dbParish.parishName}`);
      }

      if (!dbParish.coverImage) {
        console.warn(`[Startup Validation] WARNING: Missing cover image:\n${dbParish.parishName}`);
      }
    }
  } catch (err) {
    console.error("[Startup Validation] Error during startup validation:", err);
  }
};

app.listen(env.port, () => {
  console.log(`[TESTIMONIUM] API server listening on port ${env.port}`);
  validateParishesOnStartup();
});

export default app;
// Force nodemon reload to reload fresh prisma client again after killing background port conflict


