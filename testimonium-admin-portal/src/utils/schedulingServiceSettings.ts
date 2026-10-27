/**
 * Pure helpers for the Admin "Offered Sacraments & Ceremonies" draft.
 *
 * A parish that has never saved scheduling settings has NO `availableEvents`
 * array. That must be shown as "not configured" (nothing enabled) — never as
 * "everything enabled" — otherwise the UI promises services that the saved
 * payload does not contain and the backend rejects the save.
 */

/** True only when the parish carries a real, explicit enabled-services list. */
export function hasExplicitServiceList(eventSettings: any): boolean {
  return Array.isArray(eventSettings?.availableEvents);
}

/** Enabled service ids. Unconfigured parishes expose an empty list. */
export function getEnabledServiceIds(eventSettings: any): string[] {
  return hasExplicitServiceList(eventSettings) ? eventSettings.availableEvents : [];
}

/** Toggle one service, initialising a real array for legacy parishes. */
export function toggleServiceSetting(prev: any, serviceId: string): any {
  const current = getEnabledServiceIds(prev);
  const availableEvents = current.includes(serviceId)
    ? current.filter((id) => id !== serviceId)
    : [...current, serviceId];
  return { ...prev, availableEvents };
}

/** Enable/disable many services, initialising a real array for legacy parishes. */
export function bulkToggleServiceSettings(prev: any, targetIds: string[], enable: boolean): any {
  const current = getEnabledServiceIds(prev);
  const availableEvents = enable
    ? Array.from(new Set([...current, ...targetIds]))
    : current.filter((id) => !targetIds.includes(id));
  return { ...prev, availableEvents };
}

/**
 * Client-side pre-flight for a scheduling save. Returns an actionable message,
 * or null when the draft can be sent to the backend.
 */
export function validateSchedulingDraftForSave(eventSettings: any): string | null {
  if (!hasExplicitServiceList(eventSettings)) {
    return (
      'No offered services have been configured for this parish yet. ' +
      'Open "Offered Sacraments & Ceremonies", use Enable All or switch on the services you offer, then save again.'
    );
  }
  const capacity = eventSettings?.capacitySettings;
  const positive = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
  if (!positive(capacity?.dailyLimit) || !positive(capacity?.slotCapacity)) {
    return 'Set a daily limit and a per-slot capacity (whole numbers of 1 or more) before saving scheduling settings.';
  }
  return null;
}

/**
 * Payload form of the draft. A parish with no time slots yet is sent an empty
 * list (what the UI already displays) instead of a missing field; the draft
 * itself is never mutated.
 */
export function prepareSchedulingSettingsForSave(eventSettings: any): any {
  return {
    ...eventSettings,
    timeSlots: Array.isArray(eventSettings?.timeSlots) ? eventSettings.timeSlots : [],
  };
}
