import api from '@/api/api';
import type { CalendarProvider } from '../interfaces';
import type { CalendarEvent, CalendarEventCategory } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';
import { resolveDisplayTitle } from '@/shared/EventTypeCatalog';

interface BackendScheduleDTO {
  id: number;
  eventType: string;
  displayTitle: string | null;
  requestedDate: string;
  startDatetime: string | null;
  endDatetime: string | null;
  status: string;
  user?: {
    fullName: string;
  };
  parish?: {
    parishName: string;
  };
  processedBy?: {
    fullName: string;
  };
  remarks?: string | null;
}

// Event type mapping helper removed in favor of resolveDisplayTitle from shared catalog

export const ApiCalendarProvider: CalendarProvider = {
  async getEvents(year: number, month: number): Promise<CalendarEvent[]> {
    // Backend expects month parameter as 1-based (1 = Jan, 12 = Dec),
    // but the frontend uses 0-based month state (0 = Jan, 11 = Dec).
    const backendMonth = month + 1;

    const response = await api.get<ApiResponseEnvelope<BackendScheduleDTO[]>>('/calendar/events', {
      params: { year, month: backendMonth },
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
      if (dbItem.status === 'PENDING') {
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

      return {
        id: String(dbItem.id),
        day: reqDate.getDate(),
        month: reqDate.getMonth(), // keep 0-indexed for frontend CalendarGrid mapping
        year: reqDate.getFullYear(),
        time: timeStr,
        title: `${appointmentTitle}: ${dbItem.user?.fullName || 'Anonymous'}`,
        category,
        parish: dbItem.parish?.parishName || 'Main Church',
        priest: dbItem.processedBy?.fullName || 'TBD',
        requestor: dbItem.user?.fullName || 'Anonymous',
        status: dbItem.status.charAt(0) + dbItem.status.slice(1).toLowerCase(),
        description: dbItem.remarks || 'Official schedule request event.',
      };
    });
  },
};
