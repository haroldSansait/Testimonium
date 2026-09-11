/**
 * Safe Enum Humanization Utilities for Caloy Live Tools
 *
 * Converts raw database enums (e.g. PAYMENT_UNDER_REVIEW, BAPTISMAL_CERTIFICATE)
 * into human-readable, user-friendly labels without mutating underlying enum values.
 */

export const DOCUMENT_TYPE_LABELS = {
  BAPTISMAL_CERTIFICATE: "Baptismal Certificate",
  CONFIRMATION_CERTIFICATE: "Confirmation Certificate",
  MARRIAGE_CERTIFICATE: "Marriage Certificate",
  FIRST_COMMUNION_CERTIFICATE: "First Communion Certificate",
  MARRIAGE_BANNS: "Marriage Banns",
  PERMIT_TO_MARRY: "Permit to Marry",
  STATUS_OF_LIBERTY: "Status of Liberty Certificate",
};

export const DOCUMENT_REQUEST_STATUS_LABELS = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  NEEDS_CORRECTION: "Needs correction",
  PAYMENT_PENDING: "Payment pending",
  PENDING_PAYMENT: "Pending payment",
  PAYMENT_UNDER_REVIEW: "Payment under review",
  PAYMENT_NEEDS_CORRECTION: "Payment proof needs correction",
  PAYMENT_VERIFIED: "Payment verified",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: "Unpaid",
  PROOF_SUBMITTED: "Proof submitted",
  PAYMENT_UNDER_REVIEW: "Payment under review",
  CONFIRMED: "Confirmed",
};

export const PAYMENT_VERIFICATION_STATUS_LABELS = {
  PENDING: "Under review",
  VERIFIED: "Verified",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const SCHEDULE_EVENT_TYPE_LABELS = {
  WEDDING: "Wedding",
  BAPTISM: "Baptism",
  CONFIRMATION: "Confirmation",
  PRIVATE_MASS: "Private Mass",
  MASS_INTENTION: "Mass Intention",
  MARRIAGE_SPECIAL: "Marriage (Special)",
  WAKE_MASS: "Wake Mass",
  FUNERAL: "Funeral",
  ANOINTING_OF_THE_SICK: "Anointing of the Sick",
  FIESTA: "Fiesta Mass",
  BLESSING: "Blessing",
  DELIVERANCE: "Deliverance",
  THANKSGIVING: "Thanksgiving Mass",
  FIRST_COMMUNION: "First Communion",
  MASS_OF_HOLY_SPIRIT: "Mass of the Holy Spirit",
  CONFESSION: "Confession",
};

export const SCHEDULE_STATUS_LABELS = {
  PENDING: "Pending",
  PENDING_STAFF_APPROVAL: "Pending staff approval",
  REQUESTED: "Requested",
  PROPOSED_RESCHEDULE: "Reschedule proposed",
  WAITING_PARISHIONER_RESPONSE: "Awaiting your response",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

function formatFallback(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function humanizeDocumentType(type) {
  if (!type) return "Document";
  return DOCUMENT_TYPE_LABELS[type] || formatFallback(type);
}

export function humanizeDocumentStatus(status) {
  if (!status) return "Unknown";
  return DOCUMENT_REQUEST_STATUS_LABELS[status] || formatFallback(status);
}

export function humanizePaymentStatus(status) {
  if (!status) return "Unpaid";
  return PAYMENT_STATUS_LABELS[status] || formatFallback(status);
}

export function humanizeVerificationStatus(status) {
  if (!status) return "Pending";
  return PAYMENT_VERIFICATION_STATUS_LABELS[status] || formatFallback(status);
}

export function humanizeEventType(type) {
  if (!type) return "Sacramental Appointment";
  return SCHEDULE_EVENT_TYPE_LABELS[type] || formatFallback(type);
}

export function humanizeScheduleStatus(status) {
  if (!status) return "Pending";
  return SCHEDULE_STATUS_LABELS[status] || formatFallback(status);
}
