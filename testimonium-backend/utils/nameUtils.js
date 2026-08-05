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
