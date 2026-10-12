export const LAY_MINISTER_MASS_TITLE = "Liturgy of the Word";

export const LAY_MINISTER_EVENT_TITLES = Object.freeze({
  FUNERAL: "Rite of Committal",
  BLESSING: "Blessing",
});

export function isLayMinisterEligibleEvent(eventType) {
  return Object.prototype.hasOwnProperty.call(LAY_MINISTER_EVENT_TITLES, eventType);
}

export function resolveScheduleDisplayTitle(schedule) {
  if (schedule?.layMinisterAssigned && isLayMinisterEligibleEvent(schedule.eventType)) {
    return LAY_MINISTER_EVENT_TITLES[schedule.eventType];
  }
  return schedule?.displayTitle || schedule?.eventType || "Schedule Request";
}

export function resolveMassDisplayLabel(template) {
  return template?.layMinisterAssigned
    ? LAY_MINISTER_MASS_TITLE
    : (template?.label || "Holy Mass");
}

export function decorateScheduleForDisplay(schedule) {
  if (!schedule) return schedule;
  const start = schedule.startDatetime ? new Date(schedule.startDatetime) : null;
  const eligibleStatus = ["PENDING", "REQUESTED", "CONFIRMED"].includes(schedule.status);
  const appointmentNotStarted = Boolean(start && !Number.isNaN(start.getTime()) && Date.now() < start.getTime());
  return {
    ...schedule,
    effectiveDisplayTitle: resolveScheduleDisplayTitle(schedule),
    canProposeAlternativeDate: Boolean(
      schedule.layMinisterAssigned
      && isLayMinisterEligibleEvent(schedule.eventType)
      && eligibleStatus
      && appointmentNotStarted
      && !["SUBMITTED", "PRIEST_PENDING"].includes(schedule.alternativeProposal?.status)
    ),
  };
}

export function decorateMassTemplateForDisplay(template) {
  if (!template) return template;
  return {
    ...template,
    displayLabel: resolveMassDisplayLabel(template),
  };
}
