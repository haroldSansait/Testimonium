/**
 * Canonical Timezone & Date Helpers for Testimonium Admin Portal
 * Canonical Timezone: Asia/Manila (UTC+8)
 */

/**
 * Returns a YYYY-MM-DD date string in Asia/Manila (UTC+8) timezone.
 */
export function getManilaTodayDateString(dateInput: Date | string | number = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Determines whether a YYYY-MM-DD date string is strictly before today in Asia/Manila timezone.
 */
export function isBeforeManilaToday(dateStr: string, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const todayStr = getManilaTodayDateString(now);
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  return cleanDateStr < todayStr;
}

/**
 * Converts a 12-hour format string (e.g. "09:00 AM", "12:30 PM", "6:00 PM")
 * to a 24-hour "HH:mm" string for HTML time input.
 */
export function to24Hour(time12h?: string | null): string {
  if (!time12h || typeof time12h !== 'string') return '';
  const clean = time12h.trim();
  if (!clean) return '';
  // Check if it's already HH:mm
  const match24 = clean.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  }
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match12) return '';
  let hour = parseInt(match12[1], 10);
  const minute = match12[2];
  const ampm = match12[3].toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

/**
 * Converts a 24-hour format string (e.g. "09:00", "18:30")
 * to a 12-hour "hh:mm AM/PM" string for backend API payload.
 */
export function to12Hour(time24h?: string | null): string {
  if (!time24h || typeof time24h !== 'string') return '';
  const clean = time24h.trim();
  if (!clean) return '';
  // Check if it's already 12h format
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    return `${match12[1].padStart(2, '0')}:${match12[2]} ${match12[3].toUpperCase()}`;
  }
  const match24 = clean.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match24) return '';
  let hour = parseInt(match24[1], 10);
  const minute = match24[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
}

/**
 * Validates that end time is strictly after start time when both are provided.
 */
export function isValidTimeRange(start24?: string | null, end24?: string | null): boolean {
  if (!start24 || !end24) return true;
  return end24 > start24;
}

/**
 * Formats an ISO datetime string into human-readable Manila wall-clock date and time.
 * Explicitly uses Asia/Manila timezone.
 * Returns a fallback '—' on null, undefined, or invalid date values.
 */
export function formatManilaDateTime(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(d);
  } catch {
    return '—';
  }
}

/**
 * Derives a Manila-safe default 365-day (from = today - 364 days, to = today) date range.
 * Uses calendar-day arithmetic in Asia/Manila, avoiding UTC toISOString derivations.
 */
export function getManilaDefaultDateRange(now: Date = new Date()): { from: string; to: string } {
  const to = getManilaTodayDateString(now);
  if (!to) {
    const fallback = new Date().toISOString().slice(0, 10);
    return { from: fallback, to: fallback };
  }
  const [y, m, d] = to.split('-').map(Number);
  const fromDate = new Date(Date.UTC(y, m - 1, d - 364));
  const fromY = fromDate.getUTCFullYear();
  const fromM = String(fromDate.getUTCMonth() + 1).padStart(2, '0');
  const fromD = String(fromDate.getUTCDate()).padStart(2, '0');
  return {
    from: `${fromY}-${fromM}-${fromD}`,
    to,
  };
}

export type DatePresetKey = '7d' | '1m' | '6m' | '1y';

export const DATE_PRESET_LABELS: Record<DatePresetKey, string> = {
  '7d': '7 Days',
  '1m': '1 Month',
  '6m': '6 Months',
  '1y': '1 Year',
};

/**
 * Derives Asia/Manila calendar date ranges for quick presets:
 * - 7 Days: today inclusive + previous 6 calendar days (7 total days)
 * - 1 Month: today inclusive + previous 1 calendar month
 * - 6 Months: today inclusive + previous 6 calendar months
 * - 1 Year: canonical 365-day range (today inclusive + previous 364 calendar days)
 */
export function getManilaPresetRange(
  preset: DatePresetKey,
  now: Date = new Date()
): { from: string; to: string } {
  const to = getManilaTodayDateString(now);
  if (!to) {
    return getManilaDefaultDateRange(now);
  }
  const [y, m, d] = to.split('-').map(Number);

  if (preset === '7d') {
    const fromDate = new Date(Date.UTC(y, m - 1, d - 6));
    const fromY = fromDate.getUTCFullYear();
    const fromM = String(fromDate.getUTCMonth() + 1).padStart(2, '0');
    const fromD = String(fromDate.getUTCDate()).padStart(2, '0');
    return { from: `${fromY}-${fromM}-${fromD}`, to };
  }

  if (preset === '1m') {
    let targetYear = y;
    let targetMonth = m - 1;
    if (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const maxDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const targetDay = Math.min(d, maxDays);
    const fromM = String(targetMonth).padStart(2, '0');
    const fromD = String(targetDay).padStart(2, '0');
    return { from: `${targetYear}-${fromM}-${fromD}`, to };
  }

  if (preset === '6m') {
    let targetYear = y;
    let targetMonth = m - 6;
    if (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const maxDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const targetDay = Math.min(d, maxDays);
    const fromM = String(targetMonth).padStart(2, '0');
    const fromD = String(targetDay).padStart(2, '0');
    return { from: `${targetYear}-${fromM}-${fromD}`, to };
  }

  return getManilaDefaultDateRange(now);
}

/**
 * Checks if the current from/to range matches one of the canonical presets.
 * Returns the matching DatePresetKey, or 'custom' if manually changed.
 */
export function getActiveDatePreset(
  from: string,
  to: string,
  now: Date = new Date()
): DatePresetKey | 'custom' {
  const presets: DatePresetKey[] = ['7d', '1m', '6m', '1y'];
  for (const p of presets) {
    const range = getManilaPresetRange(p, now);
    if (range.from === from && range.to === to) {
      return p;
    }
  }
  return 'custom';
}

/**
 * Formats daily average without rounding small non-zero values to 0.0/day.
 * - >= 10: 1 decimal where useful (or integer)
 * - 1–9.99: 1 decimal
 * - 0.1–0.99: 2 decimals
 * - 0.01–0.099: 2 or 3 meaningful decimals (e.g. 11 / 365 = 0.03/day)
 * - < 0.01: 3 decimals
 */
export function formatDailyAverage(total: number, days: number): string {
  if (days <= 0 || total <= 0) return '0.0';
  const val = total / days;
  if (val >= 10) {
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }
  if (val >= 1) {
    return val.toFixed(1);
  }
  if (val >= 0.1) {
    return val.toFixed(2);
  }
  if (val >= 0.01) {
    const s2 = val.toFixed(2);
    return Number(s2) > 0 ? s2 : val.toFixed(3);
  }
  return val.toFixed(3);
}


