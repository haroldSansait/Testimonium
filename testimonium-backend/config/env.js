import dotenv from "dotenv";

dotenv.config();

const requiredKeys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

const parsePositiveInt = (value, defaultValue, name) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[Config] Invalid ${name} value "${value}". Falling back to production default (${defaultValue}).`);
    return defaultValue;
  }
  return parsed;
};

const getDatabaseUrl = () =>
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

const parsePrivateKey = (key) => {
  if (!key) return undefined;
  let clean = key.trim();
  while (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  return clean.replace(/\\n/g, "\n");
};

const parseTrustProxy = () => {
  const val = process.env.TRUST_PROXY;
  if (!val) return process.env.NODE_ENV === "production" ? 1 : false;
  if (val === "true") return true;
  if (val === "false") return false;
  const num = Number(val);
  return isNaN(num) ? val : num;
};

const parseCorsOrigins = () => {
  const defaults = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://localhost:5174"];
  if (!process.env.CORS_ORIGINS) return defaults;
  const custom = process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...defaults, ...custom]));
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  enableDevAuth: process.env.ENABLE_DEV_AUTH === "true",
  port: Number(process.env.PORT ?? 5000),
  trustProxy: parseTrustProxy(),
  databaseUrl: getDatabaseUrl(),
  corsOrigins: parseCorsOrigins(),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  ocr: {
    enabled: process.env.OCR_ENABLED !== "false",
    provider: process.env.OCR_PROVIDER ?? "stub",
    spaceApiKey: process.env.OCR_SPACE_API_KEY,
    spaceEngine: process.env.OCR_SPACE_ENGINE ?? "2",
    timeout: Number(process.env.OCR_TIMEOUT ?? 10000),
    maxSizeKb: Number(process.env.OCR_MAX_SIZE_KB ?? 900),
    compressionWidth: Number(process.env.OCR_COMPRESSION_WIDTH ?? 1200),
    compressionQuality: Number(process.env.OCR_COMPRESSION_QUALITY ?? 80),
    maxRetries: Number(process.env.OCR_MAX_RETRIES ?? 2),
    retryBaseDelayMs: Number(process.env.OCR_RETRY_BASE_DELAY_MS ?? 1000),
    cacheTtlMs: Number(process.env.OCR_CACHE_TTL_MS ?? 1800000),
    cacheMaxEntries: Number(process.env.OCR_CACHE_MAX_ENTRIES ?? 200),
  },
  rateLimits: {
    storeType: process.env.RATE_LIMIT_STORE ?? "memory",
    globalMax: parsePositiveInt(process.env.GLOBAL_RATE_LIMIT_MAX, 5000, "GLOBAL_RATE_LIMIT_MAX"),
    authReadMax: parsePositiveInt(process.env.AUTH_READ_RATE_LIMIT_MAX, 2500, "AUTH_READ_RATE_LIMIT_MAX"),
    authWriteMax: parsePositiveInt(process.env.AUTH_WRITE_RATE_LIMIT_MAX, 500, "AUTH_WRITE_RATE_LIMIT_MAX"),
    anonReadMax: parsePositiveInt(process.env.ANON_READ_RATE_LIMIT_MAX, 800, "ANON_READ_RATE_LIMIT_MAX"),
    anonWriteMax: parsePositiveInt(process.env.ANON_WRITE_RATE_LIMIT_MAX, 100, "ANON_WRITE_RATE_LIMIT_MAX"),
    authLoginMax: parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10, "AUTH_LOGIN_RATE_LIMIT_MAX"),
    passwordResetMax: parsePositiveInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, 3, "PASSWORD_RESET_RATE_LIMIT_MAX"),
    userCreationMax: parsePositiveInt(process.env.USER_CREATION_RATE_LIMIT_MAX, 5, "USER_CREATION_RATE_LIMIT_MAX"),
    ocrMax: parsePositiveInt(process.env.OCR_RATE_LIMIT_MAX, 10, "OCR_RATE_LIMIT_MAX"),
    receiptUploadMax: parsePositiveInt(process.env.RECEIPT_UPLOAD_RATE_LIMIT_MAX, 5, "RECEIPT_UPLOAD_RATE_LIMIT_MAX"),
    imageUploadMax: parsePositiveInt(process.env.PARISH_IMAGE_UPLOAD_RATE_LIMIT_MAX ?? process.env.IMAGE_UPLOAD_RATE_LIMIT_MAX, 5, "PARISH_IMAGE_UPLOAD_RATE_LIMIT_MAX"),
    mapSaveMax: parsePositiveInt(process.env.MAP_SAVE_RATE_LIMIT_MAX, 20, "MAP_SAVE_RATE_LIMIT_MAX"),
  },
};

export const getMissingRequiredConfig = () => {
  const missing = [];

  if (!env.databaseUrl) {
    missing.push("SUPABASE_DATABASE_URL or DATABASE_URL");
  }

  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return missing;
};

export const getMissingFirebaseConfig = () => {
  const firebaseKeys = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  return firebaseKeys.filter((key) => !process.env[key]);
};
