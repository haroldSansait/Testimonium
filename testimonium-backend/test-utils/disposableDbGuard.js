import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DISPOSABLE_ENV_VAR = "DISPOSABLE_DATABASE_URL";

const FORBIDDEN_HOST_PATTERNS = [
  "supabase.co",
  "supabase.com",
  "pooler.supabase.com",
  "aws.com",
  "rds.amazonaws.com",
  "neon.tech",
  "elephantsql.com",
];

/**
 * Validates that the provided URL is a dedicated, disposable test database.
 * Fails closed with a loud error if invalid, shared, or missing.
 *
 * @param {string} [urlInput]
 * @returns {string} Validated disposable DB URL
 */
export function validateDisposableDatabaseUrl(urlInput = process.env[DISPOSABLE_ENV_VAR]) {
  if (!urlInput || typeof urlInput !== "string" || !urlInput.trim()) {
    throw new Error(
      "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
      `Environment variable ${DISPOSABLE_ENV_VAR} is missing or empty.`
    );
  }

  const cleanUrl = urlInput.trim();

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch (err) {
    throw new Error(
      "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
      `Malformed database URL: ${err.message}`
    );
  }

  // Check against known shared/cloud database hosts
  const host = parsed.hostname.toLowerCase();
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (host.includes(pattern)) {
      throw new Error(
        "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
        `Host "${host}" matches forbidden shared provider pattern "${pattern}".`
      );
    }
  }

  // Check equality against configured shared Supabase URL
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  if (supabaseUrl) {
    if (cleanUrl === supabaseUrl.trim()) {
      throw new Error(
        "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
        `Supplied URL strictly matches configured SUPABASE_DATABASE_URL.`
      );
    }
    try {
      const parsedShared = new URL(supabaseUrl.trim());
      if (
        parsed.hostname === parsedShared.hostname &&
        parsed.port === parsedShared.port &&
        parsed.pathname === parsedShared.pathname
      ) {
        throw new Error(
          "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
          `Supplied URL matches configured shared database target (${parsed.hostname}${parsed.pathname}).`
        );
      }
    } catch {
      // Ignore unparseable shared string
    }
  }

  return cleanUrl;
}

/**
 * Checks whether DISPOSABLE_DATABASE_URL is safely present without throwing.
 *
 * @returns {boolean}
 */
export function isDisposableDatabaseConfigured() {
  try {
    validateDisposableDatabaseUrl(process.env[DISPOSABLE_ENV_VAR]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates an isolated PrismaClient connected to the disposable database.
 * Constructed ONLY after disposable DB guard validation passes.
 *
 * @param {string} [explicitUrl]
 * @returns {{ prisma: PrismaClient, disposableDbUrl: string }}
 */
export function getDisposablePrismaClient(explicitUrl = null) {
  const disposableDbUrl = validateDisposableDatabaseUrl(
    explicitUrl || process.env[DISPOSABLE_ENV_VAR]
  );

  const adapter = new PrismaPg({
    connectionString: disposableDbUrl,
  });

  const prisma = new PrismaClient({
    adapter,
    log: ["error"],
  });

  return { prisma, disposableDbUrl };
}
