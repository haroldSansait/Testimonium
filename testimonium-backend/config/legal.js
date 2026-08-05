/**
 * Central Legal Compliance & Terms Configuration
 * Centralized versions for Terms of Service and Privacy Policy.
 */

export const CURRENT_TERMS_VERSION = "v1.0";
export const CURRENT_PRIVACY_VERSION = "v1.0";
export const LEGAL_EFFECTIVE_DATE = "2026-08-01";

export const SUPPORTED_TERMS_VERSIONS = [CURRENT_TERMS_VERSION];
export const SUPPORTED_PRIVACY_VERSIONS = [CURRENT_PRIVACY_VERSION];

/**
 * Validates if the provided versions are supported by the backend.
 * @param {string} termsVersion
 * @param {string} privacyVersion
 * @returns {boolean}
 */
export const isValidLegalVersion = (termsVersion, privacyVersion) => {
  const isTermsValid = SUPPORTED_TERMS_VERSIONS.includes(termsVersion);
  const isPrivacyValid = SUPPORTED_PRIVACY_VERSIONS.includes(privacyVersion);
  return isTermsValid && isPrivacyValid;
};

