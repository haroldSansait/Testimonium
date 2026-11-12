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

export function normalizeNameForComparison(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function constructCanonicalFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
}): string {
  const clean = (val?: string | null) =>
    val ? String(val).trim().replace(/\s+/g, " ") : "";
  return [clean(parts.firstName), clean(parts.middleName), clean(parts.lastName), clean(parts.suffix)]
    .filter(Boolean)
    .join(" ");
}

export function doesConfirmedNameMatchDisplayed(
  displayedFullName: string | null | undefined,
  parts: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    suffix?: string | null;
  }
): boolean {
  const normalizedDisplayed = normalizeNameForComparison(displayedFullName);
  const reconstructed = constructCanonicalFullName(parts);
  const normalizedReconstructed = normalizeNameForComparison(reconstructed);
  return Boolean(normalizedDisplayed && normalizedDisplayed === normalizedReconstructed);
}
