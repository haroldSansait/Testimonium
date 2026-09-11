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

const parseBoolean = (value, defaultValue, name) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const clean = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(clean)) {
    return true;
  }
  if (["false", "0", "no"].includes(clean)) {
    return false;
  }
  console.warn(`[Config] Invalid ${name} value "${value}". Falling back to production default (${defaultValue}).`);
  return defaultValue;
};

export const parseConfidence = (value, defaultValue = 0.75, name = "PAYMENT_PROOF_MIN_CONFIDENCE") => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  let parsed = Number(value);
  if (isNaN(parsed)) {
    console.warn(`[Config] Invalid ${name} value "${value}". Falling back to default (${defaultValue}).`);
    return defaultValue;
  }
  if (parsed > 1 && parsed <= 100) {
    parsed = parsed / 100;
  }
  if (parsed < 0 || parsed > 1) {
    console.warn(`[Config] Out-of-bounds ${name} value "${value}". Must be between 0.0 and 1.0 (or 0-100). Falling back to default (${defaultValue}).`);
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
  adminEmailVerificationRequired: parseBoolean(
    process.env.ADMIN_EMAIL_VERIFICATION_REQUIRED,
    true,
    "ADMIN_EMAIL_VERIFICATION_REQUIRED"
  ),
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
    minConfidence: parseConfidence(process.env.PAYMENT_PROOF_MIN_CONFIDENCE, 0.75),
  },
  payment: {
    minConfidence: parseConfidence(process.env.PAYMENT_PROOF_MIN_CONFIDENCE, 0.75),
  },
  smtp: {
    enabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM_EMAIL),
    host: process.env.SMTP_HOST,
    port: parsePositiveInt(process.env.SMTP_PORT, 587, "SMTP_PORT"),
    secure: parseBoolean(process.env.SMTP_SECURE, false, "SMTP_SECURE"),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    fromName: process.env.SMTP_FROM_NAME || "TESTIMONIUM",
    fromEmail: process.env.SMTP_FROM_EMAIL,
    connectionTimeoutMs: parsePositiveInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000, "SMTP_CONNECTION_TIMEOUT_MS"),
    greetingTimeoutMs: parsePositiveInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10000, "SMTP_GREETING_TIMEOUT_MS"),
    socketTimeoutMs: parsePositiveInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000, "SMTP_SOCKET_TIMEOUT_MS"),
    workerPollMs: parsePositiveInt(process.env.EMAIL_WORKER_POLL_MS, 10000, "EMAIL_WORKER_POLL_MS"),
    workerBatchSize: parsePositiveInt(process.env.EMAIL_WORKER_BATCH_SIZE, 10, "EMAIL_WORKER_BATCH_SIZE"),
    workerLeaseSeconds: parsePositiveInt(process.env.EMAIL_WORKER_LEASE_SECONDS, 120, "EMAIL_WORKER_LEASE_SECONDS"),
    maxAttempts: parsePositiveInt(process.env.EMAIL_MAX_ATTEMPTS, 5, "EMAIL_MAX_ATTEMPTS"),
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
  chatbot: {
    enabled: parseBoolean(process.env.CHATBOT_ENABLED, false, "CHATBOT_ENABLED"),
    logRawText: parseBoolean(process.env.CHATBOT_LOG_RAW_TEXT, false, "CHATBOT_LOG_RAW_TEXT"),
    generationProvider: (process.env.AI_GENERATION_PROVIDER || "gemini").toLowerCase().trim(),
    generationModel: (process.env.AI_GENERATION_MODEL || "gemini-3.8-flash").trim(),
    embeddingProvider: (process.env.AI_EMBEDDING_PROVIDER || "gemini").toLowerCase().trim(),
    embeddingModel: (process.env.AI_EMBEDDING_MODEL || "gemini-embedding-2").trim(),
    embeddingDimensions: parsePositiveInt(process.env.AI_EMBEDDING_DIMENSIONS, 768, "AI_EMBEDDING_DIMENSIONS"),
    geminiApiKey: (process.env.GEMINI_API_KEY || "").trim(),
    generationTimeoutMs: parsePositiveInt(process.env.CHATBOT_GENERATION_TIMEOUT_MS, 45000, "CHATBOT_GENERATION_TIMEOUT_MS"),
    embeddingTimeoutMs: parsePositiveInt(process.env.CHATBOT_EMBEDDING_TIMEOUT_MS, 15000, "CHATBOT_EMBEDDING_TIMEOUT_MS"),
    maxRetries: parsePositiveInt(process.env.CHATBOT_MAX_RETRIES, 2, "CHATBOT_MAX_RETRIES"),
    topK: parsePositiveInt(process.env.CHATBOT_TOP_K, 8, "CHATBOT_TOP_K"),
    maxContextChunks: parsePositiveInt(process.env.CHATBOT_MAX_CONTEXT_CHUNKS, 4, "CHATBOT_MAX_CONTEXT_CHUNKS"),
    maxContextTokens: parsePositiveInt(process.env.CHATBOT_MAX_CONTEXT_TOKENS, 3500, "CHATBOT_MAX_CONTEXT_TOKENS"),
    maxOutputTokens: parsePositiveInt(process.env.CHATBOT_MAX_OUTPUT_TOKENS, 1200, "CHATBOT_MAX_OUTPUT_TOKENS"),
    minSimilarity: parseConfidence(process.env.CHATBOT_MIN_SIMILARITY, 0.65, "CHATBOT_MIN_SIMILARITY"),
    rateLimits: {
      rateLimitMax: parsePositiveInt(process.env.CHATBOT_RATE_LIMIT_MAX, 10, "CHATBOT_RATE_LIMIT_MAX"),
      dailyLimitMax: parsePositiveInt(process.env.CHATBOT_DAILY_LIMIT_MAX, 50, "CHATBOT_DAILY_LIMIT_MAX"),
      windowMs: parsePositiveInt(process.env.CHATBOT_RATE_LIMIT_WINDOW_MS, 600000, "CHATBOT_RATE_LIMIT_WINDOW_MS"),
    },
    worker: {
      pollMs: parsePositiveInt(process.env.CHATBOT_WORKER_POLL_MS, 15000, "CHATBOT_WORKER_POLL_MS"),
      batchSize: parsePositiveInt(process.env.CHATBOT_WORKER_BATCH_SIZE, 5, "CHATBOT_WORKER_BATCH_SIZE"),
      leaseSeconds: parsePositiveInt(process.env.CHATBOT_WORKER_LEASE_SECONDS, 60, "CHATBOT_WORKER_LEASE_SECONDS"),
    },
  },
};

if (env.chatbot.embeddingDimensions !== 768) {
  console.warn(
    `[Config] Invalid AI_EMBEDDING_DIMENSIONS "${env.chatbot.embeddingDimensions}". Expected 768 for gemini-embedding-2. Resetting to 768.`
  );
  env.chatbot.embeddingDimensions = 768;
}

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

  if (env.chatbot?.enabled) {
    const usesGemini =
      env.chatbot.generationProvider === "gemini" ||
      env.chatbot.embeddingProvider === "gemini";
    if (usesGemini && !env.chatbot.geminiApiKey) {
      missing.push("GEMINI_API_KEY");
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
