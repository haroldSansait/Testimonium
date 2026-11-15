export const SCHEDULE_REJECTION_REASONS = {
  MISSING_REQUIREMENTS: "Missing or incomplete requirements",
  INVALID_DOCUMENTS: "Invalid, incorrect, or unreadable supporting documents",
  INCORRECT_BOOKING_INFO: "Incorrect or inconsistent booking information",
  UNAVAILABLE_DATE_TIME: "Requested date or time cannot be accommodated",
  SERVICE_UNAVAILABLE: "Selected service is unavailable",
  OTHER: "Other reason",
};

export const DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS = new Set([
  "MISSING_REQUIREMENTS",
  "INVALID_DOCUMENTS",
]);

export const SCHEDULE_REJECTION_REASON_CODES = Object.keys(SCHEDULE_REJECTION_REASONS);

export function getScheduleRejectionReasonLabel(code) {
  if (!code) return null;
  return SCHEDULE_REJECTION_REASONS[code] || code;
}

