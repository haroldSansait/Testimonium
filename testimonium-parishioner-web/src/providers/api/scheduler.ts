import type { AvailabilityDates, ISchedulerProvider, SchedulingConfiguration } from "../types";
import type { Appointment } from "../../types";
import { client } from "../../api/client";
import { resolveDisplayTitle } from "../../shared/EventTypeCatalog";

let currentWebKeyRef = { payloadSignature: "", key: "" };

function generateWebUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrGenerateWebIdempotencyKey(payload: {
  parishId: number | string;
  eventType: string;
  date: string;
  timeSlot: string;
  remarks?: string | null;
}): string {
  const normParish = Number(payload.parishId);
  const normEvent = String(payload.eventType || "").toUpperCase().trim();
  const normDate = String(payload.date || "").split("T")[0].trim();
  const normSlot = String(payload.timeSlot || "").trim().toUpperCase();
  const normRemarks = payload.remarks ? payload.remarks.trim().replace(/\s+/g, " ") : "";
  const sig = `${normParish}|${normEvent}|${normDate}|${normSlot}|${normRemarks}`;

  if (currentWebKeyRef.payloadSignature === sig && currentWebKeyRef.key) {
    return currentWebKeyRef.key;
  }
  const newKey = `web-sched-${generateWebUuid()}`;
  currentWebKeyRef = { payloadSignature: sig, key: newKey };
  return newKey;
}

const mapAppointment = (s: any): Appointment => {
  if (!s) return s;

  let timeSlot = "TBD";
  let status: Appointment["status"] = "booked";

  if (s.remarks) {
    const match = s.remarks.match(/Time Slot:\s*([^.]+)/);
    if (match) {
      timeSlot = match[1].trim();
    }
  }

  if (s.status === "CONFIRMED") {
    status = "confirmed";
  } else if (s.status === "REJECTED" || s.status === "CANCELLED") {
    status = "cancelled";
  } else if (s.status === "PROPOSED_RESCHEDULE" || s.status === "WAITING_PARISHIONER_RESPONSE") {
    status = "proposed";
  }

  // Extract display title, checking displayTitle first, then fallback to remarks, then eventType
  let serviceName = resolveDisplayTitle(s.eventType, s.displayTitle);
  if (!s.displayTitle && s.remarks) {
    const match = s.remarks.match(/Service:\s*([^.]+)/);
    if (match) {
      serviceName = match[1].trim();
    }
  }

  let proposedDateStr = undefined;
  let proposedTimeStr = undefined;
  if (s.proposedDate) {
    proposedDateStr = new Date(s.proposedDate).toISOString().split("T")[0];
  }
  if (s.proposedStartDatetime) {
    const pStart = new Date(s.proposedStartDatetime);
    let hours = pStart.getHours();
    const minutes = pStart.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    const hourStr = hours < 10 ? '0' + hours : hours;
    proposedTimeStr = `${hourStr}:${minStr} ${period}`;
  }

  const assignedPriestId = s.assignedPriestId || s.assignedPriest?.id || null;
  const assignedPriestName = s.assignedPriest?.fullName || null;
  const priestResponseStatus = s.priestResponseStatus || null;
  const parishName = s.parish?.parishName || s.parishName || undefined;

  return {
    id: String(s.id),
    parishId: String(s.parishId),
    parishName,
    serviceName,
    date: s.requestedDate ? new Date(s.requestedDate).toISOString().split("T")[0] : "",
    timeSlot,
    status,
    confirmationNumber: `CONF-${new Date(s.createdAt || Date.now()).getFullYear()}-${String(
      s.id
    ).padStart(4, "0")}`,
    proposedDate: proposedDateStr,
    proposedTime: proposedTimeStr,
    rescheduleReason: s.rescheduleReason || undefined,
    assignedPriestId,
    assignedPriestName,
    priestResponseStatus,
  };
};

export class ApiSchedulerProvider implements ISchedulerProvider {
  async getAppointments(): Promise<Appointment[]> {
    const response = await client.get<any>("/schedule-requests");
    const list = Array.isArray(response)
      ? response
      : response?.data || response?.items || [];
    return list.map(mapAppointment);
  }

  async getSchedulingConfiguration(parishId: string): Promise<SchedulingConfiguration> {
    return client.get<SchedulingConfiguration>("/schedule-requests/configuration", { parishId });
  }

  async getAvailabilityDates(parishId: string, eventType: string): Promise<AvailabilityDates> {
    return client.get<AvailabilityDates>("/schedule-requests/availability-dates", { parishId, eventType });
  }

  async getAvailableSlots(parishId: string, date: string, eventType: string): Promise<string[]> {
    const params: Record<string, string> = { parishId, date, eventType };
    const response = await client.get<any>("/schedule-requests/available-slots", params);
    return Array.isArray(response)
      ? response
      : response?.data || response?.items || [];
  }

  async bookAppointment(appointment: {
    parishId: string;
    eventType: string;
    displayTitle: string;
    date: string;
    timeSlot: string;
    location?: string;
  }): Promise<Appointment> {
    const payload = {
      parishId: parseInt(appointment.parishId, 10),
      eventType: appointment.eventType,
      displayTitle: appointment.displayTitle,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      remarks: appointment.location ? `Venue: ${appointment.location}.` : "Parishioner Portal Request",
    };

    const idempotencyKey = getOrGenerateWebIdempotencyKey(payload);

    const data = await client.post<any>("/schedule-requests", payload, {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });
    const item = data?.data !== undefined ? data.data : data;
    return mapAppointment(item);
  }

  async respondReschedule(id: string, accept: boolean): Promise<Appointment> {
    const response = await client.post<any>(`/schedule-requests/${id}/respond-reschedule`, { accept });
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }

  async getAppointmentById(id: string): Promise<Appointment> {
    const response = await client.get<any>(`/schedule-requests/${id}`);
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }
}
