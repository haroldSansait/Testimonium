// IDs and labels mirror SettingsPage.EVENT_TYPES; certificate requirements are separate.
export const SCHEDULE_REQUIREMENTS = {
  WEDDING: [['cenomar', 'CENOMAR'], ['marriage_license', 'Marriage License'], ['baptismal_cert', 'Baptismal Certificate']],
  MARRIAGE_SPECIAL: [['cenomar', 'CENOMAR'], ['marriage_license', 'Marriage License'], ['baptismal_cert', 'Baptismal Certificate']],
  BAPTISM: [['marriage_cert', 'Marriage Certificate'], ['birth_cert', 'Birth Certificate / Immunization Card']],
  CONFIRMATION: [['baptismal_cert', 'Baptismal Certificate']],
  WAKE_MASS: [['death_cert', 'Death Certificate']],
  FUNERAL: [['death_cert', 'Death Certificate']],
};

export function getScheduleRequirements(parish, eventType) {
  let settings = parish?.eventSettings;
  if (typeof settings === 'string') {
    try { settings = JSON.parse(settings); } catch { settings = null; }
  }
  return (SCHEDULE_REQUIREMENTS[eventType] || [])
    .filter(([id]) => settings?.[eventType]?.requirements?.[id] === true)
    .map(([id, label]) => ({ id, label }));
}

export function validateScheduleRequirements(parish, eventType, attachments) {
  const required = getScheduleRequirements(parish, eventType);
  const ids = attachments.map((attachment) => attachment.requirementId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !required.some((r) => r.id === id)) ||
      required.some((r) => !ids.includes(r.id))) {
    const error = new Error('Scheduling requirements changed or required uploads are missing. Review the current requirements and try again.');
    error.statusCode = 409;
    error.code = 'SCHEDULE_REQUIREMENTS_CHANGED';
    throw error;
  }
  return required;
}
