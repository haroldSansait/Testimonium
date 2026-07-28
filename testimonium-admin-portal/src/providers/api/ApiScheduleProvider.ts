import api from '@/api/api';
import type { ScheduleProvider, ScheduleRequestFilters, ProposeReschedulePayload } from '../interfaces';
import type { ScheduleRequest, ScheduleStatus, EventType } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';
import { resolveDisplayTitle } from '@/shared/EventTypeCatalog';

interface BackendScheduleRequestDTO {
  id: number;
  userId: number;
  parishId: number;
  eventType: string;
  displayTitle: string | null;
  requestedDate: string;
  startDatetime: string | null;
  endDatetime: string | null;
  status: string;
  conflictFlag: boolean;
  remarks: string | null;
  processedById: number | null;
  proposedDate: string | null;
  proposedStartDatetime: string | null;
  rescheduleReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  parish?: {
    id: number;
    parishName: string;
    type: string;
  } | null;
  processedBy?: {
    id: number;
    fullName: string;
  } | null;
  assignedPriest?: {
    id: number;
    fullName: string;
  } | null;
  priestResponseStatus?: string | null;
  priestResponseReason?: string | null;
  isParishEvent?: boolean;
}

const mapScheduleStatus = (status: string): ScheduleStatus => {
  switch (status) {
    case 'PENDING':
    case 'REQUESTED':
      return 'Pending';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'PROPOSED_RESCHEDULE':
    case 'WAITING_PARISHIONER_RESPONSE':
    case 'TENTATIVE':
      return 'Tentative';
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'Confirmed';
    case 'REJECTED':
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Pending';
  }
};

const mapEventType = (type: string): EventType => {
  switch (type) {
    case 'WEDDING': return 'Wedding';
    case 'BAPTISM': return 'Baptism';
    case 'CONFIRMATION': return 'Confirmation';
    case 'PRIVATE_MASS': return 'Mass Intention';
    case 'MASS_INTENTION': return 'Mass Intention';
    default:
      return 'Other';
  }
};

const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || '').toUpperCase();
};

const mapToFrontend = (dbItem: BackendScheduleRequestDTO): ScheduleRequest => {
  const name = dbItem.user?.fullName || 'Anonymous';
  const initials = getInitials(name);
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-indigo-500'];
  const avatarColor = colors[dbItem.id % colors.length];

  const preferredDate = new Date(dbItem.requestedDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Extract time slot from remarks (e.g. "Time Slot: 03:00 PM. Parishioner Portal Request")
  let preferredTime = '00:00 AM';
  if (dbItem.remarks) {
    const match = dbItem.remarks.match(/Time Slot:\s*([^.]+)/);
    if (match) {
      preferredTime = match[1].trim();
    }
  }

  if (preferredTime === '00:00 AM' && dbItem.startDatetime) {
    const start = new Date(dbItem.startDatetime);
    let hours = start.getHours();
    const minutes = start.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    const hourStr = hours < 10 ? '0' + hours : hours;
    preferredTime = `${hourStr}:${minStr} ${period}`;
  }

  // Extract custom service/appointment title, checking displayTitle first, then fallback to remarks, then eventType
  let appointmentTitle: string = resolveDisplayTitle(dbItem.eventType, dbItem.displayTitle);
  if (!dbItem.displayTitle && dbItem.remarks) {
    const match = dbItem.remarks.match(/Service:\s*([^.]+)/);
    if (match) {
      appointmentTitle = match[1].trim();
    }
  }

  const assignedPriest = dbItem.assignedPriest?.fullName || dbItem.processedBy?.fullName || 'TBD';

  let proposedDateStr = undefined;
  let proposedTimeStr = undefined;
  if (dbItem.proposedDate) {
    proposedDateStr = new Date(dbItem.proposedDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (dbItem.proposedStartDatetime) {
    const pStart = new Date(dbItem.proposedStartDatetime);
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
    id: String(dbItem.id),
    referenceNo: `REQ-${new Date(dbItem.createdAt).getFullYear()}-${String(dbItem.id).padStart(4, '0')}`,
    parishionerName: name,
    initials,
    avatarColor,
    eventType: mapEventType(dbItem.eventType),
    appointmentTitle,
    preferredDate,
    preferredTime,
    status: mapScheduleStatus(dbItem.status),
    assignedPriest,
    parish: dbItem.parish?.parishName || 'Main Church',
    parishId: String(dbItem.parishId),
    contactInfo: dbItem.user?.email || 'Anonymous',
    notes: dbItem.remarks || 'No notes provided.',
    proposedDate: proposedDateStr,
    proposedTime: proposedTimeStr,
    rescheduleReason: dbItem.rescheduleReason || undefined,
    priestResponseStatus: dbItem.priestResponseStatus || undefined,
    priestResponseReason: dbItem.priestResponseReason || undefined,
    isParishEvent: dbItem.isParishEvent || false,
    timeline: [
      { status: 'Pending', date: preferredDate, note: 'Schedule request submitted.' },
      ...(dbItem.status === 'PROPOSED_RESCHEDULE' || dbItem.status === 'WAITING_PARISHIONER_RESPONSE' ? [{ status: 'Tentative', date: preferredDate, note: `Alternative date proposed: ${proposedDateStr} (${proposedTimeStr || ''}). Reason: ${dbItem.rescheduleReason || 'None'}` }] : []),
      ...(dbItem.status === 'CONFIRMED' ? [{ status: 'Confirmed', date: preferredDate, note: `Approved and scheduled with priest: ${assignedPriest}.` }] : []),
      ...(dbItem.status === 'CANCELLED' || dbItem.status === 'REJECTED' ? [{ status: 'Cancelled', date: preferredDate, note: 'Request cancelled.' }] : []),
    ]
  };
};

const mapParishEventToFrontend = (e: any): ScheduleRequest => {
  const preferredDate = new Date(e.eventDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const preferredTime = `${e.startTime || '09:00 AM'} - ${e.endTime || '10:00 AM'}`;

  return {
    id: String(e.id + 100000),
    referenceNo: `REQ-EVENT-${String(e.id).padStart(4, '0')}`,
    parishionerName: e.createdBy?.fullName || 'Staff',
    initials: 'ST',
    avatarColor: 'bg-teal-500',
    eventType: 'Other',
    appointmentTitle: e.title,
    preferredDate,
    preferredTime,
    status: 'Confirmed',
    assignedPriest: e.assignedPriest?.fullName || 'TBD',
    parish: e.parish?.parishName || 'Main Church',
    parishId: String(e.parishId),
    contactInfo: e.createdBy?.email || 'staff@diocese.org',
    notes: e.description || 'No description provided.',
    priestResponseStatus: e.priestResponseStatus || undefined,
    priestResponseReason: e.priestResponseReason || undefined,
    isParishEvent: true,
  };
};

const mapMassTemplateToFrontend = (t: any): ScheduleRequest => {
  const getNextDayOfWeek = (dayName: string) => {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const targetDay = days.indexOf(dayName);
    if (targetDay === -1) return new Date();
    const resultDate = new Date();
    resultDate.setDate(resultDate.getDate() + (targetDay + 7 - resultDate.getDay()) % 7);
    return resultDate;
  };
  const nextOccur = getNextDayOfWeek(t.dayType);

  const preferredDate = nextOccur.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return {
    id: String(t.id + 200000),
    referenceNo: `REQ-MASS-${String(t.id).padStart(4, '0')}`,
    parishionerName: 'Parish Staff',
    initials: 'PS',
    avatarColor: 'bg-purple-500',
    eventType: 'Mass Intention',
    appointmentTitle: `${t.label || "Holy Mass"} (${t.dayType})`,
    preferredDate,
    preferredTime: t.timeSlot,
    status: 'Confirmed',
    assignedPriest: t.assignedPriest?.fullName || 'TBD',
    parish: t.parish?.parishName || 'Main Church',
    parishId: String(t.parishId),
    contactInfo: 'staff@diocese.org',
    notes: `Time Slot: ${t.timeSlot}. Recurring Mass schedule on ${t.dayType}.`,
    priestResponseStatus: t.priestResponseStatus || undefined,
    priestResponseReason: t.priestResponseReason || undefined,
    isParishEvent: true,
  };
};

// Local optimistic caches
const optimisticScheduleStatuses: Record<string, ScheduleStatus> = {};
const optimisticSchedulePriests: Record<string, string> = {};

export const ApiScheduleProvider: ScheduleProvider = {
  async getScheduleRequests(
    filters: ScheduleRequestFilters = {}
  ): Promise<PaginatedResponse<ScheduleRequest>> {
    const { filter = 'all', page = 1, pageSize = 5 } = filters;

    const params: any = {
      page,
      limit: pageSize,
    };

    if (filter === 'pending') {
      params.status = 'PENDING';
    } else if (filter === 'upcoming') {
      params.status = 'CONFIRMED';
    }

    const response = await api.get<BackendPaginatedResponse<BackendScheduleRequestDTO>>('/schedule-requests', {
      params,
    });

    const mappedData = (response.data.data || []).map(mapToFrontend).map(item => {
      const updated = { ...item };
      if (optimisticScheduleStatuses[item.id]) {
        updated.status = optimisticScheduleStatuses[item.id];
      }
      if (optimisticSchedulePriests[item.id]) {
        updated.assignedPriest = optimisticSchedulePriests[item.id];
      }
      return updated;
    });

    return {
      data: mappedData,
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      pageSize: response.data.pagination?.limit || pageSize,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  async getScheduleRequest(id: string): Promise<ScheduleRequest> {
    const response = await api.get<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}`);
    const item = mapToFrontend(response.data.data);
    if (optimisticScheduleStatuses[id]) {
      item.status = optimisticScheduleStatuses[id];
    }
    if (optimisticSchedulePriests[id]) {
      item.assignedPriest = optimisticSchedulePriests[id];
    }
    return item;
  },

  async updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest> {
    let backendStatus = 'PENDING';
    if (status === 'Confirmed') backendStatus = 'CONFIRMED';
    else if (status === 'Cancelled') backendStatus = 'CANCELLED';
    else if (status === 'Under Review') backendStatus = 'UNDER_REVIEW';

    optimisticScheduleStatuses[id] = status;

    try {
      const response = await api.patch<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/status`, { status: backendStatus });
      const updated = mapToFrontend(response.data.data);
      return { ...updated, status };
    } catch (error) {
      delete optimisticScheduleStatuses[id];
      throw error;
    } finally {
      setTimeout(() => {
        delete optimisticScheduleStatuses[id];
      }, 1500);
    }
  },

  async proposeReschedule(id: string, payload: ProposeReschedulePayload): Promise<ScheduleRequest> {
    optimisticScheduleStatuses[id] = 'Tentative';
    try {
      const response = await api.post<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/propose-reschedule`, payload);
      return mapToFrontend(response.data.data);
    } catch (error) {
      delete optimisticScheduleStatuses[id];
      throw error;
    } finally {
      setTimeout(() => {
        delete optimisticScheduleStatuses[id];
      }, 1500);
    }
  },

  async respondReschedule(id: string, accept: boolean): Promise<ScheduleRequest> {
    optimisticScheduleStatuses[id] = accept ? 'Confirmed' : 'Cancelled';
    try {
      const response = await api.post<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/respond-reschedule`, { accept });
      return mapToFrontend(response.data.data);
    } catch (error) {
      delete optimisticScheduleStatuses[id];
      throw error;
    } finally {
      setTimeout(() => {
        delete optimisticScheduleStatuses[id];
      }, 1500);
    }
  },

  async assignPriest(id: string, priestId: string): Promise<ScheduleRequest> {
    optimisticSchedulePriests[id] = 'Assigning...';
    try {
      const response = await api.post<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/assign-priest`, { priestId });
      const updated = mapToFrontend(response.data.data);
      if (updated.assignedPriest) {
        optimisticSchedulePriests[id] = updated.assignedPriest;
      }
      return updated;
    } catch (error) {
      delete optimisticSchedulePriests[id];
      throw error;
    } finally {
      setTimeout(() => {
        delete optimisticSchedulePriests[id];
      }, 1500);
    }
  },

  async respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<ScheduleRequest> {
    const numId = parseInt(id, 10);
    if (!isNaN(numId) && numId >= 200000) {
      const realId = numId - 200000;
      const response = await api.post<{ data: any }>(`/mass-schedules/${realId}/priest-respond`, { status, reason });
      return mapMassTemplateToFrontend(response.data.data);
    }
    if (!isNaN(numId) && numId >= 100000) {
      const realId = numId - 100000;
      const response = await api.post<{ data: any }>(`/parish-events/${realId}/priest-respond`, { status, reason });
      return mapParishEventToFrontend(response.data.data);
    }
    const response = await api.post<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/priest-respond`, { status, reason });
    return mapToFrontend(response.data.data);
  }
};

