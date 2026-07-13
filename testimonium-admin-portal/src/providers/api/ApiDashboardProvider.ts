import api from '@/api/api';
import type { DashboardProvider } from '../interfaces';
import type { StatCardData, TodayScheduleItem, RecentAlert } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';
import { resolveDisplayTitle } from '@/shared/EventTypeCatalog';

interface BackendStatsDTO {
  pendingDocumentRequests: number;
  pendingScheduleRequests: number;
  needingCorrection: number;
  readyForPickup: number;
}

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

interface BackendNotificationDTO {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  dateSent: string;
  createdAt: string;
}

// Unused formatEventType removed in favor of resolveDisplayTitle from shared catalog

const formatTimeAgo = (dateStr: string | Date): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
};

export const ApiDashboardProvider: DashboardProvider = {
  async getStats(): Promise<StatCardData[]> {
    const response = await api.get<ApiResponseEnvelope<BackendStatsDTO>>('/dashboard/stats');
    const stats = response.data.data;
    
    return [
      {
        id: 'pending-documents',
        label: 'PENDING DOCUMENTS',
        value: stats.pendingDocumentRequests || 0,
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-50',
        icon: 'FileText',
      },
      {
        id: 'pending-schedules',
        label: 'PENDING SCHEDULES',
        value: stats.pendingScheduleRequests || 0,
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50',
        icon: 'CalendarDays',
      },
      {
        id: 'needs-correction',
        label: 'NEEDS CORRECTION',
        value: stats.needingCorrection || 0,
        iconColor: 'text-red-500',
        bgColor: 'bg-red-50',
        icon: 'Clock',
      },
      {
        id: 'ready-for-pickup',
        label: 'READY FOR PICKUP',
        value: stats.readyForPickup || 0,
        iconColor: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: 'ClipboardCheck',
      },
    ];
  },

  async getTodaySchedule(): Promise<TodayScheduleItem[]> {
    const response = await api.get<ApiResponseEnvelope<BackendScheduleDTO[]>>('/dashboard/schedule');
    const now = new Date();
    
    return (response.data.data || []).map((dbItem): TodayScheduleItem => {
      const start = dbItem.startDatetime ? new Date(dbItem.startDatetime) : null;
      const end = dbItem.endDatetime ? new Date(dbItem.endDatetime) : null;
      
      let timeStr = '00:00';
      let periodVal: 'AM' | 'PM' = 'AM';
      if (start) {
        let hours = start.getHours();
        const minutes = start.getMinutes();
        periodVal = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minStr = minutes < 10 ? '0' + minutes : minutes;
        const hourStr = hours < 10 ? '0' + hours : hours;
        timeStr = `${hourStr}:${minStr}`;
      }

      let statusVal: 'Confirmed' | 'In Progress' | 'Pending' = 'Pending';
      if (dbItem.status === 'CONFIRMED') {
        if (start && end && now >= start && now <= end) {
          statusVal = 'In Progress';
        } else {
          statusVal = 'Confirmed';
        }
      } else if (dbItem.status === 'PENDING') {
        statusVal = 'Pending';
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
        time: timeStr,
        period: periodVal,
        title: `${appointmentTitle}: ${dbItem.user?.fullName || 'Anonymous'}`,
        location: dbItem.parish?.parishName || 'Main Church',
        priest: dbItem.processedBy?.fullName || 'TBD',
        status: statusVal,
      };
    });
  },

  async getRecentAlerts(): Promise<RecentAlert[]> {
    const response = await api.get<ApiResponseEnvelope<BackendNotificationDTO[]>>('/dashboard/alerts');
    
    return (response.data.data || []).map((dbItem): RecentAlert => {
      const titleLower = (dbItem.title || '').toLowerCase();
      const msgLower = (dbItem.message || '').toLowerCase();
      
      let alertType: 'warning' | 'info' | 'document' = 'info';
      if (titleLower.includes('document') || msgLower.includes('document') || titleLower.includes('certificate') || msgLower.includes('certificate')) {
        alertType = 'document';
      } else if (titleLower.includes('conflict') || msgLower.includes('conflict') || titleLower.includes('warning') || msgLower.includes('warning') || titleLower.includes('error') || msgLower.includes('error')) {
        alertType = 'warning';
      }

      return {
        id: String(dbItem.id),
        type: alertType,
        title: dbItem.title || 'Notification',
        description: dbItem.message || '',
        timeAgo: formatTimeAgo(dbItem.dateSent || dbItem.createdAt),
      };
    });
  },
};
