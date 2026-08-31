import api from '@/api/api';
import type { CalendarProvider, CreateParishEventPayload } from '../interfaces';
import type { CalendarEvent, CalendarEventCategory } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';
import { resolveDisplayTitle } from '@/shared/EventTypeCatalog';

interface BackendScheduleDTO {
  id: number | string;
  eventType: string;
  displayTitle: string | null;
  requestedDate: string;
  startDatetime: string | null;
  endDatetime: string | null;
  status: string;
  user?: {
    fullName: string;
  } | null;
  parish?: {
    parishName: string;
  } | null;
  processedBy?: {
    fullName: string;
  } | null;
  assignedPriest?: {
    id: number | string;
    fullName: string;
    color: string | null;
  } | null;
  remarks?: string | null;
  sourceType?: string;
  location?: string | null;
  visibility?: 'PUBLIC' | 'PARISH_PRIVATE';
  version?: number | null;
}

export const ApiCalendarProvider: CalendarProvider = {
  async getEvents(year: number, month: number, parishId?: string): Promise<CalendarEvent[]> {
    // Backend expects month parameter as 1-based (1 = Jan, 12 = Dec),
    // but the frontend uses 0-based month state (0 = Jan, 11 = Dec).
    const backendMonth = month + 1;
    const params: any = { year, month: backendMonth };
    if (parishId && parishId !== 'all') {
      params.parishId = parishId;
    }

    const response = await api.get<ApiResponseEnvelope<BackendScheduleDTO[]>>('/calendar/events', {
      params,
    });

    return (response.data.data || []).map((dbItem): CalendarEvent => {
      const reqDate = new Date(dbItem.requestedDate);
      const start = dbItem.startDatetime ? new Date(dbItem.startDatetime) : null;
      
      let timeStr = 'All Day';
      if (start) {
        let hours = start.getHours();
        const minutes = start.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minStr = minutes < 10 ? '0' + minutes : minutes;
        const hourStr = hours < 10 ? '0' + hours : hours;
        timeStr = `${hourStr}:${minStr} ${period}`;
      }

      let category: CalendarEventCategory = 'admin';
      if (dbItem.sourceType === 'MASS') {
        category = 'mass';
      } else if (dbItem.sourceType === 'PARISH_EVENT') {
        category = 'sacrament';
      } else if (dbItem.status === 'PENDING') {
        category = 'tentative';
      } else {
        if (dbItem.eventType === 'PRIVATE_MASS' || dbItem.eventType === 'MASS_INTENTION') {
          category = 'mass';
        } else if (dbItem.eventType === 'WEDDING' || dbItem.eventType === 'BAPTISM' || dbItem.eventType === 'CONFIRMATION') {
          category = 'sacrament';
        }
      }

      let appointmentTitle = resolveDisplayTitle(dbItem.eventType, dbItem.displayTitle);
      if (!dbItem.displayTitle && dbItem.remarks) {
        const match = dbItem.remarks.match(/Service:\s*([^.]+)/);
        if (match) {
          appointmentTitle = match[1].trim();
        }
      }

      const requestorName = dbItem.user?.fullName || (dbItem.sourceType === 'MASS' ? 'Parish' : 'Anonymous');

      return {
        id: String(dbItem.id),
        day: reqDate.getDate(),
        month: reqDate.getMonth(), // keep 0-indexed for frontend CalendarGrid mapping
        year: reqDate.getFullYear(),
        time: timeStr,
        title: dbItem.sourceType === 'MASS' || dbItem.sourceType === 'PARISH_EVENT' ? appointmentTitle : `${appointmentTitle}: ${requestorName}`,
        category,
        parish: dbItem.parish?.parishName || 'Main Church',
        priest: dbItem.assignedPriest?.fullName || dbItem.processedBy?.fullName || 'TBD',
        priestId: dbItem.assignedPriest?.id ? String(dbItem.assignedPriest.id) : undefined,
        priestColor: dbItem.assignedPriest?.color || undefined,
        requestor: requestorName,
        status: dbItem.status.charAt(0) + dbItem.status.slice(1).toLowerCase(),
        description: dbItem.remarks || 'Official schedule request event.',
        location: dbItem.location || undefined,
        sourceType: dbItem.sourceType,
        visibility: dbItem.visibility,
        version: dbItem.version,
      };
    });
  },

  async createParishEvent(payload: CreateParishEventPayload): Promise<any> {
    const response = await api.post<ApiResponseEnvelope<any>>('/parish-events', payload);
    return response.data.data;
  },

  async updateParishEvent(id: string, payload: Partial<CreateParishEventPayload>): Promise<any> {
    const response = await api.put<ApiResponseEnvelope<any>>(`/parish-events/${id}`, payload);
    return response.data.data;
  }
};
