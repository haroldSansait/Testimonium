/**
 * ScheduleStateMachine
 *
 * Centralized State Machine and Invariant Enforcement for Schedules in Testimonium.
 * Models all legal status transitions, terminal-state immutability,
 * and the Confirmed Priest Invariant.
 */

export const ScheduleStatus = {
  PENDING: "PENDING",
  REQUESTED: "REQUESTED",
  PROPOSED_RESCHEDULE: "PROPOSED_RESCHEDULE",
  WAITING_PARISHIONER_RESPONSE: "WAITING_PARISHIONER_RESPONSE",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
};

export const TERMINAL_SCHEDULE_STATUSES = [
  ScheduleStatus.COMPLETED,
  ScheduleStatus.CANCELLED,
  ScheduleStatus.REJECTED,
];

// Strict transition mapping for standard status changes.
// Generic status mutations must not revive terminal states or arbitrarily revert CONFIRMED to PENDING.
const STANDARD_TRANSITIONS = {
  [ScheduleStatus.PENDING]: [
    ScheduleStatus.REQUESTED,
    ScheduleStatus.PROPOSED_RESCHEDULE,
    ScheduleStatus.WAITING_PARISHIONER_RESPONSE,
    ScheduleStatus.CONFIRMED,
    ScheduleStatus.CANCELLED,
    ScheduleStatus.REJECTED,
  ],
  [ScheduleStatus.REQUESTED]: [
    ScheduleStatus.PENDING,
    ScheduleStatus.PROPOSED_RESCHEDULE,
    ScheduleStatus.WAITING_PARISHIONER_RESPONSE,
    ScheduleStatus.CONFIRMED,
    ScheduleStatus.CANCELLED,
    ScheduleStatus.REJECTED,
  ],
  [ScheduleStatus.PROPOSED_RESCHEDULE]: [
    ScheduleStatus.PROPOSED_RESCHEDULE,
    ScheduleStatus.WAITING_PARISHIONER_RESPONSE,
    ScheduleStatus.CONFIRMED,
    ScheduleStatus.CANCELLED,
    ScheduleStatus.REJECTED,
  ],
  [ScheduleStatus.WAITING_PARISHIONER_RESPONSE]: [
    ScheduleStatus.PROPOSED_RESCHEDULE,
    ScheduleStatus.WAITING_PARISHIONER_RESPONSE,
    ScheduleStatus.CONFIRMED,
    ScheduleStatus.CANCELLED,
    ScheduleStatus.REJECTED,
  ],
  [ScheduleStatus.CONFIRMED]: [
    ScheduleStatus.COMPLETED,
    ScheduleStatus.CANCELLED,
    ScheduleStatus.REJECTED,
    // Note: Transition to PENDING is ONLY permitted via explicit business pathways:
    // 1. Assigned priest rejection
    // 2. Confirmed schedule priest reassignment
  ],
  [ScheduleStatus.COMPLETED]: [],
  [ScheduleStatus.CANCELLED]: [],
  [ScheduleStatus.REJECTED]: [],
};

/**
 * Maps incoming legacy or UI alias statuses to canonical Prisma ScheduleStatus enum values.
 * Specifically maps UNDER_REVIEW to PENDING without modifying the Prisma enum.
 *
 * @param {string} status
 * @returns {string}
 */
export function mapIncomingScheduleStatus(status) {
  if (!status) return status;
  const upper = String(status).trim().toUpperCase();
  if (upper === "UNDER_REVIEW") {
    return ScheduleStatus.PENDING;
  }
  return upper;
}

/**
 * Rejects every mutation attempt against a terminal schedule.
 */
export function assertScheduleMutable(schedule) {
  if (TERMINAL_SCHEDULE_STATUSES.includes(schedule?.status)) {
    const err = new Error("Cannot modify a schedule with terminal status '" + schedule.status + "'.");
    err.statusCode = 400;
    err.code = "TERMINAL_STATUS_IMMUTABLE";
    throw err;
  }
}

/**
 * Asserts the core Confirmed Priest Invariant:
 * a schedule may only become or remain CONFIRMED when a priest is assigned
 * and has explicitly accepted the assignment.
 */
export function requirePriestAccepted(schedule) {
  if (!schedule.assignedPriestId) {
    const err = new Error("A priest must be assigned to this schedule before it can be confirmed.");
    err.statusCode = 422;
    err.code = "PRIEST_ASSIGNMENT_REQUIRED";
    throw err;
  }
  if (schedule.priestResponseStatus !== "ACCEPTED") {
    const err = new Error(
      "The assigned priest has not yet accepted this assignment. Confirmation is only allowed after the priest accepts."
    );
    err.statusCode = 422;
    err.code = "PRIEST_ASSIGNMENT_PENDING";
    throw err;
  }
}

/**
 * Checks if a status transition is permitted given the current state and business context.
 *
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired target status
 * @param {object} [options={}]
 * @param {boolean} [options.allowReversionToPending=false] - True only for explicit business paths (priest rejection/reassignment)
 * @returns {boolean}
 */
export function canTransitionSchedule(fromStatus, toStatus, { allowReversionToPending = false } = {}) {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true;

  // Terminal statuses are immutable and cannot transition to anything
  if (TERMINAL_SCHEDULE_STATUSES.includes(fromStatus)) {
    return false;
  }

  // Explicit business exception: CONFIRMED -> PENDING upon priest rejection or reassignment
  if (fromStatus === ScheduleStatus.CONFIRMED && toStatus === ScheduleStatus.PENDING && allowReversionToPending) {
    return true;
  }

  const allowed = STANDARD_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Validates a transition against a current schedule object and throws a domain error if illegal.
 * Also enforces the CONFIRMED invariant when entering CONFIRMED status.
 *
 * @param {object} currentSchedule
 * @param {string} targetStatus
 * @param {object} [options={}]
 * @param {boolean} [options.allowReversionToPending=false]
 * @throws 400 INVALID_STATE_TRANSITION or 422 PRIEST_ASSIGNMENT_*
 */
export function validateScheduleTransition(currentSchedule, targetStatus, { allowReversionToPending = false } = {}) {
  const fromStatus = currentSchedule.status;
  const mappedTarget = mapIncomingScheduleStatus(targetStatus);

  if (TERMINAL_SCHEDULE_STATUSES.includes(fromStatus)) {
    const err = new Error(`Cannot modify a schedule with terminal status '${fromStatus}'.`);
    err.statusCode = 400;
    err.code = "TERMINAL_STATUS_IMMUTABLE";
    throw err;
  }

  if (!canTransitionSchedule(fromStatus, mappedTarget, { allowReversionToPending })) {
    const err = new Error(`Illegal status transition from '${fromStatus}' to '${mappedTarget}'.`);
    err.statusCode = 400;
    err.code = "INVALID_STATE_TRANSITION";
    throw err;
  }

  if (mappedTarget === ScheduleStatus.CONFIRMED) {
    requirePriestAccepted(currentSchedule);
  }
}
