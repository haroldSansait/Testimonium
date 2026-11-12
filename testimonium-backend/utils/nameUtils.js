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

// Only explicitly supplied parts (or previously stored parts) identify boundaries.
// A legacy full-name edit clears components so Self never uses an outdated name.
export const resolveUserNameUpdate = (data = {}, current = {}) => {
  const fields = ["firstName", "middleName", "lastName", "suffix"];
  if (fields.some(field => data[field] !== undefined)) {
    const completeInput = data.firstName !== undefined && data.lastName !== undefined;
    const parts = Object.fromEntries(fields.map(field => {
      const value = data[field] !== undefined ? data[field] : (completeInput ? null : current[field]);
      return [field, value ? String(value).trim().replace(/\s+/g, " ") || null : null];
    }));
    const reconstructed = normalizeAndConstructFullName(parts);
    const unchanged = fields.every(field =>
      cleanNullableNameValue(parts[field]) === cleanNullableNameValue(current[field])
    );
    return { fullName: unchanged && current.fullName ? current.fullName : reconstructed, ...parts };
  }
  if (typeof data.fullName !== "string" || !data.fullName.trim()) return {};
  const fullName = data.fullName.trim();
  return fullName === current.fullName
    ? { fullName }
    : { fullName, ...Object.fromEntries(fields.map(field => [field, null])) };
};

export const cleanNullableNameValue = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || null;
};

export const hasAnyNameField = (data = {}) =>
  ["fullName", "name", "firstName", "middleName", "lastName", "suffix"].some(
    (field) => data?.[field] !== undefined
  );

export const hasLegalNameChange = (nameInput = {}, nameUpdate = {}, current = {}) => {
  const fields = ["fullName", "firstName", "middleName", "lastName", "suffix"];
  for (const field of fields) {
    if (nameUpdate[field] !== undefined) {
      if (cleanNullableNameValue(nameUpdate[field]) !== cleanNullableNameValue(current[field])) {
        return true;
      }
    }
  }
  const explicitCombined = cleanNullableNameValue(nameInput.fullName ?? nameInput.name);
  if (explicitCombined !== null && explicitCombined !== cleanNullableNameValue(current.fullName)) {
    return true;
  }
  return false;
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

// Both draft creation and editing use the same canonical name validation.
export const resolveRequestApplicantName = (data) => {
  const name = data.applicantFirstName && data.applicantLastName
    ? buildApplicantName({ firstName: data.applicantFirstName, middleName: data.applicantMiddleName, lastName: data.applicantLastName })
    : (typeof data.applicantName === "string" ? data.applicantName.trim() : "");
  if (!name || name.length > 150) {
    const error = new Error(!name ? "Applicant name is required." : "Applicant name must not exceed 150 characters.");
    error.statusCode = 400;
    error.code = "INVALID_APPLICANT_NAME";
    throw error;
  }
  return name;
};
