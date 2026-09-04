/**
 * Resolves the user's first name from available profile and user sources.
 * Strips whitespace, avoids undefined/null string conversions, and returns only legitimate first names.
 * Never falls back to email username/prefix.
 */
export function resolveFirstName(
  fullName?: string | null,
  displayName?: string | null,
  firstName?: string | null
): string {
  if (firstName && typeof firstName === "string" && firstName.trim()) {
    const token = firstName.trim().split(/\s+/)[0];
    if (token && token.toLowerCase() !== "undefined" && token.toLowerCase() !== "null") {
      return token;
    }
  }

  const raw = (typeof fullName === "string" && fullName.trim()) || (typeof displayName === "string" && displayName.trim()) || "";
  if (raw) {
    const token = raw.split(/\s+/)[0];
    if (token && token.toLowerCase() !== "undefined" && token.toLowerCase() !== "null") {
      return token;
    }
  }

  return "";
}
