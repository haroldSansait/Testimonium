import type { Notification } from '@/types';

export const notifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'schedule-conflict',
    group: 'TODAY',
    title: 'Schedule Conflict Detected',
    description:
      "Double booking detected for the Main Sanctuary. 'Wedding: Reyes-Cruz' and 'Choir Rehearsal' are both scheduled for Saturday, Oct 28 at 2:00 PM. Immediate resolution required.",
    timestamp: '10:45 AM',
    isRead: false,
    urgency: 'urgent',
    leftBorderColor: 'border-red-500',
    actions: [
      { label: 'Urgent Action Required' },
      { label: 'Resolve Conflict', href: '/schedule-requests' },
    ],
  },
  {
    id: 'notif-2',
    type: 'baptism-request',
    group: 'TODAY',
    title: 'New Baptism Request',
    description:
      'A new baptism application has been submitted by Maria Santos for baby Leo Santos. Pending document review and date confirmation.',
    timestamp: '09:12 AM',
    isRead: false,
    urgency: 'pending',
    leftBorderColor: 'border-blue-500',
    actions: [
      { label: 'Pending Review' },
      { label: 'View Application', href: '/schedule-requests' },
    ],
  },
  {
    id: 'notif-3',
    type: 'document-ready',
    group: 'YESTERDAY',
    title: 'Document Ready for Pickup',
    description:
      'The Baptismal Certificate requested by Juan dela Cruz (Req ID: #B-2394) has been printed, signed, and is now ready for pickup at the parish office.',
    timestamp: 'Yesterday, 3:30 PM',
    isRead: true,
    urgency: 'success',
    leftBorderColor: 'border-green-500',
    actions: [],
  },
  {
    id: 'notif-4',
    type: 'system-update',
    group: 'YESTERDAY',
    title: 'System Update Completed',
    description:
      'TESTIMONIUM platform underwent scheduled maintenance. Performance improvements and minor bug fixes have been applied successfully.',
    timestamp: 'Yesterday, 2:00 AM',
    isRead: true,
    urgency: 'info',
    leftBorderColor: 'border-gray-300',
    actions: [],
  },
];
