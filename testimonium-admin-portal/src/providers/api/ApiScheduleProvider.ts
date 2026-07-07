import api from '@/api/api';
import type { ScheduleProvider, ScheduleRequestFilters } from '../interfaces';
import type { ScheduleRequest, ScheduleStatus, EventType } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';

interface BackendScheduleRequestDTO {
  id: number;
  userId: number;
  parishId: number;
  eventType: string;
  requestedDate: string;
  startDatetime: string | null;
  endDatetime: string | null;
  status: string;
  conflictFlag: boolean;
  remarks: string | null;
  processedById: number | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

const mapScheduleStatus = (status: string): ScheduleStatus => {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'REJECTED':
      return 'Cancelled';
    default:
      return 'Pending';
  }
};

const mapEventType = (type: string): EventType => {
  switch (type) {
    case 'WEDDING': return 'Wedding';
    case 'BAPTISM': return 'Baptism';
    case 'CONFIRMATION': return 'Other';
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

  const start = dbItem.startDatetime ? new Date(dbItem.startDatetime) : null;
  let preferredTime = '00:00 AM';
  if (start) {
    let hours = start.getHours();
    const minutes = start.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    const hourStr = hours < 10 ? '0' + hours : hours;
    preferredTime = `${hourStr}:${minStr} ${period}`;
  }

  return {
    id: String(dbItem.id),
    referenceNo: `REQ-${new Date(dbItem.createdAt).getFullYear()}-${String(dbItem.id).padStart(4, '0')}`,
    parishionerName: name,
    initials,
    avatarColor,
    eventType: mapEventType(dbItem.eventType),
    preferredDate,
    preferredTime,
    status: mapScheduleStatus(dbItem.status),
    assignedPriest: dbItem.processedById ? 'Father Michael' : 'TBD',
    parish: 'St. Joseph the Worker Parish',
    contactInfo: dbItem.user?.email || 'Anonymous',
    notes: dbItem.remarks || 'No notes provided.',
    timeline: [
      { status: 'Pending', date: preferredDate, note: 'Schedule request submitted.' },
      ...(dbItem.status === 'CONFIRMED' ? [{ status: 'Confirmed', date: preferredDate, note: 'Approved and scheduled.' }] : []),
    ]
  };
};

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

    return {
      data: (response.data.data || []).map(mapToFrontend),
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      pageSize: response.data.pagination?.limit || pageSize,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  async getScheduleRequest(id: string): Promise<ScheduleRequest> {
    const response = await api.get<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}`);
    return mapToFrontend(response.data.data);
  },

  async updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest> {
    let backendStatus = 'PENDING';
    if (status === 'Confirmed') backendStatus = 'CONFIRMED';
    else if (status === 'Cancelled') backendStatus = 'REJECTED';

    const response = await api.patch<{ data: BackendScheduleRequestDTO }>(`/schedule-requests/${id}/status`, { status: backendStatus });
    return mapToFrontend(response.data.data);
  }
};
