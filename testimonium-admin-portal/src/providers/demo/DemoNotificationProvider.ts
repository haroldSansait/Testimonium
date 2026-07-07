import type { NotificationProvider } from '../interfaces';
import type { Notification } from '@/types';
import { notifications as initialNotifications } from '@/mock/notifications';

let store: Notification[] = [...initialNotifications];

export const DemoNotificationProvider: NotificationProvider = {
  async getNotifications() {
    return [...store];
  },
  async markAllRead() {
    store = store.map(n => ({ ...n, isRead: true, urgency: 'success' }));
    return Promise.resolve();
  },
  async markRead(id: string) {
    store = store.map(n => n.id === id ? { ...n, isRead: true, urgency: 'success' } : n);
    return Promise.resolve();
  }
};
