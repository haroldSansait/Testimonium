export const SUPPORTED_RELATIONSHIPS = Object.freeze([
  "Self",
  "Parent",
  "Child",
  "Spouse",
  "Sibling",
  "Other Relative",
  "Authorized Representative",
]);

export const RELATIONSHIP_EVIDENCE = Object.freeze([
  Object.freeze({
    id: "authorization_letter",
    label: "Authorization Letter",
    description: "Signed authorization letter for a request made for another person.",
    required: true,
    kind: "relationship_evidence",
  }),
  Object.freeze({
    id: "registrant_id_front",
    label: "Registrant Government ID - Front",
    description: "Clear JPEG or PNG image of the front of the registrant's Government ID.",
    required: true,
    kind: "relationship_evidence",
  }),
  Object.freeze({
    id: "registrant_id_back",
    label: "Registrant Government ID - Back",
    description: "Clear JPEG or PNG image of the back of the registrant's Government ID.",
    required: true,
    kind: "relationship_evidence",
  }),
]);

const CANONICAL_BY_LOWER = new Map(
  SUPPORTED_RELATIONSHIPS.map((value) => [value.toLocaleLowerCase("en-US"), value])
);

export function canonicalizeRelationship(raw, { allowOmitted = true } = {}) {
  if (raw === undefined || raw === null) return allowOmitted ? "Self" : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return CANONICAL_BY_LOWER.get(trimmed.toLocaleLowerCase("en-US")) || null;
}

export function requireCanonicalRelationship(raw, options) {
  const canonical = canonicalizeRelationship(raw, options);
  if (!canonical) {
    const error = new Error("Relationship must be one of the supported relationship values.");
    error.statusCode = 400;
    error.code = "INVALID_RELATIONSHIP";
    throw error;
  }
  return canonical;
}

export function isSelfRelationship(persistedRelationship) {
  return persistedRelationship === "Self";
}

export function resolveRelationshipEvidence(persistedRelationship) {
  return isSelfRelationship(persistedRelationship)
    ? []
    : RELATIONSHIP_EVIDENCE.map((item) => ({ ...item }));
}

export const RELATIONSHIP_EVIDENCE_IDS = Object.freeze(
  RELATIONSHIP_EVIDENCE.map((item) => item.id)
);
