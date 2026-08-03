import pino from "pino";
import { env } from "./env.js";

const isProduction = env.nodeEnv === "production";

// Built-in Pino redaction rules for sensitive keys across objects & requests
const redactPaths = [
  "password",
  "passwords",
  "newPassword",
  "currentPassword",
  "confirmPassword",
  "token",
  "tokens",
  "idToken",
  "refreshToken",
  "refresh_token",
  "authorization",
  "Authorization",
  "cookie",
  "cookies",
  "setupLink",
  "resetLink",
  "secret",
  "secretAccessKey",
  "privateKey",
  "FIREBASE_PRIVATE_KEY",
  "R2_SECRET_ACCESS_KEY",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.newPassword",
  "*.token",
  "*.idToken",
  "*.refreshToken",
  "*.authorization",
  "*.setupLink",
  "*.resetLink",
  "*.secret",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: isProduction
    ? {
        env: env.nodeEnv,
      }
    : undefined,
});

export default logger;
