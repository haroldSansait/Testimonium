/**
 * Timezone and Date Boundary Helpers for Analytics (Asia/Manila UTC+8)
 *
 * Provides strict calendar validation and canonical Manila day-boundary conversions.
 */

export function isValidStrictManilaDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime())) return false;
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    return false;
  }
  return true;
}

export function getManilaTodayDateString(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function advanceCalendarDay(dateStr, days = 1) {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr) + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function manilaDateToUtcStart(dateStr) {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  // Asia/Manila is standard time UTC+8 with no DST.
  // Manila 00:00:00 equals UTC 16:00:00 on the previous calendar day (-8 hours).
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000);
}

export function getCalendarDayRange(fromStr, toStr) {
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000)) + 1;
}

export function deriveManilaPaymentBoundaries(queryFrom, queryTo, now = new Date()) {
  const manilaToday = getManilaTodayDateString(now);
  const fromStr = queryFrom || advanceCalendarDay(manilaToday, -364);
  const toStr = queryTo || manilaToday;

  const paymentFrom = manilaDateToUtcStart(fromStr);
  const paymentToExclusive = manilaDateToUtcStart(advanceCalendarDay(toStr, 1));

  return {
    fromStr,
    toStr,
    paymentFrom,
    paymentToExclusive,
  };
}
