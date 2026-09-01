/**
 * Canonical Timezone & Date Helpers for Testimonium
 * Canonical Timezone: Asia/Manila (UTC+8)
 */

/**
 * Gets the current or specified date formatted as YYYY-MM-DD in Asia/Manila timezone.
 */
export function getManilaCalendarDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Adds calendar days safely to a YYYY-MM-DD string without local timezone shifting.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const parts = (dateStr || '').split('T')[0].split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a rolling window of windowDays starting from todayStr crosses into the next calendar month.
 */
export function isWindowCrossMonth(todayStr: string, windowDays: number = 7): boolean {
  const endStr = addCalendarDays(todayStr, windowDays - 1);
  return todayStr.slice(0, 7) !== endStr.slice(0, 7);
}

/**
 * Safely formats a YYYY-MM-DD event date string into localized text without UTC timezone shifting.
 */
export function formatEventCalendarDate(
  dateStr?: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-');
  if (parts.length < 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const d = new Date(year, month, day);
  return d.toLocaleDateString([], options);
}

/**
 * Parses time string (e.g., "08:00 AM", "17:30", "5:00 PM") into { hours, minutes }
 */
export function parseTimeString(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/**
 * Combines a Philippine parish date and optional time string into an instant.
 */
export function parseEventDateTime(dateStr?: string, timeStr?: string, isEnd = false): Date | null {
  if (!dateStr) return null;
  try {
    const baseDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = baseDate.split('-');
    if (parts.length < 3) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const parsedTime = parseTimeString(timeStr);
    const hours = parsedTime ? parsedTime.hours : (isEnd ? 23 : 0);
    const minutes = parsedTime ? parsedTime.minutes : (isEnd ? 59 : 0);

    // Asia/Manila is UTC+08:00 year round. Date-only parish event values must
    // not be interpreted in the browser's local timezone.
    const d = new Date(Date.UTC(year, month, day, hours - 8, minutes, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  } catch (err) {
    console.warn('[DateUtil] Malformed event date/time:', { dateStr, timeStr, err });
    return null;
  }
}

/**
 * Determines whether an event or mass is upcoming (calendar-day based in Manila authority).
 * An event scheduled TODAY remains eligible even if its start time has already passed.
 * Cancelled or completed status events are excluded.
 */
export function isEventUpcoming(
  event: {
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
  },
  referenceDate?: Date
): boolean {
  if (!event || event.status === 'completed' || event.status === 'cancelled') {
    return false;
  }

  const todayStr = getManilaCalendarDate(referenceDate);
  const targetDateStr = (event.endDate || event.startDate || '').split('T')[0];
  if (!targetDateStr) return false;

  return targetDateStr >= todayStr;
}

/**
 * Checks whether an event falls within the rolling 7-calendar-day window [today, today + 6 days]
 * in Asia/Manila calendar authority.
 */
export function isEventInRolling7Days(
  event: {
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
  },
  referenceDate?: Date
): boolean {
  if (!isEventUpcoming(event, referenceDate)) {
    return false;
  }

  const todayStr = getManilaCalendarDate(referenceDate);
  const maxDateStr = addCalendarDays(todayStr, 6);

  const eventStartStr = (event.startDate || '').split('T')[0];
  const eventEndStr = (event.endDate || event.startDate || '').split('T')[0];

  if (!eventStartStr) return false;

  // The event must overlap with [todayStr, maxDateStr] and start on or before maxDateStr
  return eventEndStr >= todayStr && eventStartStr <= maxDateStr;
}

/**
 * Calculates a user-friendly countdown label relative to today for a given start date.
 * @param startDateStr The start date string of the event (YYYY-MM-DD).
 * @param startTimeStr Optional start time.
 * @param referenceDate Optional reference date (defaults to current Manila date).
 * @returns A friendly countdown string (e.g. "Happening Today", "Tomorrow", "In 3 days").
 */
export function getEventCountdownLabel(
  startDateStr: string,
  _startTimeStr?: string,
  referenceDate?: Date
): string {
  const todayStr = getManilaCalendarDate(referenceDate);
  const cleanDate = (startDateStr || '').split('T')[0];
  if (!cleanDate) return 'Upcoming';

  const [y1, m1, d1] = todayStr.split('-').map(Number);
  const [y2, m2, d2] = cleanDate.split('-').map(Number);

  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) {
    return 'Upcoming';
  }

  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Happening Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays < -1) {
    return 'Completed';
  } else {
    return `In ${diffDays} days`;
  }
}

