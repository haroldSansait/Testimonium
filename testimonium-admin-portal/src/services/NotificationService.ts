import { providerFactory } from '@/providers/providerFactory';
import type { Notification } from '@/types';

export const NotificationService = {
  async getNotifications(): Promise<Notification[]> {
    return providerFactory.getNotificationProvider().getNotifications();
  },

  async markAllRead(): Promise<void> {
    return providerFactory.getNotificationProvider().markAllRead();
  },

  async markRead(id: string): Promise<void> {
    return providerFactory.getNotificationProvider().markRead(id);
  },
};
