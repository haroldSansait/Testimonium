import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, getMissingRequiredConfig } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import documentRequestRoutes from "./routes/documentRequestRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";

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
app.use(`${apiVersion}/schedule-requests`, scheduleRoutes);
app.use(`${apiVersion}/notifications`, notificationRoutes);
app.use(`${apiVersion}/calendar`, calendarRoutes);
app.use(`${apiVersion}/activity-log`, activityLogRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[TESTIMONIUM] API server listening on port ${env.port}`);
});

export default app;
