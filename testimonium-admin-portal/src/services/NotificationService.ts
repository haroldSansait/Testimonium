import api from '@/api/api';
import type { Notification, NotificationGroup, NotificationUrgency, NotificationAction } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

interface BackendNotificationDTO {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  dateSent: string;
  createdAt: string;
}

const getNotificationGroup = (dateSent: string | Date): NotificationGroup => {
  const date = new Date(dateSent);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (compareDate.getTime() === today.getTime()) {
    return 'TODAY';
  } else if (compareDate.getTime() === yesterday.getTime()) {
    return 'YESTERDAY';
  } else {
    return 'EARLIER';
  }
};

const formatTimestamp = (dateSent: string | Date): string => {
  const date = new Date(dateSent);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (compareDate.getTime() === today.getTime()) {
    return timeString;
  } else if (compareDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeString}`;
  } else {
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateString}, ${timeString}`;
  }
};

export const NotificationService = {
  async getNotifications(): Promise<Notification[]> {
    const response = await api.get<ApiResponseEnvelope<BackendNotificationDTO[]>>('/notifications');
    return (response.data.data || []).map((dbItem): Notification => {
      const titleLower = (dbItem.title || '').toLowerCase();
      const msgLower = (dbItem.message || '').toLowerCase();

      let type: 'schedule-conflict' | 'baptism-request' | 'document-ready' | 'system-update' | 'warning' = 'system-update';
      if (titleLower.includes('conflict') || msgLower.includes('conflict')) {
        type = 'schedule-conflict';
      } else if (titleLower.includes('baptism') || msgLower.includes('baptism')) {
        type = 'baptism-request';
      } else if (titleLower.includes('ready') || titleLower.includes('pickup') || msgLower.includes('ready') || msgLower.includes('pickup')) {
        type = 'document-ready';
      } else if (titleLower.includes('warning') || titleLower.includes('error') || msgLower.includes('warning') || msgLower.includes('error')) {
        type = 'warning';
      } else if (titleLower.includes('system') || titleLower.includes('update') || msgLower.includes('system') || msgLower.includes('update')) {
        type = 'system-update';
      }

      let urgency: NotificationUrgency = 'info';
      if (type === 'schedule-conflict' || type === 'warning') {
        urgency = 'urgent';
      } else if (type === 'baptism-request' || !dbItem.isRead) {
        urgency = 'pending';
      } else if (type === 'document-ready') {
        urgency = 'success';
      }

      let leftBorderColor = 'border-gray-300';
      if (urgency === 'urgent') {
        leftBorderColor = 'border-red-500';
      } else if (urgency === 'pending') {
        leftBorderColor = 'border-blue-500';
      } else if (urgency === 'success') {
        leftBorderColor = 'border-green-500';
      }

      let actions: NotificationAction[] = [];
      if (type === 'schedule-conflict') {
        actions = [
          { label: 'Urgent Action Required' },
          { label: 'Resolve Conflict', href: '/schedule-requests' },
        ];
      } else if (type === 'baptism-request') {
        actions = [
          { label: 'Pending Review' },
          { label: 'View Application', href: '/schedule-requests' },
        ];
      }

      return {
        id: String(dbItem.id),
        type,
        group: getNotificationGroup(dbItem.dateSent || dbItem.createdAt),
        title: dbItem.title || 'Notification',
        description: dbItem.message || '',
        timestamp: formatTimestamp(dbItem.dateSent || dbItem.createdAt),
        isRead: !!dbItem.isRead,
        urgency,
        leftBorderColor,
        actions,
      };
    });
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },
};
