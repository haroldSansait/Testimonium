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
 * Resolves legal-name updates on parishioner profiles.
 * Rejects standalone combined-name changes or incomplete structured inputs so
 * structured components are never cleared or left out of sync with full_name.
 */
export const resolveParishionerNameUpdate = (data = {}, current = {}) => {
  const fields = ["firstName", "middleName", "lastName", "suffix"];
  const hasStructuredInput = fields.some((field) => data[field] !== undefined);

  if (hasStructuredInput) {
    const firstName = cleanNullableNameValue(data.firstName);
    const lastName = cleanNullableNameValue(data.lastName);

    if (!firstName || !lastName) {
      const error = new Error("First name and last name are required.");
      error.statusCode = 400;
      error.code = "INVALID_NAME_FIELDS";
      throw error;
    }

    const parts = {
      firstName,
      middleName: cleanNullableNameValue(data.middleName),
      lastName,
      suffix: cleanNullableNameValue(data.suffix),
    };
    const reconstructed = normalizeAndConstructFullName(parts);
    const unchanged = fields.every(
      (field) => cleanNullableNameValue(parts[field]) === cleanNullableNameValue(current[field])
    );

    if (data.fullName !== undefined || data.name !== undefined) {
      const explicitCombined = cleanNullableNameValue(data.fullName ?? data.name);
      const matchesCurrentPreserved =
        unchanged && explicitCombined === cleanNullableNameValue(current.fullName);
      if (!matchesCurrentPreserved && explicitCombined !== reconstructed) {
        const error = new Error("Provided fullName does not match the structured name components.");
        error.statusCode = 400;
        error.code = "INCONSISTENT_NAME_PAYLOAD";
        throw error;
      }
    }

    return {
      fullName: unchanged && current.fullName ? current.fullName : reconstructed,
      ...parts,
    };
  }

  const rawCombined = data.fullName !== undefined ? data.fullName : data.name;
  if (rawCombined === undefined) return {};

  const combined = cleanNullableNameValue(rawCombined);
  if (combined !== null && combined === cleanNullableNameValue(current.fullName)) {
    return { fullName: current.fullName };
  }

  const error = new Error(
    "First name and last name are required to update your legal name. Please use the Change Full Name form."
  );
  error.statusCode = 400;
  error.code = "STRUCTURED_NAME_REQUIRED";
  throw error;
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
