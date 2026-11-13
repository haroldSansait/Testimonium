import { Linking, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";

export interface CalendarExportInput {
  uidPrefix?: string;
  id: string | number;
  title: string;
  description?: string | null;
  location?: string | null;
  /** YYYY-MM-DD (or ISO string whose date prefix is authoritative in Manila) */
  date?: string | null;
  /** Clock string like "09:00 AM", "14:00", or range "09:00 AM - 10:30 AM" */
  startTime?: string | null;
  endTime?: string | null;
  /** Authoritative ISO timestamps (when available, e.g. schedules) */
  startDatetime?: string | null;
  endDatetime?: string | null;
}

const MANILA_OFFSET_HOURS = 8;

const pad2 = (n: number) => String(n).padStart(2, "0");

export const parseClockTime = (
  raw?: string | null
): { hour: number; minute: number } | null => {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || trimmed === "TBD") return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3];

  if (minute < 0 || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }
  return { hour, minute };
};

export const parseClockRange = (
  startRaw?: string | null,
  endRaw?: string | null
): {
  start: { hour: number; minute: number } | null;
  end: { hour: number; minute: number } | null;
} => {
  if (startRaw && startRaw.includes("-") && !endRaw) {
    const [left, right] = startRaw.split("-").map((s) => s.trim());
    return {
      start: parseClockTime(left),
      end: parseClockTime(right),
    };
  }
  return {
    start: parseClockTime(startRaw),
    end: parseClockTime(endRaw),
  };
};

const parseDateOnlyParts = (
  dateInput?: string | null
): { year: number; month: number; day: number } | null => {
  if (!dateInput || typeof dateInput !== "string") return null;
  const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

const formatUtcCompact = (d: Date): string =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

const formatDateCompact = (year: number, month: number, day: number): string =>
  `${year}${pad2(month)}${pad2(day)}`;

export interface ResolvedCalendarSpan {
  isAllDay: boolean;
  startUtc?: Date;
  endUtc?: Date;
  startDateCompact: string;
  endDateCompactExclusive: string;
}

export const resolveCalendarSpan = (
  input: CalendarExportInput
): ResolvedCalendarSpan | null => {
  if (input.startDatetime) {
    const start = new Date(input.startDatetime);
    if (!isNaN(start.getTime())) {
      const explicitEnd = input.endDatetime ? new Date(input.endDatetime) : null;
      const end =
        explicitEnd && !isNaN(explicitEnd.getTime()) && explicitEnd.getTime() > start.getTime()
          ? explicitEnd
          : new Date(start.getTime() + 60 * 60 * 1000);
      return {
        isAllDay: false,
        startUtc: start,
        endUtc: end,
        startDateCompact: formatDateCompact(
          start.getUTCFullYear(),
          start.getUTCMonth() + 1,
          start.getUTCDate()
        ),
        endDateCompactExclusive: formatDateCompact(
          end.getUTCFullYear(),
          end.getUTCMonth() + 1,
          end.getUTCDate()
        ),
      };
    }
  }

  const dateParts = parseDateOnlyParts(input.date);
  if (!dateParts) return null;

  const { start: parsedStart, end: parsedEnd } = parseClockRange(
    input.startTime,
    input.endTime
  );

  if (!parsedStart) {
    const startDate = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
    const nextDay = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    return {
      isAllDay: true,
      startDateCompact: formatDateCompact(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate()
      ),
      endDateCompactExclusive: formatDateCompact(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth() + 1,
        nextDay.getUTCDate()
      ),
    };
  }

  const startUtc = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      parsedStart.hour - MANILA_OFFSET_HOURS,
      parsedStart.minute,
      0
    )
  );

  let endUtc: Date;
  if (parsedEnd) {
    const candidateEnd = new Date(
      Date.UTC(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        parsedEnd.hour - MANILA_OFFSET_HOURS,
        parsedEnd.minute,
        0
      )
    );
    endUtc =
      candidateEnd.getTime() > startUtc.getTime()
        ? candidateEnd
        : new Date(startUtc.getTime() + 60 * 60 * 1000);
  } else {
    endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000);
  }

  return {
    isAllDay: false,
    startUtc,
    endUtc,
    startDateCompact: formatDateCompact(dateParts.year, dateParts.month, dateParts.day),
    endDateCompactExclusive: formatDateCompact(dateParts.year, dateParts.month, dateParts.day),
  };
};

export const buildGoogleCalendarUrl = (
  input: CalendarExportInput
): string | null => {
  const span = resolveCalendarSpan(input);
  if (!span) return null;

  const datesParam =
    !span.isAllDay && span.startUtc && span.endUtc
      ? `${formatUtcCompact(span.startUtc)}/${formatUtcCompact(span.endUtc)}`
      : `${span.startDateCompact}/${span.endDateCompactExclusive}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: datesParam,
    ctz: "Asia/Manila",
    details: input.description || "",
    location: input.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

export const buildEventIcsContent = (
  input: CalendarExportInput,
  now: Date = new Date()
): string | null => {
  const span = resolveCalendarSpan(input);
  if (!span) return null;

  const dtStartLine =
    !span.isAllDay && span.startUtc
      ? `DTSTART:${formatUtcCompact(span.startUtc)}`
      : `DTSTART;VALUE=DATE:${span.startDateCompact}`;
  const dtEndLine =
    !span.isAllDay && span.endUtc
      ? `DTEND:${formatUtcCompact(span.endUtc)}`
      : `DTEND;VALUE=DATE:${span.endDateCompactExclusive}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TESTIMONIUM//Parishioner App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uidPrefix || "testimonium"}-${input.id}@testimonium.app`,
    `DTSTAMP:${formatUtcCompact(now)}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];

  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};

export const openGoogleCalendarExport = async (
  input: CalendarExportInput
): Promise<boolean> => {
  const url = buildGoogleCalendarUrl(input);
  if (!url) return false;
  await Linking.openURL(url);
  return true;
};

export const exportIcsCalendarFile = async (
  input: CalendarExportInput
): Promise<{ exported: boolean; method: "opened" | "saved" | "canceled" | "failed" }> => {
  const icsContent = buildEventIcsContent(input);
  if (!icsContent) return { exported: false, method: "failed" };

  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "event";
  const fileName = `${slug}.ics`;

  const cacheDir = new Directory(Paths.cache, "calendar");
  if (!cacheDir.exists) {
    cacheDir.create({ intermediates: true, idempotent: true });
  }
  const file = new File(cacheDir, fileName);
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  file.write(icsContent);

  try {
    const openUri =
      Platform.OS === "android"
        ? await getContentUriAsync(file.uri)
        : file.uri;
    await Linking.openURL(openUri);
    return { exported: true, method: "opened" };
  } catch {
    // Fallback to saving the .ics file to device storage if no direct handler is registered
    try {
      const directory = await Directory.pickDirectoryAsync();
      const destFile = directory.createFile(fileName, "text/calendar");
      destFile.write(icsContent);
      return { exported: true, method: "saved" };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes("cancel")) {
        return { exported: false, method: "canceled" };
      }
      return { exported: false, method: "failed" };
    }
  }
};

