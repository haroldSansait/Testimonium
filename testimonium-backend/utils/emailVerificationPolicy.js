import { env } from "../config/env.js";

/**
 * Centralized Email Verification Policy Helper
 * Evaluates whether email verification is required for a user given their role, provider, and environment.
 *
 * Rules:
 * - Google provider ("google.com"): Never require additional email verification.
 * - Email/Password provider ("password"):
 *   - PARISHIONER role: Always require email verification.
 *   - Staff roles (SECRETARY, PRIEST, DIOCESE_COORDINATOR, SUPER_ADMIN): Follow ADMIN_EMAIL_VERIFICATION_REQUIRED in every environment.
 *   - Other roles: Preserve mandatory verification in production.
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

  // Only existing staff roles may follow the configurable policy in production.
  const isStaff = ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR", "SUPER_ADMIN"].includes(roleName);
  if (environment === "production" && !isStaff) {
    return true;
  }

  // PARISHIONER and missing roles always require verification.
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
