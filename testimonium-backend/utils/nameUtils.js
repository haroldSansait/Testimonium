/**
 * Validates and normalizes individual name fields to construct a clean fullName.
 * @param {object} nameParts
 * @returns {string}
 */
export const normalizeAndConstructFullName = ({ firstName, middleName, lastName, suffix } = {}) => {
  const clean = (val) => (val ? String(val).trim().replace(/\s+/g, " ") : "");
  
  const fName = clean(firstName);
  const mName = clean(middleName);
  const lName = clean(lastName);
  const sfx = clean(suffix);

  if (!fName || !lName) {
    const error = new Error("First name and last name are required.");
    error.statusCode = 400;
    error.code = "INVALID_NAME_FIELDS";
    throw error;
  }

  return [fName, mName, lName, sfx].filter(Boolean).join(" ");
};

/**
 * Canonical helper for constructing an applicant full name from structured inputs.
 * Middle name is optional. Suffix is explicitly excluded per Phase 1 specification.
 *
 * @param {object} params - { firstName, middleName, lastName }
 * @returns {string} canonical applicant full name
 */
export const buildApplicantName = ({ firstName, middleName, lastName } = {}) => {
  const clean = (val) => (val ? String(val).trim().replace(/\s+/g, " ") : "");

  const fName = clean(firstName);
  const mName = clean(middleName);
  const lName = clean(lastName);

  if (!fName || !lName) {
    const error = new Error("First name and last name are required.");
    error.statusCode = 400;
    error.code = "INVALID_APPLICANT_NAME";
    throw error;
  }

  if (fName.length > 50 || mName.length > 50 || lName.length > 50) {
    const error = new Error("Applicant name parts must not exceed 50 characters each.");
    error.statusCode = 400;
    error.code = "INVALID_APPLICANT_NAME";
    throw error;
  }

  const combined = mName ? `${fName} ${mName} ${lName}` : `${fName} ${lName}`;

  if (combined.length > 150) {
    const error = new Error("Combined applicant name must not exceed 150 characters.");
    error.statusCode = 400;
    error.code = "INVALID_APPLICANT_NAME";
    throw error;
  }

  return combined;
};
