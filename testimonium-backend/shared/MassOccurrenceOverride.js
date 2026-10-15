// Match the saved occurrence configuration, never move an override with a template edit.
export function activeMassOccurrenceOverride(template, dateInput) {
  if (template.isActive === false) return null;
  const date = typeof dateInput === "string" ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
  return template.occurrenceOverrides?.find((override) =>
    override.isActive
    && new Date(override.occurrenceDate).toISOString().slice(0, 10) === date
    && override.dayType === template.dayType
    && override.timeSlot === template.timeSlot
    && override.templateRevision === template.occurrenceRevision
  ) || null;
}

export function effectiveMassOccurrence(template, date) {
  const override = activeMassOccurrenceOverride(template, date);
  const layMinisterAssigned = Boolean(template.layMinisterAssigned || override);
  return {
    ...template,
    layMinisterAssigned,
    ...(layMinisterAssigned ? { assignedPriestId: null, assignedPriest: null } : {}),
  };
}

export function massOverrideRange(from, to) {
  return {
    where: { occurrenceDate: { gte: from, lte: to }, isActive: true },
    select: { occurrenceDate: true, dayType: true, timeSlot: true, templateRevision: true, isActive: true },
  };
}
