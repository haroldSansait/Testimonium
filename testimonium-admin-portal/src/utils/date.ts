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
