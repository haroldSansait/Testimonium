import { getManilaDateString } from "../ConflictHelper.js";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const addCalendarDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function manilaClock(now = new Date()) {
  const date = getManilaDateString(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return { date, weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()], time, timeZone: "Asia/Manila" };
}

export function calendarWeek(date, next = false) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const startDate = addCalendarDays(date, -((day + 6) % 7) + (next ? 7 : 0));
  return { startDate, endDate: addCalendarDays(startDate, 6) };
}

// Office hours are independent of liturgical and appointment schedules. Unknown
// or malformed entries never establish a closure.
function minutes(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].toLowerCase() === "pm" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + Number(match[2] || 0);
}

export function resolveOfficeDay(rawHours, date, now = new Date()) {
  const clock = manilaClock(now);
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  let hours = rawHours;
  if (typeof hours === "string") { try { hours = JSON.parse(hours); } catch { hours = null; } }
  const entry = hours && typeof hours === "object"
    ? Object.entries(hours).find(([key]) => key.toLowerCase() === weekday.toLowerCase())?.[1]
    : null;
  const result = { date, weekday, status: "UNKNOWN", currentStatus: "UNKNOWN", opensAt: null, closesAt: null, basis: "Configured weekly office hours; date-specific exceptions are not recorded here." };
  if (entry?.isClosed === true || (typeof entry === "string" && /^closed$/i.test(entry.trim()))) {
    return { ...result, status: "CLOSED", currentStatus: date === clock.date ? "CLOSED" : "NOT_APPLICABLE" };
  }
  let open = entry?.openTime ?? entry?.open, close = entry?.closeTime ?? entry?.close;
  if (typeof entry === "string") {
    const range = entry.split(/\s*(?:-|–|—|\bto\b)\s*/i);
    if (range.length === 2) [open, close] = range;
  }
  const start = minutes(open), end = minutes(close);
  if (start === null || end === null || end <= start) return result;
  const current = minutes(clock.time);
  return { ...result, status: "OPEN", currentStatus: date === clock.date ? (current >= start && current < end ? "OPEN" : "CLOSED") : "NOT_APPLICABLE", opensAt: open, closesAt: close };
}
