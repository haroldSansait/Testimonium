import { GOVERNMENT_ID_STATUS } from "../config/governmentIdVerification.js";

/**
 * Evaluates whether a Government ID verification record is currently effective.
 *
 * An ID verification is effective IF AND ONLY IF:
 * 1. record is not null/undefined
 * 2. status === "VERIFIED"
 * 3. expiresAt is null (non-expiring card) OR expiresAt > referenceDate (now)
 *
 * @param {object|null|undefined} verification - The GovernmentIdVerification model or relation object
 * @param {Date} [referenceDate=new Date()] - The comparison timestamp
 * @returns {boolean} true if effective, false otherwise
 */
export function isEffectivelyVerified(verification, referenceDate = new Date()) {
  if (!verification) {
    return false;
  }

  if (verification.status !== GOVERNMENT_ID_STATUS.VERIFIED) {
    return false;
  }

  if (verification.expiresAt) {
    const expiry = new Date(verification.expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= referenceDate) {
      return false;
    }
  }

  return true;
}
