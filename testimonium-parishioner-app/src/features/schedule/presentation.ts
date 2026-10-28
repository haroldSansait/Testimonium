import type { ScheduleItem, ScheduleStatus } from "./types";
import { getScheduleEventLabel } from "./types";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Normalizes remarks identically to the backend canonical hash logic:
 * trims outer whitespace only (does not collapse internal whitespace).
 */
export const normalizeScheduleRemarks = (remarks?: string | null): string => {
  if (!remarks || typeof remarks !== "string") return "";
  return remarks.trim();
};

/**
 * Builds the canonical signature for a schedule creation payload.
 * Accounts for parishId, eventType, requestedDate, timeSlot, normalized remarks,
 * requestedPriestId, and prerequisite upload signature.
 */
export const makeSchedulePayloadSignature = (payload: {
  parishId: number | string;
  eventType: string;
  date: string;
  timeSlot: string;
  remarks?: string | null;
  requestedPriestId?: number | null;
  uploadSignature?: string;
}): string => {
  const normParish = Number(payload.parishId);
  const normEvent = String(payload.eventType || "").toUpperCase().trim();
  const normDate = String(payload.date || "").split("T")[0].trim();
  const normSlot = String(payload.timeSlot || "").trim().toUpperCase();
  const normRemarks = normalizeScheduleRemarks(payload.remarks);
  const normPriest = payload.requestedPriestId ? String(payload.requestedPriestId) : "";
  const uploadSig = payload.uploadSignature ? payload.uploadSignature.trim() : "";
  return uploadSig
    ? `${normParish}|${normEvent}|${normDate}|${normSlot}|${normRemarks}|${normPriest}|${uploadSig}`
    : `${normParish}|${normEvent}|${normDate}|${normSlot}|${normRemarks}|${normPriest}`;
};

/**
 * Extracts year, month, day safely without UTC shifting
 */
export const parseDateOnlySafe = (
  dateInput?: string | null
): { year: number; month: number; day: number; dateKey: string } => {
  if (!dateInput || typeof dateInput !== "string") {
    return { year: 0, month: 0, day: 0, dateKey: "" };
  }

  const cleanPart = dateInput.split("T")[0].trim();
  const parts = cleanPart.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
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

export const formatScheduleDate = (
  dateInput?: string | null,
  style: "short" | "full" = "full"
): string => {
  const { year, month, day, dateKey } = parseDateOnlySafe(dateInput);
  if (!dateKey || year === 0) return "Date to be announced";

  const monthName = MONTH_NAMES[month - 1] || "";
  const shortMonth = monthName.slice(0, 3);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_NAMES[localDate.getDay()] || "";

  if (style === "short") {
    return `${dayOfWeek.slice(0, 3)}, ${shortMonth} ${day}`;
  }
  return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
};

export const extractTimeSlotFromSchedule = (schedule: ScheduleItem): string => {
  if (schedule.remarks) {
    const match = schedule.remarks.match(/Time Slot:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (match) {
      return match[1].trim();
    }
  }

  if (schedule.startDatetime) {
    const d = new Date(schedule.startDatetime);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const mStr = String(minutes).padStart(2, "0");
      const hStr = String(hours).padStart(2, "0");
      return `${hStr}:${mStr} ${ampm}`;
    }
  }

  return "TBD";
};

export const getScheduleDisplayTitle = (schedule: ScheduleItem): string =>
  schedule.effectiveDisplayTitle
  || schedule.displayTitle
  || getScheduleEventLabel(schedule.eventType);

export interface StatusBadgeInfo {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const getScheduleStatusBadge = (status: ScheduleStatus): StatusBadgeInfo => {
  switch (status) {
    case "CONFIRMED":
      return {
        label: "Confirmed",
        bg: "#ECFDF5",
        text: "#065F46",
        border: "#A7F3D0",
      };
    case "PENDING":
    case "REQUESTED":
      return {
        label: "Pending Review",
        bg: "#FEF3C7",
        text: "#92400E",
        border: "#FDE68A",
      };
    case "PROPOSED_RESCHEDULE":
    case "WAITING_PARISHIONER_RESPONSE":
      return {
        label: "Action Required: Reschedule Proposed",
        bg: "#EFF6FF",
        text: "#1E40AF",
        border: "#BFDBFE",
      };
    case "COMPLETED":
      return {
        label: "Completed",
        bg: "#F3F4F6",
        text: "#374151",
        border: "#E5E7EB",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        bg: "#FEF2F2",
        text: "#991B1B",
        border: "#FECACA",
      };
    case "REJECTED":
      return {
        label: "Declined",
        bg: "#FEF2F2",
        text: "#991B1B",
        border: "#FECACA",
      };
    default:
      return {
        label: status,
        bg: "#F3F4F6",
        text: "#4B5563",
        border: "#E5E7EB",
      };
  }
};

export const isRescheduleProposalPending = (status: ScheduleStatus): boolean => {
  return status === "PROPOSED_RESCHEDULE" || status === "WAITING_PARISHIONER_RESPONSE";
};

export interface RecommendationBadgeItem {
  key: string;
  label: string;
  variant: "date" | "time" | "priest-available" | "priest-unavailable";
  accessibilityLabel: string;
}

export const PREFERRED_PRIEST_HELPER_COPY =
  "Your preferred priest may not be available for every suggested time. The parish can still assign another priest.";

export const PREFERRED_PRIEST_AVAILABLE_LABEL = "Preferred Priest Available";
export const PREFERRED_PRIEST_UNAVAILABLE_LABEL = "Preferred Priest Unavailable";

export const PREFERRED_PRIEST_AVAILABLE_TOOLTIP =
  "Your preferred priest is available at this time.";
export const PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP =
  "Your preferred priest is unavailable at this time, but another priest may be assigned.";

export const getRecommendationBadges = (rec: {
  reasons?: string[];
  preferredPriestAvailable?: boolean;
}): RecommendationBadgeItem[] => {
  const badges: RecommendationBadgeItem[] = [];
  if (rec.reasons?.includes("PREFERRED_DATE")) {
    badges.push({
      key: "preferred_date",
      label: "Preferred Date",
      variant: "date",
      accessibilityLabel: "Preferred Date",
    });
  }
  if (rec.reasons?.includes("PREFERRED_TIME")) {
    badges.push({
      key: "preferred_time",
      label: "Preferred Time",
      variant: "time",
      accessibilityLabel: "Preferred Time",
    });
  }
  if (rec.preferredPriestAvailable === true) {
    badges.push({
      key: "preferred_priest_available",
      label: PREFERRED_PRIEST_AVAILABLE_LABEL,
      variant: "priest-available",
      accessibilityLabel: PREFERRED_PRIEST_AVAILABLE_TOOLTIP,
    });
  } else if (rec.preferredPriestAvailable === false) {
    badges.push({
      key: "preferred_priest_unavailable",
      label: PREFERRED_PRIEST_UNAVAILABLE_LABEL,
      variant: "priest-unavailable",
      accessibilityLabel: PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP,
    });
  }
  return badges;
};
