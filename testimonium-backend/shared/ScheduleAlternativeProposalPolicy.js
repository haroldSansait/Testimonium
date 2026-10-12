import { getManilaDateString } from "../services/ConflictHelper.js";
import { isLayMinisterEligibleEvent } from "./LayMinisterPresentation.js";

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);

function sameInstant(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

export function isAlternativeProposalStale(schedule, proposal, now = new Date()) {
  if (
    !schedule?.layMinisterAssigned
    || !isLayMinisterEligibleEvent(schedule.eventType)
    || TERMINAL_STATUSES.has(schedule.status)
    || schedule.version !== proposal?.baseScheduleVersion
    || getManilaDateString(schedule.requestedDate) !== getManilaDateString(proposal?.baseRequestedDate)
    || !sameInstant(schedule.startDatetime, proposal?.baseStartDatetime)
  ) {
    return true;
  }
  const start = schedule.startDatetime ? new Date(schedule.startDatetime) : null;
  return !start || Number.isNaN(start.getTime()) || now.getTime() >= start.getTime();
}
