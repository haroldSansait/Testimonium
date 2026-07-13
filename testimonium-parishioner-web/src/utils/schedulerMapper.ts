/**
 * Converts a user-friendly appointment/service label into the canonical backend ScheduleEventType enum.
 * Centralized mapping function to avoid scattered string matching.
 *
 * @param {string} serviceName - User-selected service name (e.g. "Baptism Interview")
 * @returns {string} - Canonical backend ScheduleEventType enum (BAPTISM, CONFIRMATION, WEDDING, PRIVATE_MASS, MASS_INTENTION)
 */
export const mapFrontendToBackendEventType = (serviceName: string): string => {
  if (!serviceName) {
    console.warn("mapFrontendToBackendEventType: received empty serviceName. Defaulting to MASS_INTENTION.");
    return "MASS_INTENTION";
  }

  // Normalize: trim, lowercase, replace multiple spaces
  const normalized = serviceName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (normalized.includes("baptism")) {
    return "BAPTISM";
  }

  if (normalized.includes("confirmation")) {
    return "CONFIRMATION";
  }

  if (
    normalized.includes("marriage") ||
    normalized.includes("wedding") ||
    normalized.includes("cana") ||
    normalized.includes("canonical interview")
  ) {
    return "WEDDING";
  }

  if (
    normalized.includes("private mass") ||
    normalized.includes("house blessing") ||
    normalized.includes("blessing")
  ) {
    return "PRIVATE_MASS";
  }

  if (normalized.includes("mass intention")) {
    return "MASS_INTENTION";
  }

  // Defensive validation: Log a warning in development mode when falling back to default
  console.warn(
    `[mapFrontendToBackendEventType] Unknown schedule type: "${serviceName}". Defaulting to MASS_INTENTION.`
  );

  return "MASS_INTENTION";
};
