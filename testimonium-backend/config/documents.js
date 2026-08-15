/**
 * Canonical Sacramental Document Types Configuration
 * Single source of truth for supported document types across TESTIMONIUM.
 */

export const CANONICAL_DOCUMENT_TYPES = [
  "BAPTISMAL_CERTIFICATE",
  "CONFIRMATION_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "FIRST_COMMUNION_CERTIFICATE",
  "MARRIAGE_BANNS",
  "PERMIT_TO_MARRY",
  "STATUS_OF_LIBERTY",
];

export const DEFAULT_OFFERED_DOCUMENTS = [
  "BAPTISMAL_CERTIFICATE",
  "CONFIRMATION_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "FIRST_COMMUNION_CERTIFICATE",
  "MARRIAGE_BANNS",
  "PERMIT_TO_MARRY",
  "STATUS_OF_LIBERTY",
];

// Document aliases for legacy normalization
const DOCUMENT_ALIASES = {
  BAPTISM: "BAPTISMAL_CERTIFICATE",
  CONFIRMATION: "CONFIRMATION_CERTIFICATE",
  MARRIAGE: "MARRIAGE_CERTIFICATE",
  FIRST_COMMUNION: "FIRST_COMMUNION_CERTIFICATE",
  BANNS: "MARRIAGE_BANNS",
  PERMIT: "PERMIT_TO_MARRY",
  LIBERTY: "STATUS_OF_LIBERTY",
};

/**
 * Normalizes a raw document type string to canonical format.
 * @param {string} rawType
 * @returns {string|null}
 */
export function normalizeDocumentType(rawType) {
  if (!rawType || typeof rawType !== "string") return null;
  const upper = rawType.toUpperCase().trim();
  if (DOCUMENT_ALIASES[upper]) {
    return DOCUMENT_ALIASES[upper];
  }
  if (CANONICAL_DOCUMENT_TYPES.includes(upper)) {
    return upper;
  }
  return null;
}

/**
 * Validates whether a document type is canonical.
 * @param {string} docType
 * @returns {boolean}
 */
export function isValidDocumentType(docType) {
  if (!docType || typeof docType !== "string") return false;
  const normalized = normalizeDocumentType(docType);
  return normalized !== null && CANONICAL_DOCUMENT_TYPES.includes(normalized);
}

/**
 * Resolves the effective offered documents for a parish.
 * - null/undefined => DEFAULT_OFFERED_DOCUMENTS (all canonical)
 * - [] => [] (explicitly configured to offer no documents)
 * - Array => normalized filtered array
 * @param {any} availableDocuments
 * @returns {string[]}
 */
export function getEffectiveOfferedDocuments(availableDocuments) {
  if (availableDocuments === null || availableDocuments === undefined) {
    return [...DEFAULT_OFFERED_DOCUMENTS];
  }

  let docs = availableDocuments;
  if (typeof docs === "string") {
    try {
      docs = JSON.parse(docs);
    } catch {
      return [...DEFAULT_OFFERED_DOCUMENTS];
    }
  }

  if (!Array.isArray(docs)) {
    return [...DEFAULT_OFFERED_DOCUMENTS];
  }

  // Preserve explicit empty array
  if (docs.length === 0) {
    return [];
  }

  const validSet = new Set();
  for (const item of docs) {
    const norm = normalizeDocumentType(item);
    if (norm) {
      validSet.add(norm);
    }
  }

  // Return in canonical order
  return CANONICAL_DOCUMENT_TYPES.filter((type) => validSet.has(type));
}

/**
 * Normalizes and validates availableDocuments for persistence.
 * Throws 400 Error if array contains unrecognized types.
 * @param {any} docsInput
 * @returns {string[]}
 */
export function normalizeAvailableDocumentsForSave(docsInput) {
  let docs = docsInput;
  if (typeof docs === "string") {
    try {
      docs = JSON.parse(docs);
    } catch {
      const err = new Error("Invalid JSON format for availableDocuments.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (!Array.isArray(docs)) {
    const err = new Error("availableDocuments must be an array of document types.");
    err.statusCode = 400;
    throw err;
  }

  const normalizedDocs = [];
  const seen = new Set();

  for (const rawDoc of docs) {
    if (!rawDoc || typeof rawDoc !== "string") {
      const err = new Error("Invalid document type value in availableDocuments.");
      err.statusCode = 400;
      throw err;
    }

    const normalized = normalizeDocumentType(rawDoc);
    if (!normalized) {
      const err = new Error(
        `Invalid document type "${rawDoc}" in availableDocuments. Supported types: ${CANONICAL_DOCUMENT_TYPES.join(", ")}`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      normalizedDocs.push(normalized);
    }
  }

  // Return in stable canonical order
  return CANONICAL_DOCUMENT_TYPES.filter((type) => seen.has(type));
}
