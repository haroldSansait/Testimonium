import { AppError } from "@/services/api/errors";

const requiredApiBaseUrl = (): string => {
  // Expo only inlines EXPO_PUBLIC_* values when referenced with static dot notation.
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw new AppError({
      kind: "CONFIGURATION",
      code: "MISSING_API_BASE_URL",
      message:
        "The mobile API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL and restart Metro.",
    });
  }
  return value;
};

export const getApiBaseUrl = (): string => {
  const normalized = requiredApiBaseUrl().replace(/\/+$/, "");
  if (
    process.env.EXPO_PUBLIC_ENV === "production" &&
    normalized !== "https://testimonium-e9s5.onrender.com/api/v1"
  ) {
    throw new AppError({
      kind: "CONFIGURATION",
      code: "INVALID_PRODUCTION_API_BASE_URL",
      message: "The production API URL is invalid. Install a correctly configured release.",
    });
  }
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new AppError({
      kind: "CONFIGURATION",
      code: "INVALID_API_BASE_URL",
      message: "EXPO_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL.",
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError({
      kind: "CONFIGURATION",
      code: "INVALID_API_BASE_URL_PROTOCOL",
      message: "EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS.",
    });
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    throw new AppError({
      kind: "CONFIGURATION",
      code: "LOOPBACK_API_BASE_URL",
      message:
        "The configured API URL points to this phone. Use a phone-reachable HTTPS development endpoint and restart Metro.",
    });
  }

  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
};

export const isGoogleSignInEnabled = (): boolean => {
  const flag = process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED?.trim().toLowerCase();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  return flag === "true" && Boolean(webClientId);
};

export const getGoogleWebClientId = (): string | undefined => {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;
};
