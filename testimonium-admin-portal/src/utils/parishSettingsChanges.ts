export interface ParishConfigSnapshot {
  documentSettings: any;
  eventSettings: any;
  officeHours: any;
  availableDocuments: string[];
  paymentQrEnabled: boolean;
  paymentQrImage: string | null;
  venueCapacity: number | null;
}

export function getParishSettingsChanges(original: ParishConfigSnapshot, current: ParishConfigSnapshot) {
  const changed = (key: keyof ParishConfigSnapshot) => JSON.stringify(original[key]) !== JSON.stringify(current[key]);
  const parishSettings: Partial<Omit<ParishConfigSnapshot, 'eventSettings' | 'officeHours'>> = {};
  for (const key of ['documentSettings', 'availableDocuments', 'paymentQrEnabled', 'paymentQrImage', 'venueCapacity'] as const) {
    if (changed(key)) Object.assign(parishSettings, { [key]: current[key] });
  }
  return { parishSettings, schedulingChanged: changed('eventSettings') || changed('officeHours') };
}
