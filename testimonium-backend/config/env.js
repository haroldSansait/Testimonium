import dotenv from "dotenv";

dotenv.config();

const requiredKeys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
];

const getDatabaseUrl = () =>
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: getDatabaseUrl(),
  corsOrigins: ["http://localhost:3000", "http://localhost:3001"],
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
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
