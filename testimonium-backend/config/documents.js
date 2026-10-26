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

export const CANONICAL_REQUIREMENT_IDS = [
  "valid_id",
  "endorsement_letter",
  "baptismal_cert",
  "confirmation_cert",
  "marriage_license",
  "precana_proof",
  "cenomar",
  "banns_clearance",
  "canonical_interview",
];

export const CANONICAL_REQUIREMENT_IDS_SET = new Set(CANONICAL_REQUIREMENT_IDS);
export const CANONICAL_DOCUMENT_TYPES_SET = new Set(CANONICAL_DOCUMENT_TYPES);

/**
 * Validates and normalizes documentSettings payload for persistence.
 * Enforces canonical document types, object structure, canonical requirement IDs, and strict boolean values.
 * Throws a controlled 400 Error on any invalid input.
 * @param {any} settingsInput
 * @returns {object}
 */
export function validateDocumentSettingsForSave(settingsInput) {
  let settings = settingsInput;
  if (typeof settings === "string") {
    try {
      settings = JSON.parse(settings);
    } catch {
      const err = new Error("Invalid JSON format for documentSettings.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    const err = new Error("documentSettings must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const validated = {};

  for (const [docKey, docVal] of Object.entries(settings)) {
    // Preserve legacy/unrelated top-level metadata if present
    if (docKey === "paymentMethods") {
      validated[docKey] = docVal;
      continue;
    }

    if (!CANONICAL_DOCUMENT_TYPES_SET.has(docKey)) {
      const err = new Error(
        `Invalid document type "${docKey}" in documentSettings. Supported types: ${CANONICAL_DOCUMENT_TYPES.join(", ")}`
      );
      err.statusCode = 400;
      throw err;
    }

    if (typeof docVal !== "object" || docVal === null || Array.isArray(docVal)) {
      const err = new Error(`Configuration for document type "${docKey}" must be an object.`);
      err.statusCode = 400;
      throw err;
    }

    const docConfig = { ...docVal };

    if (docVal.requirements !== undefined) {
      if (
        typeof docVal.requirements !== "object" ||
        docVal.requirements === null ||
        Array.isArray(docVal.requirements)
      ) {
        const err = new Error(`requirements for document type "${docKey}" must be an object.`);
        err.statusCode = 400;
        throw err;
      }

      const validatedReqs = {};
      for (const [reqId, reqVal] of Object.entries(docVal.requirements)) {
        if (!CANONICAL_REQUIREMENT_IDS_SET.has(reqId)) {
          const err = new Error(
            `Invalid requirement ID "${reqId}" for document type "${docKey}". Supported requirements: ${CANONICAL_REQUIREMENT_IDS.join(", ")}`
          );
          err.statusCode = 400;
          throw err;
        }

        if (typeof reqVal !== "boolean") {
          const err = new Error(
            `Requirement value for "${reqId}" in "${docKey}" must be strictly boolean (true or false). Received: ${JSON.stringify(reqVal)}`
          );
          err.statusCode = 400;
          throw err;
        }

        validatedReqs[reqId] = reqVal;
      }
      docConfig.requirements = validatedReqs;
    }

    validated[docKey] = docConfig;
  }

  return validated;
}
