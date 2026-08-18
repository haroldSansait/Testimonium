/**
 * Canonical Timezone & Date Helpers for Testimonium
 * Canonical Timezone: Asia/Manila (UTC+8)
 */

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
 * Combines date string and optional time string into a canonical Date object.
 */
export function parseEventDateTime(dateStr?: string, timeStr?: string, isEnd = false): Date | null {
  if (!dateStr) return null;
  try {
    // If dateStr contains 'T', extract just date part or parse direct
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

    const d = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  } catch (err) {
    console.warn('[DateUtil] Malformed event date/time:', { dateStr, timeStr, err });
    return null;
  }
}

/**
 * Determines whether an event or mass is upcoming (i.e. has not ended yet).
 * Rule: endDateTime >= now
 */
export function isEventUpcoming(event: {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}): boolean {
  if (!event || event.status === 'completed' || event.status === 'cancelled') {
    return false;
  }

  const now = new Date();
  const targetDateStr = event.endDate || event.startDate;
  const targetTimeStr = event.endTime || event.startTime;

  const endDateTime = parseEventDateTime(targetDateStr, targetTimeStr, !event.endTime);
  if (!endDateTime) {
    // Exclude malformed dates safely
    return false;
  }

  // If event has no endTime specified and only start time: add a reasonable 1-hour duration window
  if (event.startTime && !event.endTime) {
    const startDateTime = parseEventDateTime(event.startDate, event.startTime, false);
    if (startDateTime) {
      const startWithGrace = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      return startWithGrace.getTime() >= now.getTime();
    }
  }

  return endDateTime.getTime() >= now.getTime();
}

/**
 * Calculates a user-friendly countdown label relative to today for a given start date.
 * @param startDateStr The start date string of the event (YYYY-MM-DD).
 * @param startTimeStr Optional start time.
 * @returns A friendly countdown string (e.g. "Today", "Tomorrow", "Starts in 3 days").
 */
export function getEventCountdownLabel(startDateStr: string, startTimeStr?: string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const eventStart = parseEventDateTime(startDateStr, startTimeStr, false);
  if (!eventStart) return 'Upcoming';

  const eventDay = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
  const diffTime = eventDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

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

