import type { PublicEventDto, MonthParams } from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Returns current local year and month (1-12)
 */
export const getCurrentLocalMonthParams = (baseDate = new Date()): MonthParams => {
  return {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth() + 1,
  };
};

/**
 * Parses YYYY-MM-DD from an eventDate string safely without UTC timezone shift.
 * Resilient against null, undefined, and malformed inputs.
 */
export const parseEventDateOnly = (
  dateInput?: string | null
): { year: number; month: number; day: number; dateKey: string } => {
  if (!dateInput || typeof dateInput !== "string") {
    return { year: 0, month: 0, day: 0, dateKey: "" };
  }

  // Handle ISO string or YYYY-MM-DD
  const datePart = dateInput.split("T")[0];
  const parts = datePart.split("-");

  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (
      !isNaN(year) &&
      !isNaN(month) &&
      !isNaN(day) &&
      year > 0 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const paddedMonth = String(month).padStart(2, "0");
      const paddedDay = String(day).padStart(2, "0");
      return {
        year,
        month,
        day,
        dateKey: `${year}-${paddedMonth}-${paddedDay}`,
      };
    }
  }

  // Fallback to local date extraction
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return { year: 0, month: 0, day: 0, dateKey: "" };
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return {
    year,
    month,
    day,
    dateKey: `${year}-${paddedMonth}-${paddedDay}`,
  };
};

/**
 * Formats calendar date into a human readable string (e.g. "Sat, Aug 25" or "August 25, 2026")
 */
export const formatEventDate = (
  dateInput?: string | null,
  style: "short" | "full" = "short"
): string => {
  const { year, month, day, dateKey } = parseEventDateOnly(dateInput);
  if (!dateKey || year === 0) {
    return "Date to be announced";
  }

  const monthName = MONTH_NAMES[month - 1] || "";
  const shortMonth = monthName.slice(0, 3);

  // Construct a date in local time to get day of week
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_NAMES[localDate.getDay()] || "";

  if (style === "full") {
    return `${monthName} ${day}, ${year}`;
  }

  return `${dayOfWeek}, ${shortMonth} ${day}`;
};

/**
 * Formats time range cleanly without inventing missing data.
 */
export const formatEventTime = (
  startTime?: string | null,
  endTime?: string | null
): string | null => {
  if (!startTime && !endTime) return null;
  if (startTime && endTime && startTime !== endTime) {
    return `${startTime} - ${endTime}`;
  }
  return startTime || endTime || null;
};

/**
 * Filters events by current local calendar date (removes events earlier than today's local date)
 */
export const filterUpcomingEvents = (
  events: PublicEventDto[],
  today = new Date()
): PublicEventDto[] => {
  if (!Array.isArray(events)) return [];

  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
  const todayDay = String(today.getDate()).padStart(2, "0");
  const todayKey = `${todayYear}-${todayMonth}-${todayDay}`;

  return events.filter((event) => {
    if (!event || !event.eventDate) return false;
    const { dateKey } = parseEventDateOnly(event.eventDate);
    return dateKey !== "" && dateKey >= todayKey;
  });
};

/**
 * Converts a time string like "06:00 AM", "4:30 PM", or "14:00" to total minutes from midnight.
 */
export const parseTimeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim().toUpperCase();

  const isPM = trimmed.includes("PM");
  const isAM = trimmed.includes("AM");

  const cleanTime = trimmed.replace(/[^\d:]/g, "");
  const [hourStr, minStr] = cleanTime.split(":");
  let hours = parseInt(hourStr, 10) || 0;
  const minutes = parseInt(minStr, 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

/**
 * Sorts events chronologically by date and start time.
 */
export const sortEventsChronologically = (
  events: PublicEventDto[]
): PublicEventDto[] => {
  if (!Array.isArray(events)) return [];

  return [...events].sort((a, b) => {
    const dateA = parseEventDateOnly(a?.eventDate).dateKey;
    const dateB = parseEventDateOnly(b?.eventDate).dateKey;
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const minutesA = parseTimeToMinutes(a?.startTime);
    const minutesB = parseTimeToMinutes(b?.startTime);
    return minutesA - minutesB;
  });
};

/**
 * Filters events matching a specific parish ID.
 */
export const filterEventsByParish = (
  events: PublicEventDto[],
  parishId: string | number
): PublicEventDto[] => {
  if (!Array.isArray(events)) return [];
  const numericId = typeof parishId === "number" ? parishId : parseInt(parishId, 10);
  if (isNaN(numericId)) return [];
  return events.filter((e) => e && e.parishId === numericId);
};
