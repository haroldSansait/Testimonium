import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import crypto from "crypto";

const isProduction = env.nodeEnv === "production";

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers["x-request-id"];
    if (existingId) return existingId;
    const id = crypto.randomUUID();
    res.setHeader("X-Request-ID", id);
    return id;
  },
  // In development, suppress dumping full req & res objects to keep console clean
  serializers: !isProduction
    ? {
        req: () => undefined,
        res: () => undefined,
      }
    : undefined,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    if (req.url === "/api/v1/health" || req.url === "/") return "debug";
    return "info";
  },
  customProps: (req, _res) => {
    if (!isProduction) {
      return {};
    }
    return {
      userId: req.user?.id || null,
      userRole: req.user?.role || null,
      clientIp: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    };
  },
  customSuccessMessage: (req, res, responseTime) => {
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;
    const duration = `${responseTime.toFixed(0)}ms`;
    const reqId = (req.id || "").slice(0, 8) || "unknown";
    const user = req.user?.id ? `user=${req.user.id}` : "user=anonymous";
    const role = req.user?.role ? `role=${req.user.role}` : "role=guest";
    const ip = `ip=${req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "::1"}`;

    if (!isProduction) {
      return `${method} ${path} | ${status} | ${duration} | ${user} | ${role} | ${ip} | req=${reqId}`;
    }

    return `HTTP ${method} ${path} ${status} - ${responseTime.toFixed(1)}ms`;
  },
  customErrorMessage: (req, res, err) => {
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;
    const reqId = (req.id || "").slice(0, 8) || "unknown";
    const user = req.user?.id ? `user=${req.user.id}` : "user=anonymous";
    const role = req.user?.role ? `role=${req.user.role}` : "role=guest";
    const ip = `ip=${req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "::1"}`;

    if (!isProduction) {
      return `${method} ${path} | ${status} | ${err?.message || "Error"} | ${user} | ${role} | ${ip} | req=${reqId}`;
    }

    return `HTTP ${method} ${path} ${status} - ${err?.message || "Request Error"}`;
  },
  autoLogging: {
    ignore: (_req) => false,
  },
});

export default httpLogger;
