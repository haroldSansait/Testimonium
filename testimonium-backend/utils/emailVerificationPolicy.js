import { env } from "../config/env.js";

/**
 * Centralized Email Verification Policy Helper
 * Evaluates whether email verification is required for a user given their role, provider, and environment.
 *
 * Rules:
 * - Google provider ("google.com"): Never require additional email verification.
 * - Email/Password provider ("password"):
 *   - Production environment: Always require email verification for all roles.
 *   - Development environment:
 *     - PARISHIONER role: Always require email verification.
 *     - Staff roles (SECRETARY, PRIEST, DIOCESE_COORDINATOR, SUPER_ADMIN): Follow ADMIN_EMAIL_VERIFICATION_REQUIRED policy setting.
 *
 * @param {Object} params
 * @param {string|Object} params.role User role string (e.g. "PARISHIONER", "SECRETARY") or role object with roleName
 * @param {string} [params.provider="password"] Firebase sign-in provider (e.g. "password", "google.com")
 * @param {string} [params.environment=env.nodeEnv] Runtime environment ("development", "production")
 * @returns {boolean} True if email verification is required, false if it can be bypassed.
 */
export const shouldRequireEmailVerification = ({
  role,
  provider = "password",
  environment = env.nodeEnv,
} = {}) => {
  // Google provider accounts are pre-verified by Google IDP
  if (provider === "google.com") {
    return false;
  }

  // Normalize role string if role is passed as object { roleName } or string
  const roleName = typeof role === "string" ? role : role?.roleName;

  // In production, verification is permanently enforced for all accounts
  if (environment === "production") {
    return true;
  }

  // In development, PARISHIONER role always requires verification
  if (!roleName || roleName === "PARISHIONER") {
    return true;
  }

  // For staff roles (SECRETARY, PRIEST, DIOCESE_COORDINATOR, SUPER_ADMIN), follow environment configuration
  return env.adminEmailVerificationRequired;
};

/**
 * Helper alias supporting flexible call syntax:
 * isEmailVerificationRequired(role, provider, environment) or isEmailVerificationRequired({ role, provider, environment })
 */
export const isEmailVerificationRequired = (role, provider, environment) => {
  if (typeof role === "object" && role !== null && !role.roleName && !Array.isArray(role)) {
    return shouldRequireEmailVerification(role);
  }
  return shouldRequireEmailVerification({ role, provider, environment });
};
