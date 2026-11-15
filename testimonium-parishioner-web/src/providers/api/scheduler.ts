import type {
  AvailabilityDates,
  EligiblePriest,
  ISchedulerProvider,
  RecommendationRequestPayload,
  ScheduleDraftPayload,
  ScheduleRecommendationsResponse,
  SchedulingConfiguration,
} from "../types";
import type { Appointment, ScheduleDraft } from "../../types";
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

const SCHEDULE_REJECTION_REASON_LABELS: Record<string, string> = {
  MISSING_REQUIREMENTS: "Missing or incomplete requirements",
  INVALID_DOCUMENTS: "Invalid, incorrect, or unreadable supporting documents",
  INCORRECT_BOOKING_INFO: "Incorrect or inconsistent booking information",
  UNAVAILABLE_DATE_TIME: "Requested date or time cannot be accommodated",
  SERVICE_UNAVAILABLE: "Selected service is unavailable",
  OTHER: "Other reason",
};

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
  } else if (s.status === "REJECTED") {
    status = "rejected";
  } else if (s.status === "CANCELLED") {
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
    location: s.location || undefined,
    rejectionReasonCode: s.rejectionReasonCode || null,
    rejectionReasonLabel: s.rejectionReasonCode
      ? (SCHEDULE_REJECTION_REASON_LABELS[s.rejectionReasonCode] || s.rejectionReasonCode)
      : null,
    rejectionAffectedRequirements: Array.isArray(s.rejectionAffectedRequirements)
      ? s.rejectionAffectedRequirements
      : null,
    rejectionNote: s.rejectionNote || null,
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

const mapScheduleDraft = (d: any): ScheduleDraft => {
  if (!d) return d;
  const serviceName = d.effectiveDisplayTitle || resolveDisplayTitle(d.eventType, d.displayTitle) || d.eventType;
  const parishName = d.parish?.parishName || d.parishName || undefined;
  const requestedDateStr = d.requestedDate
    ? String(d.requestedDate).split("T")[0]
    : d.date
      ? String(d.date).split("T")[0]
      : null;
  const preferredDateStr = d.preferredDate ? String(d.preferredDate).split("T")[0] : null;
  const requestedPriestId = d.requestedPriestId ?? d.requestedPriest?.id ?? null;
  const requestedPriestName = d.requestedPriest?.name || d.requestedPriest?.fullName || null;

  return {
    id: String(d.id),
    parishId: String(d.parishId),
    parishName,
    serviceName,
    rawEventType: d.eventType,
    displayTitle: d.displayTitle || serviceName,
    preferredDate: preferredDateStr,
    requestedDate: requestedDateStr,
    date: requestedDateStr,
    timeSlot: d.timeSlot || null,
    requestedPriestId: requestedPriestId !== null && requestedPriestId !== undefined ? Number(requestedPriestId) : null,
    requestedPriestName,
    location: d.location || null,
    remarks: d.remarks || null,
    isDraft: true,
    status: "DRAFT",
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    requirements: Array.isArray(d.requirements) ? d.requirements : [],
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || d.createdAt || new Date().toISOString(),
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

  async getDrafts(): Promise<ScheduleDraft[]> {
    const response = await client.get<any>("/schedule-requests/drafts");
    const list = Array.isArray(response) ? response : response?.data || [];
    return list.map(mapScheduleDraft);
  }

  async getDraftById(id: string): Promise<ScheduleDraft> {
    const response = await client.get<any>(`/schedule-requests/drafts/${id}`);
    const item = response?.data !== undefined ? response.data : response;
    return mapScheduleDraft(item);
  }

  async createDraft(draft: ScheduleDraftPayload, idempotencyKey?: string): Promise<ScheduleDraft> {
    const payload: Record<string, any> = {
      parishId: Number(draft.parishId),
      eventType: draft.eventType,
      displayTitle: draft.displayTitle || null,
      preferredDate: draft.preferredDate || null,
      date: draft.date || draft.requestedDate || null,
      requestedDate: draft.requestedDate || draft.date || null,
      timeSlot: draft.timeSlot || null,
      location: draft.location?.trim() || null,
      remarks: draft.remarks?.trim() || null,
      requestedPriestId:
        draft.requestedPriestId !== undefined && draft.requestedPriestId !== null
          ? Number(draft.requestedPriestId)
          : null,
    };
    const response = await client.post<any>(
      "/schedule-requests/drafts",
      payload,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
    );
    const item = response?.data !== undefined ? response.data : response;
    return mapScheduleDraft(item);
  }

  async updateDraft(id: string, draft: Partial<ScheduleDraftPayload>): Promise<ScheduleDraft> {
    const payload: Record<string, any> = {};
    if (draft.parishId !== undefined) payload.parishId = Number(draft.parishId);
    if (draft.eventType !== undefined) payload.eventType = draft.eventType;
    if (draft.displayTitle !== undefined) payload.displayTitle = draft.displayTitle || null;
    if (draft.preferredDate !== undefined) payload.preferredDate = draft.preferredDate || null;
    if (draft.date !== undefined || draft.requestedDate !== undefined) {
      const dateVal = draft.requestedDate !== undefined ? draft.requestedDate : draft.date;
      payload.date = dateVal || null;
      payload.requestedDate = dateVal || null;
    }
    if (draft.timeSlot !== undefined) payload.timeSlot = draft.timeSlot || null;
    if (draft.location !== undefined) payload.location = draft.location?.trim() || null;
    if (draft.remarks !== undefined) payload.remarks = draft.remarks?.trim() || null;
    if (draft.requestedPriestId !== undefined) {
      payload.requestedPriestId = draft.requestedPriestId !== null ? Number(draft.requestedPriestId) : null;
    }
    const response = await client.patch<any>(`/schedule-requests/drafts/${id}`, payload);
    const item = response?.data !== undefined ? response.data : response;
    return mapScheduleDraft(item);
  }

  async deleteDraft(id: string): Promise<{ id: string; deleted: boolean; cleanupQueued: boolean }> {
    const response = await client.delete<any>(`/schedule-requests/drafts/${id}`);
    const item = response?.data !== undefined ? response.data : response;
    return {
      id: String(item?.id ?? id),
      deleted: Boolean(item?.deleted ?? true),
      cleanupQueued: Boolean(item?.cleanupQueued),
    };
  }

  async submitDraft(
    id: string,
    appointment?: Partial<ScheduleDraftPayload> & { requirementFiles?: Record<string, File> }
  ): Promise<Appointment> {
    const bookingPayload: Record<string, any> = {};
    if (appointment?.parishId !== undefined) bookingPayload.parishId = Number(appointment.parishId);
    if (appointment?.eventType !== undefined) bookingPayload.eventType = appointment.eventType;
    if (appointment?.displayTitle !== undefined) bookingPayload.displayTitle = appointment.displayTitle;
    if (appointment?.preferredDate !== undefined) bookingPayload.preferredDate = appointment.preferredDate || null;
    if (appointment?.date !== undefined || appointment?.requestedDate !== undefined) {
      const dVal = appointment.date || appointment.requestedDate || null;
      bookingPayload.date = dVal;
      bookingPayload.requestedDate = dVal;
    }
    if (appointment?.timeSlot !== undefined) bookingPayload.timeSlot = appointment.timeSlot || null;
    if (appointment?.location !== undefined) bookingPayload.location = appointment.location?.trim() || null;
    if (appointment?.remarks !== undefined) bookingPayload.remarks = appointment.remarks?.trim() || null;
    if (appointment?.requestedPriestId !== undefined) {
      bookingPayload.requestedPriestId =
        appointment.requestedPriestId !== null ? Number(appointment.requestedPriestId) : null;
    }

    const entries = Object.entries(appointment?.requirementFiles || {}).sort(([a], [b]) => a.localeCompare(b));
    const uploadSignature = JSON.stringify(
      await Promise.all(
        entries.map(async ([reqId, file]) => {
          const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
          const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
          return [reqId, hash];
        })
      )
    );
    const idempotencyKey = getOrGenerateWebIdempotencyKey({
      parishId: bookingPayload.parishId || 0,
      eventType: bookingPayload.eventType || "",
      date: bookingPayload.date || "",
      timeSlot: bookingPayload.timeSlot || "",
      remarks: bookingPayload.remarks || "",
      requestedPriestId: bookingPayload.requestedPriestId ?? null,
      uploadSignature: `${id}:${uploadSignature}`,
    });

    if (entries.length > 0) {
      const body = new FormData();
      body.append("booking", JSON.stringify(bookingPayload));
      body.append("requirementIds", JSON.stringify(entries.map(([reqId]) => reqId)));
      entries.forEach(([, file]) => {
        const mimeByExtension: Record<string, string> = {
          pdf: "application/pdf",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
        };
        const uploadFile = file.type
          ? file
          : new Blob([file], { type: mimeByExtension[file.name.split(".").pop()?.toLowerCase() || ""] });
        body.append("files", uploadFile, file.name);
      });
      const data = await client.post<any>(`/schedule-requests/drafts/${id}/submit`, body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const item = data?.data !== undefined ? data.data : data;
      return mapAppointment(item);
    }

    const data = await client.post<any>(`/schedule-requests/drafts/${id}/submit`, bookingPayload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    const item = data?.data !== undefined ? data.data : data;
    return mapAppointment(item);
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

    const payload: any = {
      parishId: parseInt(appointment.parishId, 10),
      eventType: appointment.eventType,
      displayTitle: appointment.displayTitle,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      ...(appointment.location?.trim() ? { location: appointment.location.trim() } : {}),
      remarks: rawRemarks || "Parishioner Portal Request",
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
