/**
 * calendarExport.ts
 *
 * Utility functions for exporting calendar events to external calendar applications.
 *
 * Supports:
 *   - RFC 5545-compliant .ics file download
 *   - Google Calendar deep-link (single event)
 *
 * Design:
 *   - Pure utility — no side effects. Callers are responsible for triggering
 *     the download/navigation and showing feedback toasts.
 *   - No additional library dependencies. ICS is constructed from raw string
 *     formatting following RFC 5545 §3.2.
 */

import type { CalendarEvent } from '@/types';

// ─── ICS Generation ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Converts a CalendarEvent's human-readable time string (e.g. "9:00 AM")
 * to a 24-hour HHmmss string for ICS DTSTART/DTEND.
 */
function parseTimeToHHmmss(timeStr: string | undefined): string {
  if (!timeStr) return '090000';
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '090000';
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    '00',
  ].join('');
}

/**
 * Formats a CalendarEvent date components (year, month, day) + time string
 * to a compact UTC datetime string: YYYYMMDDTHHmmssZ
 *
 * NOTE: Since all events are parish-local (Philippines, UTC+8), we use a
 * floating-time format (no trailing Z) so the ICS consumer respects the
 * local timezone. This avoids the need for VTIMEZONE entries.
 */
function toIcsDtstart(event: CalendarEvent): string {
  const year = String(event.year);
  const month = String(event.month + 1).padStart(2, '0');
  const day = String(event.day).padStart(2, '0');
  const time = parseTimeToHHmmss(event.time);
  return `${year}${month}${day}T${time}`;
}

/**
 * Builds a DTSTAMP in the format required by RFC 5545: YYYYMMDDTHHMMSSZ (UTC now).
 */
function buildDtStamp(): string {
  const now = new Date();
  return (
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z'
  );
}

/**
 * Folds long ICS property lines per RFC 5545 §3.1 (max 75 octets per line).
 * Long lines are split with CRLF + single space continuation.
 */
function fold(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let result = '';
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      result += line.slice(0, MAX);
      pos = MAX;
    } else {
      result += '\r\n ' + line.slice(pos, pos + MAX - 1);
      pos += MAX - 1;
    }
  }
  return result;
}

/**
 * Escapes ICS text-value characters per RFC 5545 §3.3.11.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Builds a single VEVENT block for one CalendarEvent.
 */
function buildVEvent(event: CalendarEvent, uid: string): string {
  const dtstart = toIcsDtstart(event);
  const dtend = dtstart; // Single-event; same day, no specified duration
  const dtStamp = buildDtStamp();
  const summary = escapeIcsText(event.title || 'Parish Event');
  const location = escapeIcsText(event.parish || 'Parish Main Church');
  const description = escapeIcsText(
    [event.description, event.priest ? `Assigned Priest: ${event.priest}` : '']
      .filter(Boolean)
      .join(' | ')
  );

  const lines = [
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    fold(`DTSTAMP:${dtStamp}`),
    fold(`DTSTART:${dtstart}`),
    fold(`DTEND:${dtend}`),
    fold(`SUMMARY:${summary}`),
    fold(`LOCATION:${location}`),
    description ? fold(`DESCRIPTION:${description}`) : '',
    'END:VEVENT',
  ].filter(Boolean);

  return lines.join('\r\n');
}

/**
 * Generates and triggers a browser download of an RFC 5545-compliant .ics file
 * containing all events for the given month/year.
 *
 * @param events - Array of CalendarEvent objects for the displayed month
 * @param year   - The calendar year displayed
 * @param month  - The calendar month displayed (0-indexed)
 * @returns true on success, false if no events to export
 */
export function downloadIcsFile(events: CalendarEvent[], year: number, month: number): boolean {
  if (!events || events.length === 0) return false;

  const monthName = MONTH_NAMES[month];
  const vEvents = events.map((event, idx) =>
    buildVEvent(event, `testimonium-${year}-${month + 1}-${idx + 1}@testimonium.parish`)
  );

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TESTIMONIUM//Parish Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:Parish Calendar — ${monthName} ${year}`),
    'X-WR-TIMEZONE:Asia/Manila',
    ...vEvents,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `testimonium-calendar-${year}-${String(month + 1).padStart(2, '0')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// ─── Google Calendar Deep-link ─────────────────────────────────────────────────

/**
 * Constructs a Google Calendar "Add Event" deep-link for a single CalendarEvent.
 * Uses the `action=TEMPLATE` URL format supported by Google Calendar.
 *
 * @param event - The CalendarEvent to open in Google Calendar
 * @returns A fully-formed Google Calendar URL string
 */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const year = String(event.year);
  const month = String(event.month + 1).padStart(2, '0');
  const day = String(event.day).padStart(2, '0');
  const startTime = parseTimeToHHmmss(event.time);
  // Default event duration: 1 hour
  const endHour = String(parseInt(startTime.slice(0, 2), 10) + 1).padStart(2, '0');
  const endTime = endHour + startTime.slice(2);

  const dates = `${year}${month}${day}T${startTime}/${year}${month}${day}T${endTime}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Parish Event',
    dates,
    details: [
      event.description || '',
      event.priest ? `Assigned Priest: ${event.priest}` : '',
    ].filter(Boolean).join('\n'),
    location: event.parish || 'Parish Main Church',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Returns the upcoming event in the events array (the first event whose date
 * is on or after today), or the first event if all are in the past.
 * Used to pre-select the Google Calendar link target.
 */
export function getUpcomingEvent(events: CalendarEvent[], year: number, month: number): CalendarEvent | null {
  if (!events || events.length === 0) return null;
  const today = new Date();
  const upcoming = events.find((e) => {
    const eventDate = new Date(year, month, e.day);
    return eventDate >= today;
  });
  return upcoming || events[0];
}
