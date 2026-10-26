import type {
  AvailabilityDates,
  EligiblePriest,
  ISchedulerProvider,
  RecommendationRequestPayload,
  ScheduleRecommendationsResponse,
  SchedulingConfiguration,
} from "../types";
import type { Appointment } from "../../types";
import { client } from "../../api/client";
import { resolveDisplayTitle } from "../../shared/EventTypeCatalog";
import { auth } from "../../firebaseConfig";

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
  requestedPriestId?: number | null;
  uploadSignature?: string;
}): string {
  const normParish = Number(payload.parishId);
  const normEvent = String(payload.eventType || "").toUpperCase().trim();
  const normDate = String(payload.date || "").split("T")[0].trim();
  const normSlot = String(payload.timeSlot || "").trim().toUpperCase();
  const normRemarks = payload.remarks ? payload.remarks.trim() : "";
  const normPriest = payload.requestedPriestId ? String(payload.requestedPriestId) : "";
  const sig = JSON.stringify([auth.currentUser?.uid, normParish, normEvent, normDate, normSlot, normRemarks, normPriest, payload.uploadSignature || '']);

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
  let serviceName = s.effectiveDisplayTitle || resolveDisplayTitle(s.eventType, s.displayTitle);
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
  const requestedPriestId = s.requestedPriestId || s.requestedPriest?.id || null;
  const requestedPriestName = s.requestedPriest?.name || s.requestedPriest?.fullName || null;
  const priestResponseStatus = s.priestResponseStatus || null;
  const parishName = s.parish?.parishName || s.parishName || undefined;

  const rescheduleHistory = Array.isArray(s.rescheduleHistory)
    ? s.rescheduleHistory.map((h: any) => ({
        previousDate: h.previousDate,
        previousStart: h.previousStart || null,
        newDate: h.newDate,
        newStart: h.newStart || null,
        reason: h.reason,
        changedAt: h.changedAt,
      }))
    : undefined;

  return {
    id: String(s.id),
    parishId: String(s.parishId),
    parishName,
    serviceName,
    rawEventType: s.eventType,
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
    requestedPriestId,
    requestedPriestName,
    priestResponseStatus,
    version: typeof s.version === 'number' ? s.version : undefined,
    rescheduleHistory,
    layMinisterAssigned: Boolean(s.layMinisterAssigned),
    canProposeAlternativeDate: Boolean(s.canProposeAlternativeDate),
    alternativeProposal: s.alternativeProposal || null,
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

  async getEligiblePriests(parishId: string): Promise<EligiblePriest[]> {
    const response = await client.get<any>("/schedule-requests/eligible-priests", { parishId });
    return Array.isArray(response) ? response : response?.data || [];
  }

  async getRecommendations(payload: RecommendationRequestPayload): Promise<ScheduleRecommendationsResponse> {
    return client.post<ScheduleRecommendationsResponse>("/schedule-requests/recommendations", payload);
  }

  async bookAppointment(appointment: {
    parishId: string;
    eventType: string;
    displayTitle: string;
    date: string;
    timeSlot: string;
    location?: string;
    remarks?: string;
    requestedPriestId?: number | null;
    requirementFiles?: Record<string, File>;
  }): Promise<Appointment> {
    const rawRemarks = appointment.remarks?.trim() || "";
    const venueInfo = appointment.location ? `Venue: ${appointment.location}.` : "";
    const combinedRemarks = [rawRemarks, venueInfo].filter(Boolean).join(" ") || "Parishioner Portal Request";

    const payload: any = {
      parishId: parseInt(appointment.parishId, 10),
      eventType: appointment.eventType,
      displayTitle: appointment.displayTitle,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      remarks: combinedRemarks,
    };

    if (appointment.requestedPriestId !== undefined && appointment.requestedPriestId !== null) {
      payload.requestedPriestId = Number(appointment.requestedPriestId);
    }

    const entries = Object.entries(appointment.requirementFiles || {}).sort(([a], [b]) => a.localeCompare(b));
    const uploadSignature = JSON.stringify(await Promise.all(entries.map(async ([id, file]) => {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      return [id, hash];
    })));
    const idempotencyKey = getOrGenerateWebIdempotencyKey({ ...payload, uploadSignature });
    const body = new FormData();
    body.append('booking', JSON.stringify(payload));
    body.append('requirementIds', JSON.stringify(entries.map(([id]) => id)));
    entries.forEach(([, file]) => {
      const mimeByExtension: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      const uploadFile = file.type ? file : new Blob([file], { type: mimeByExtension[file.name.split('.').pop()?.toLowerCase() || ''] });
      body.append('files', uploadFile, file.name);
    });

    const data = await client.post<any>("/schedule-requests/web", body, {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });
    const item = data?.data !== undefined ? data.data : data;
    return mapAppointment(item);
  }

  async respondReschedule(id: string, accept: boolean, expectedVersion: number): Promise<Appointment> {
    const payload: { accept: boolean; expectedVersion?: number } = { accept };
    if (typeof expectedVersion === 'number') {
      payload.expectedVersion = expectedVersion;
    }
    const response = await client.post<any>(`/schedule-requests/${id}/respond-reschedule`, payload);
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }

  async proposeAlternativeDate(id: string, proposedDate: string, timeSlot: string, note?: string) {
    const response = await client.post<any>(`/schedule-requests/${id}/alternative-proposals`, {
      proposedDate,
      timeSlot,
      note: note?.trim() || null,
    });
    return response?.data !== undefined ? response.data : response;
  }

  async withdrawAlternativeDate(id: string, proposalId: number, expectedRevision: number) {
    const response = await client.post<any>(
      `/schedule-requests/${id}/alternative-proposals/${proposalId}/withdraw`,
      { expectedRevision }
    );
    return response?.data !== undefined ? response.data : response;
  }

  async getAppointmentById(id: string): Promise<Appointment> {
    const response = await client.get<any>(`/schedule-requests/${id}`);
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }

  async getAppointmentByTracking(reference: string): Promise<Appointment> {
    const response = await client.get<any>(`/schedule-requests/tracking/${encodeURIComponent(reference.trim())}`);
    const item = response?.data !== undefined ? response.data : response;
    return mapAppointment(item);
  }
}
