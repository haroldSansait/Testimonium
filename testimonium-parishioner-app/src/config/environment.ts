const required = (key: "EXPO_PUBLIC_API_BASE_URL"): string => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error("Missing required mobile configuration: EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env.");
  return value;
};

export const getApiBaseUrl = (): string => {
  const normalized = required("EXPO_PUBLIC_API_BASE_URL").replace(/\/+$/, "");
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
};