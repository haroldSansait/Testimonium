import type { StatCardData, TodayScheduleItem, RecentAlert } from '@/types';

export const statCards: StatCardData[] = [
  {
    id: 'pending-documents',
    label: 'PENDING DOCUMENTS',
    value: 24,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    icon: 'FileText',
  },
  {
    id: 'pending-schedules',
    label: 'PENDING SCHEDULES',
    value: 12,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    icon: 'CalendarDays',
  },
  {
    id: 'needs-correction',
    label: 'NEEDS CORRECTION',
    value: 5,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    icon: 'Clock',
  },
  {
    id: 'ready-for-pickup',
    label: 'READY FOR PICKUP',
    value: 18,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: 'ClipboardCheck',
  },
];

export const todaySchedule: TodayScheduleItem[] = [
  {
    id: 'sched-1',
    time: '09:00',
    period: 'AM',
    title: 'Baptism: Maria Santos',
    location: 'Main Church',
    priest: 'Fr. Reyes',
    status: 'Confirmed',
  },
  {
    id: 'sched-2',
    time: '11:30',
    period: 'AM',
    title: 'Wedding: Dela Cruz - Lim',
    location: 'Main Church',
    priest: 'Fr. Garcia',
    status: 'In Progress',
  },
  {
    id: 'sched-3',
    time: '02:00',
    period: 'PM',
    title: 'Counseling Session',
    location: 'Office 2',
    priest: 'Fr. Reyes',
    status: 'Pending',
  },
];

export const recentAlerts: RecentAlert[] = [
  {
    id: 'alert-1',
    type: 'warning',
    title: 'Missing Signature',
    description: 'Baptismal Certificate #402 requires priest signature before release.',
    timeAgo: '10 mins ago',
  },
  {
    id: 'alert-2',
    type: 'info',
    title: 'Schedule Conflict',
    description: 'Requested choir practice overlaps with Mass on Friday.',
    timeAgo: '1 hr ago',
  },
  {
    id: 'alert-3',
    type: 'document',
    title: 'Document Aging',
    description: '3 Confirmation certificates pending review for over 48 hours.',
    timeAgo: '2 hrs ago',
  },
];
