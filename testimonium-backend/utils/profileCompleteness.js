/**
 * Canonical helper for evaluating application profile completeness.
 * Authoritative criteria: user must have non-empty fullName and non-empty contactNumber.
 *
 * @param {object} user - User record or profile object
 * @returns {boolean} true if profile needs completion (incomplete), false if complete
 */
export function isProfileIncomplete(user) {
  if (!user) return true;
  const fullName = typeof user.fullName === "string" ? user.fullName.trim() : "";
  const contactNumber = typeof user.contactNumber === "string" ? user.contactNumber.trim() : "";
  return fullName.length === 0 || contactNumber.length === 0;
}

export function isProfileComplete(user) {
  return !isProfileIncomplete(user);
}
