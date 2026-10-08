const SUFFIXES = new Set(["JR", "JUNIOR", "SR", "SENIOR", "II", "III", "IV", "V"]);
const SURNAME_PARTICLES = new Set(["DA", "DE", "DEL", "DELA", "DI", "DOS", "LA", "LAS", "LOS", "SAN", "SANTA", "VAN", "VON"]);

export const SELF_NAME_MATCH = Object.freeze({
  CLEAR: "CLEAR_MATCH",
  AMBIGUOUS: "AMBIGUOUS_MATCH",
  MISMATCH: "CLEAR_MISMATCH",
  UNAVAILABLE: "AUTHORITATIVE_NAME_UNAVAILABLE",
});

export function normalizeRelationshipName(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalizeRelationshipName(value).split(" ").filter(Boolean)
    .filter((token) => !SUFFIXES.has(token));
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const token of left) counts.set(token, (counts.get(token) || 0) + 1);
  for (const token of right) {
    const remaining = counts.get(token) || 0;
    if (!remaining) return false;
    if (remaining === 1) counts.delete(token);
    else counts.set(token, remaining - 1);
  }
  return counts.size === 0;
}

function profileAnchors(tokens) {
  const givenName = tokens[0] || "";
  const surnameRoot = tokens[tokens.length - 1] || "";
  const surnameTokens = surnameRoot ? [surnameRoot] : [];
  for (let index = tokens.length - 2; index > 0; index -= 1) {
    if (!SURNAME_PARTICLES.has(tokens[index])) break;
    surnameTokens.unshift(tokens[index]);
  }
  return { givenName, surnameRoot, surnameTokens };
}

/**
 * Uses the current profile name because TESTIMONIUM does not persist the exact
 * OCR-extracted name from verification. Material profile-name edits invalidate
 * verification, so this is the most authoritative available value.
 */
export function compareSelfRegistrantName(authoritativeProfileName, applicantName) {
  const profileTokens = tokenize(authoritativeProfileName);
  if (profileTokens.length < 2) {
    return { outcome: SELF_NAME_MATCH.UNAVAILABLE, reason: "PROFILE_NAME_MISSING" };
  }
  const applicantTokens = tokenize(applicantName);
  if (applicantTokens.length < 2) {
    return { outcome: SELF_NAME_MATCH.MISMATCH, reason: "APPLICANT_NAME_INCOMPLETE" };
  }
  if (sameMultiset(profileTokens, applicantTokens)) {
    return { outcome: SELF_NAME_MATCH.CLEAR, reason: "SAME_NAME_TOKENS" };
  }

  const { givenName, surnameRoot, surnameTokens } = profileAnchors(profileTokens);
  const applicantSet = new Set(applicantTokens);
  if (!applicantSet.has(givenName) || !applicantSet.has(surnameRoot)) {
    return { outcome: SELF_NAME_MATCH.MISMATCH, reason: "PRIMARY_NAME_ANCHOR_MISMATCH" };
  }
  const missingSurnameParticles = surnameTokens.some((token) => !applicantSet.has(token));
  const profileSet = new Set(profileTokens);
  const unmatchedApplicantTokens = applicantTokens.filter((token) => {
    if (profileSet.has(token)) return false;
    return !(token.length === 1 && profileTokens.some((profileToken, index) =>
      index > 0 && index < profileTokens.length - 1 && profileToken.startsWith(token)
    ));
  });
  if (!missingSurnameParticles && unmatchedApplicantTokens.length === 0) {
    return { outcome: SELF_NAME_MATCH.CLEAR, reason: "PRIMARY_ANCHORS_WITH_OPTIONAL_MIDDLE_NAME" };
  }
  return {
    outcome: SELF_NAME_MATCH.AMBIGUOUS,
    reason: missingSurnameParticles ? "PLAUSIBLE_COMPOUND_SURNAME_VARIATION" : "PLAUSIBLE_ADDITIONAL_NAME_TOKEN",
  };
}
