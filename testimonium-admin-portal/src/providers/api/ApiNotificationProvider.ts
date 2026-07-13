import api from '@/api/api';
import type { NotificationProvider } from '../interfaces';
import type { Notification, NotificationGroup, NotificationUrgency, NotificationAction, NotificationType } from '@/types';
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
  referenceType?: string | null;
  referenceId?: number | null;
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

export const ApiNotificationProvider: NotificationProvider = {
  async getNotifications(): Promise<Notification[]> {
    const response = await api.get<ApiResponseEnvelope<BackendNotificationDTO[]>>('/notifications');
    return (response.data.data || []).map((dbItem): Notification => {
      const titleLower = (dbItem.title || '').toLowerCase();
      const msgLower = (dbItem.message || '').toLowerCase();

      let type: NotificationType = 'system-update';
      if (titleLower.includes('conflict') || msgLower.includes('conflict')) {
        type = 'schedule-conflict';
      } else if (titleLower.includes('under review') || msgLower.includes('under review')) {
        type = 'document-under-review';
      } else if (titleLower.includes('baptism') || msgLower.includes('baptism')) {
        type = 'baptism-request';
      } else if (titleLower.includes('ready') || titleLower.includes('pickup') || msgLower.includes('ready') || msgLower.includes('pickup')) {
        type = 'document-ready';
      } else if (titleLower.includes('uploaded') || msgLower.includes('uploaded') || msgLower.includes('proof') || titleLower.includes('proof')) {
        type = 'payment-uploaded';
      } else if (titleLower.includes('verified') || msgLower.includes('verified') || titleLower.includes('auto-verified')) {
        type = 'payment-verified';
      } else if (titleLower.includes('cancel') || msgLower.includes('cancel')) {
        type = 'document-cancelled';
      } else if (titleLower.includes('document') || msgLower.includes('document')) {
        type = 'document-request';
      } else if (titleLower.includes('schedule') || msgLower.includes('schedule') || titleLower.includes('appointment') || msgLower.includes('appointment')) {
        type = 'schedule-request';
      } else if (titleLower.includes('warning') || titleLower.includes('error') || msgLower.includes('warning') || msgLower.includes('error')) {
        type = 'warning';
      } else if (titleLower.includes('system') || titleLower.includes('update') || msgLower.includes('system') || msgLower.includes('update')) {
        type = 'system-update';
      }

      let urgency: NotificationUrgency = 'info';
      if (type === 'schedule-conflict' || type === 'warning' || type === 'document-cancelled') {
        urgency = 'urgent';
      } else if (
        type === 'baptism-request' ||
        type === 'document-request' ||
        type === 'schedule-request' ||
        type === 'payment-uploaded' ||
        type === 'document-under-review' ||
        !dbItem.isRead
      ) {
        urgency = 'pending';
      } else if (type === 'document-ready' || type === 'payment-verified') {
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
      if (type === 'schedule-conflict' || type === 'schedule-request') {
        actions = [
          { label: 'View Schedule', href: '/schedule-requests' },
        ];
      } else if (
        type === 'baptism-request' ||
        type === 'document-request' ||
        type === 'payment-uploaded' ||
        type === 'payment-verified' ||
        type === 'document-under-review' ||
        type === 'document-cancelled' ||
        type === 'document-ready'
      ) {
        actions = [
          { label: 'View Request', href: '/document-requests' },
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
        referenceType: dbItem.referenceType || null,
        referenceId: dbItem.referenceId ? String(dbItem.referenceId) : null,
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
