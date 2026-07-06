import api from '@/api/api';
import type { CalendarEvent, CalendarEventCategory } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

interface BackendScheduleDTO {
  id: number;
  eventType: string;
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
}

const formatEventType = (type: string): string => {
  switch (type) {
    case 'WEDDING': return 'Wedding';
    case 'BAPTISM': return 'Baptism';
    case 'CONFIRMATION': return 'Confirmation';
    case 'PRIVATE_MASS': return 'Private Mass';
    case 'MASS_INTENTION': return 'Mass Intention';
    default:
      return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
  }
};

export const CalendarService = {
  async getEvents(year: number, month: number): Promise<CalendarEvent[]> {
    // Backend expects month parameter as 1-based (1 = Jan, 12 = Dec),
    // but the frontend uses 0-based month state (0 = Jan, 11 = Dec).
    // Send 1-based month to the backend.
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

      return {
        id: String(dbItem.id),
        day: reqDate.getDate(),
        month: reqDate.getMonth(), // keep 0-indexed for frontend CalendarGrid mapping
        year: reqDate.getFullYear(),
        time: timeStr,
        title: `${formatEventType(dbItem.eventType)}: ${dbItem.user?.fullName || 'Anonymous'}`,
        category,
      };
    });
  },
};
