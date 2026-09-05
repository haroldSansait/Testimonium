import type {
  DateRuleMode,
  ParishWeekdayRule,
  ScheduleAvailabilityConfiguration,
  ScheduleDateRule,
  ServiceWeekdayRule,
  Weekday,
} from '@/api/scheduleAvailabilityApi';

export interface WeekdayOption {
  value: Weekday;
  label: string;
  shortLabel: string;
}

export const WEEKDAYS: WeekdayOption[] = [
  { value: 'MONDAY', label: 'Monday', shortLabel: 'Mon' },
  { value: 'TUESDAY', label: 'Tuesday', shortLabel: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wednesday', shortLabel: 'Wed' },
  { value: 'THURSDAY', label: 'Thursday', shortLabel: 'Thu' },
  { value: 'FRIDAY', label: 'Friday', shortLabel: 'Fri' },
  { value: 'SATURDAY', label: 'Saturday', shortLabel: 'Sat' },
  { value: 'SUNDAY', label: 'Sunday', shortLabel: 'Sun' },
];

export interface CanonicalServiceOption {
  id: string;
  label: string;
  category: 'Sacrament' | 'Mass' | 'Other';
}

export const CANONICAL_SCHEDULING_SERVICES: CanonicalServiceOption[] = [
  { id: 'WEDDING', label: 'Marriage (Canonical Interview)', category: 'Sacrament' },
  { id: 'MARRIAGE_SPECIAL', label: 'Marriage (Special)', category: 'Sacrament' },
  { id: 'BAPTISM', label: 'Baptism', category: 'Sacrament' },
  { id: 'CONFIRMATION', label: 'Confirmation', category: 'Sacrament' },
  { id: 'FIRST_COMMUNION', label: 'First Communion', category: 'Sacrament' },
  { id: 'CONFESSION', label: 'Confession', category: 'Sacrament' },
  { id: 'ANOINTING_OF_THE_SICK', label: 'Anointing of the Sick', category: 'Sacrament' },
  { id: 'PRIVATE_MASS', label: 'Mass', category: 'Mass' },
  { id: 'MASS_INTENTION', label: 'Mass Intention', category: 'Mass' },
  { id: 'WAKE_MASS', label: 'Wake Mass', category: 'Mass' },
  { id: 'FUNERAL', label: 'Funeral', category: 'Mass' },
  { id: 'MASS_OF_HOLY_SPIRIT', label: 'Mass of the Holy Spirit', category: 'Mass' },
  { id: 'FIESTA', label: 'Fiesta', category: 'Other' },
  { id: 'THANKSGIVING', label: 'Thanksgiving', category: 'Other' },
  { id: 'BLESSING', label: 'Blessing', category: 'Other' },
  { id: 'DELIVERANCE', label: 'Deliverance', category: 'Other' },
];

export interface DateExceptionDraft {
  editingRuleId: number | null;
  date: string;
  baseMode: DateRuleMode;
  reason: string;
  serviceOverrides: Record<string, 'AVAILABLE' | 'UNAVAILABLE'>;
}

export function normalizeParishRules(rules: ParishWeekdayRule[] = []): Record<Weekday, boolean> {
  const map: Record<Weekday, boolean> = {
    MONDAY: false,
    TUESDAY: false,
    WEDNESDAY: false,
    THURSDAY: false,
    FRIDAY: false,
    SATURDAY: false,
    SUNDAY: false,
  };
  for (const rule of rules) {
    if (rule?.weekday && rule.weekday in map) {
      map[rule.weekday] = Boolean(rule.isAvailable);
    }
  }
  return map;
}

export function areParishRulesEqual(a: ParishWeekdayRule[] = [], b: ParishWeekdayRule[] = []): boolean {
  const mapA = normalizeParishRules(a);
  const mapB = normalizeParishRules(b);
  for (const day of WEEKDAYS) {
    if (mapA[day.value] !== mapB[day.value]) return false;
  }
  return true;
}

export function normalizeServiceRules(rules: ServiceWeekdayRule[] = []): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const rule of rules) {
    if (rule?.eventType && rule?.weekday) {
      const key = `${rule.eventType}:${rule.weekday}`;
      map.set(key, Boolean(rule.isAvailable));
    }
  }
  return map;
}

export function areServiceRulesEqual(a: ServiceWeekdayRule[] = [], b: ServiceWeekdayRule[] = []): boolean {
  const mapA = normalizeServiceRules(a);
  const mapB = normalizeServiceRules(b);
  if (mapA.size !== mapB.size) return false;
  for (const [key, valA] of mapA.entries()) {
    if (!mapB.has(key) || mapB.get(key) !== valA) return false;
  }
  return true;
}

export function isWeeklyAvailabilityDirty(
  draftParishRules: ParishWeekdayRule[],
  draftServiceRules: ServiceWeekdayRule[],
  baseline: ScheduleAvailabilityConfiguration | null
): boolean {
  if (!baseline) return false;
  const parishDirty = !areParishRulesEqual(draftParishRules, baseline.weekdayRules);
  const serviceDirty = !areServiceRulesEqual(draftServiceRules, baseline.serviceWeekdayRules);
  return parishDirty || serviceDirty;
}

export function isDateExceptionDraftActive(
  draft: DateExceptionDraft | null,
  existingRules: ScheduleDateRule[] = []
): boolean {
  if (!draft) return false;

  // New exception in progress
  if (draft.editingRuleId === null) {
    return (
      draft.date.trim().length > 0 ||
      draft.baseMode !== 'INHERIT' ||
      draft.reason.trim().length > 0 ||
      Object.keys(draft.serviceOverrides).length > 0
    );
  }

  // Editing an existing exception
  const original = existingRules.find((r) => r.id === draft.editingRuleId);
  if (!original) return true;

  const originalDate = original.exceptionDate.slice(0, 10);
  const originalReason = original.reason || '';
  const originalBaseMode = original.baseMode;

  if (draft.date !== originalDate) return true;
  if (draft.baseMode !== originalBaseMode) return true;
  if (draft.reason.trim() !== originalReason.trim()) return true;

  // Compare service overrides
  const originalOverridesMap: Record<string, string> = {};
  for (const ov of original.serviceOverrides || []) {
    originalOverridesMap[ov.eventType] = ov.mode;
  }

  const draftKeys = Object.keys(draft.serviceOverrides);
  const origKeys = Object.keys(originalOverridesMap);
  if (draftKeys.length !== origKeys.length) return true;

  for (const key of draftKeys) {
    if (draft.serviceOverrides[key] !== originalOverridesMap[key]) return true;
  }

  return false;
}

export function formatFriendlyDate(dateStr: string): { formatted: string; weekdayName: string } {
  if (!dateStr) return { formatted: '', weekdayName: '' };
  try {
    const cleanDate = dateStr.slice(0, 10);
    const [year, month, day] = cleanDate.split('-').map(Number);
    if (!year || !month || !day) return { formatted: dateStr, weekdayName: '' };
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatted = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const weekdayName = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });
    return { formatted, weekdayName };
  } catch {
    return { formatted: dateStr, weekdayName: '' };
  }
}

export function cloneScheduleConfiguration(
  config: ScheduleAvailabilityConfiguration
): ScheduleAvailabilityConfiguration {
  return {
    id: config.id,
    schedulingConfigVersion: config.schedulingConfigVersion,
    weekdayRules: config.weekdayRules.map((r) => ({ ...r })),
    serviceWeekdayRules: config.serviceWeekdayRules.map((r) => ({ ...r })),
    scheduleDateRules: config.scheduleDateRules.map((r) => ({
      ...r,
      serviceOverrides: r.serviceOverrides.map((o) => ({ ...o })),
    })),
  };
}
