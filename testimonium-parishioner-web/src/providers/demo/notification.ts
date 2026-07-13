import type { INotificationProvider } from '../types';
import type { AppNotification } from '../../types';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Document Ready for Pickup',
    message: 'Your Baptism Certificate request (TX-2026-88401) is signed and ready for pickup at Saint Joseph Parish Office.',
    type: 'document-ready',
    read: false,
    createdAt: '2026-07-09T14:30:00Z'
  },
  {
    id: 'n2',
    title: 'Canonical Interview Confirmed',
    message: 'Your Baptism interview appointment on July 15, 2026, at 10:00 AM has been confirmed by St. Isidore the Laborer Parish.',
    type: 'appointment-confirmed',
    read: false,
    createdAt: '2026-07-08T09:15:00Z'
  },
  {
    id: 'n3',
    title: 'Diocese Announcement',
    message: 'The Bishop invites all families to the annual Diocesan Family Day on July 20. Check details on the home screen.',
    type: 'announcement',
    read: true,
    createdAt: '2026-07-05T08:00:00Z'
  }
];

export class DemoNotificationProvider implements INotificationProvider {
  private notifications: AppNotification[] = [];

  constructor() {
    const cached = localStorage.getItem('testimonium_demo_notifications');
    if (cached) {
      try {
        this.notifications = JSON.parse(cached);
      } catch (e) {
        this.notifications = [...INITIAL_NOTIFICATIONS];
        this.save();
      }
    } else {
      this.notifications = [...INITIAL_NOTIFICATIONS];
      this.save();
    }
  }

  private save() {
    localStorage.setItem('testimonium_demo_notifications', JSON.stringify(this.notifications));
  }

  async getNotifications(): Promise<AppNotification[]> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return [...this.notifications];
  }

  async markAsRead(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.save();
  }

  async markAllAsRead(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.save();
  }
}
