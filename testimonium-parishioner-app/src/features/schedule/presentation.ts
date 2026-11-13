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

export const formatScheduleConfirmationRef = (
  id?: number | string | null,
  createdAt?: string | null
): string => {
  if (id === undefined || id === null || id === "") return "";
  const parsedDate = createdAt ? new Date(createdAt) : new Date();
  const year = isNaN(parsedDate.getTime()) ? new Date().getFullYear() : parsedDate.getFullYear();
  return `CONF-${year}-${String(id).padStart(4, "0")}`;
};

export const normalizeScheduleTrackingReference = (raw: string): string => {
  return raw.trim().toUpperCase();
};

export const isValidScheduleTrackingReference = (raw: string): boolean => {
  const normalized = normalizeScheduleTrackingReference(raw);
  return /^CONF-\d{4}-\d+$/.test(normalized) || /^\d+$/.test(normalized);
};

export const formatManilaTimestamp = (isoString?: string | null): string => {
  if (!isoString) return "";
  const parsed = new Date(isoString);
  if (isNaN(parsed.getTime())) return isoString;
  try {
    const datePart = parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
    const timePart = parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
    return `${datePart} • ${timePart}`;
  } catch {
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
};

export interface ScheduleMilestone {
  key:
    | "submitted"
    | "leader_assigned"
    | "assignment_confirmed"
    | "appointment_confirmed"
    | "appointment_concluded";
  label: string;
  detail: string;
  timestamp?: string;
  state: "completed" | "current" | "upcoming" | "cancelled";
}

export const getScheduleMilestones = (schedule: ScheduleItem): ScheduleMilestone[] => {
  const isTerminated = schedule.status === "CANCELLED" || schedule.status === "REJECTED";
  const hasLeader = Boolean(
    schedule.assignedPriestId || schedule.assignedPriest?.fullName || schedule.layMinisterAssigned
  );
  const priestAccepted = Boolean(schedule.assignedPriestId) && schedule.priestResponseStatus === "ACCEPTED";
  const assignmentConfirmed = schedule.layMinisterAssigned
    ? schedule.status === "CONFIRMED" || schedule.status === "COMPLETED"
    : priestAccepted || (hasLeader && schedule.status === "COMPLETED");
  const appointmentConfirmed =
    schedule.status === "CONFIRMED" || schedule.status === "COMPLETED";
  const appointmentConcluded = schedule.status === "COMPLETED";

  const confRef = formatScheduleConfirmationRef(schedule.id, schedule.createdAt);

  return [
    {
      key: "submitted",
      label: "Request Submitted",
      detail: confRef ? `Reference ${confRef} received by parish` : "Received by parish",
      timestamp: formatManilaTimestamp(schedule.createdAt),
      state: "completed",
    },
    {
      key: "leader_assigned",
      label: "Service Leader Assigned",
      detail: schedule.layMinisterAssigned
        ? "Authorized Lay Minister assigned"
        : schedule.assignedPriest?.fullName
          ? `Assigned Celebrant: ${schedule.assignedPriest.fullName}`
          : isTerminated
            ? "Closed prior to celebrant assignment"
            : "Pending parish assignment",
      state: hasLeader ? "completed" : isTerminated ? "cancelled" : "upcoming",
    },
    {
      key: "assignment_confirmed",
      label: "Assignment Confirmed",
      detail: schedule.layMinisterAssigned
        ? assignmentConfirmed
          ? "Lay Minister service authorized"
          : isTerminated
            ? "Closed"
            : "Pending parish confirmation"
        : assignmentConfirmed
          ? "Celebrant accepted assignment"
          : hasLeader && !isTerminated
            ? schedule.priestResponseStatus === "REJECTED"
              ? "Reassignment in progress"
              : "Awaiting celebrant confirmation"
            : isTerminated
              ? "Closed prior to confirmation"
              : "Waiting for leader assignment",
      state: assignmentConfirmed
        ? "completed"
        : isTerminated
          ? "cancelled"
          : hasLeader
            ? "current"
            : "upcoming",
    },
    {
      key: "appointment_confirmed",
      label: "Appointment Confirmed",
      detail: appointmentConfirmed
        ? `${formatScheduleDate(schedule.requestedDate, "short")} • ${extractTimeSlotFromSchedule(schedule)}`
        : isRescheduleProposalPending(schedule.status)
          ? "Alternative schedule proposed — awaiting your response"
          : isTerminated
            ? schedule.status === "CANCELLED"
              ? "Schedule cancelled"
              : "Schedule declined"
            : "Pending final parish confirmation",
      state: appointmentConfirmed
        ? "completed"
        : isTerminated
          ? "cancelled"
          : isRescheduleProposalPending(schedule.status) || schedule.status === "PENDING" || schedule.status === "REQUESTED"
            ? "current"
            : "upcoming",
    },
    {
      key: "appointment_concluded",
      label: "Appointment Concluded",
      detail: appointmentConcluded
        ? "Schedule marked completed by parish"
        : isTerminated
          ? "Not concluded (closed)"
          : "Expected after scheduled service",
      timestamp: appointmentConcluded ? formatManilaTimestamp(schedule.updatedAt) : undefined,
      state: appointmentConcluded ? "completed" : isTerminated ? "cancelled" : "upcoming",
    },
  ];
};

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
