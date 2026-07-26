import type { ISchedulerProvider } from "../types";
import type { Appointment } from "../../types";
import { client } from "../../api/client";
import { resolveEventType, resolveDisplayTitle } from "../../shared/EventTypeCatalog";

const mapAppointment = (s: any): Appointment => {
  if (!s) return s;

  let timeSlot = "09:00 AM";
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

  return {
    id: String(s.id),
    parishId: String(s.parishId),
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

  async getAvailableSlots(parishId: string, date: string): Promise<string[]> {
    const response = await client.get<any>("/schedule-requests/available-slots", {
      parishId,
      date,
    });
    return Array.isArray(response)
      ? response
      : response?.data || response?.items || [];
  }

  async bookAppointment(appointment: {
    parishId: string;
    serviceName: string;
    date: string;
    timeSlot: string;
  }): Promise<Appointment> {
    const payload = {
      parishId: parseInt(appointment.parishId, 10),
      eventType: resolveEventType(appointment.serviceName) || "MASS_INTENTION",
      displayTitle: appointment.serviceName,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      remarks: "Parishioner Portal Request",
    };

    const data = await client.post<any>("/schedule-requests", payload);
    const item = data?.data !== undefined ? data.data : data;
    return mapAppointment(item);
  }

  async respondReschedule(id: string, accept: boolean): Promise<Appointment> {
    const response = await client.post<any>(`/schedule-requests/${id}/respond-reschedule`, { accept });
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }
}
