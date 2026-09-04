export const DocumentRequestStatus = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  NEEDS_CORRECTION: "NEEDS_CORRECTION",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_UNDER_REVIEW: "PAYMENT_UNDER_REVIEW",
  PAYMENT_NEEDS_CORRECTION: "PAYMENT_NEEDS_CORRECTION",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PROCESSING: "PROCESSING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
};

// Strict transitions mapping:
// key: current status
// value: array of allowed target statuses
const TRANSITIONS = {
  [DocumentRequestStatus.PENDING]: [
    DocumentRequestStatus.UNDER_REVIEW,
    DocumentRequestStatus.CANCELLED,
    DocumentRequestStatus.REJECTED,
  ],
  [DocumentRequestStatus.UNDER_REVIEW]: [
    DocumentRequestStatus.PAYMENT_PENDING,
    DocumentRequestStatus.NEEDS_CORRECTION,
    DocumentRequestStatus.PROCESSING, // Direct transition for zero-fee or waived documents
    DocumentRequestStatus.REJECTED,
  ],
  [DocumentRequestStatus.NEEDS_CORRECTION]: [
    DocumentRequestStatus.UNDER_REVIEW,
    DocumentRequestStatus.CANCELLED,
    DocumentRequestStatus.REJECTED,
  ],
  [DocumentRequestStatus.PAYMENT_PENDING]: [
    DocumentRequestStatus.PAYMENT_UNDER_REVIEW,
    DocumentRequestStatus.PAYMENT_NEEDS_CORRECTION,
    DocumentRequestStatus.CANCELLED,
  ],
  [DocumentRequestStatus.PAYMENT_UNDER_REVIEW]: [
    DocumentRequestStatus.PAYMENT_VERIFIED,
    DocumentRequestStatus.PAYMENT_NEEDS_CORRECTION,
    DocumentRequestStatus.REJECTED,
  ],
  [DocumentRequestStatus.PAYMENT_NEEDS_CORRECTION]: [
    DocumentRequestStatus.PAYMENT_UNDER_REVIEW,
    DocumentRequestStatus.CANCELLED,
    DocumentRequestStatus.REJECTED,
  ],
  [DocumentRequestStatus.PAYMENT_VERIFIED]: [
    DocumentRequestStatus.PROCESSING,
    DocumentRequestStatus.PAYMENT_PENDING, // allow rolling back to pending if proof was bad
  ],
  [DocumentRequestStatus.PROCESSING]: [
    DocumentRequestStatus.READY_FOR_PICKUP,
  ],
  [DocumentRequestStatus.READY_FOR_PICKUP]: [
    DocumentRequestStatus.COMPLETED,
  ],
  [DocumentRequestStatus.COMPLETED]: [],
  [DocumentRequestStatus.REJECTED]: [],
  [DocumentRequestStatus.CANCELLED]: [],
};

/**
 * Checks if a status transition is permitted.
 * @param {string} from - current status
 * @param {string} to - target status
 * @returns {boolean}
 */
export function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true; // transition to self is fine
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Gets all allowed transitions for a given status.
 * @param {string} status
 * @returns {string[]}
 */
export function getAvailableTransitions(status) {
  return TRANSITIONS[status] || [];
}
