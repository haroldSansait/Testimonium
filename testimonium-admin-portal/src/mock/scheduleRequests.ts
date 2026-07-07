import type { ScheduleRequest } from '@/types';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.toLocaleString(undefined, { month: 'short' });

export const scheduleRequests: ScheduleRequest[] = [
  {
    id: 'sched-req-1',
    referenceNo: `REQ-${currentYear}-0891`,
    parishionerName: 'Maria Dela Cruz',
    initials: 'MD',
    avatarColor: '#6B7280',
    eventType: 'Baptism',
    preferredDate: `${currentMonth} 15, ${currentYear}`,
    preferredTime: '10:00 AM',
    status: 'Pending',
  },
  {
    id: 'sched-req-2',
    referenceNo: `REQ-${currentYear}-0888`,
    parishionerName: 'Juan Perez & Family',
    initials: 'JP',
    avatarColor: '#6B7280',
    eventType: 'Wedding',
    preferredDate: `${currentMonth} 28, ${currentYear}`,
    preferredTime: '2:30 PM',
    status: 'Under Review',
  },
  {
    id: 'sched-req-3',
    referenceNo: `REQ-${currentYear}-0875`,
    parishionerName: 'San Gabriel Choir',
    initials: 'SG',
    avatarColor: '#9CA3AF',
    eventType: 'Venue Use',
    preferredDate: `${currentMonth} 24, ${currentYear}`,
    preferredTime: '6:00 PM',
    status: 'Tentative',
  },
  {
    id: 'sched-req-4',
    referenceNo: `REQ-${currentYear}-0850`,
    parishionerName: 'Ana Reyes',
    initials: 'AR',
    avatarColor: '#6B7280',
    eventType: 'Mass Intention',
    preferredDate: `${currentMonth} 20, ${currentYear}`,
    preferredTime: '6:00 AM',
    status: 'Confirmed',
  },
  {
    id: 'sched-req-5',
    referenceNo: `REQ-${currentYear}-0895`,
    parishionerName: 'Leonor Magno',
    initials: 'LM',
    avatarColor: '#6B7280',
    eventType: 'House Blessing',
    preferredDate: `${currentMonth} 22, ${currentYear}`,
    preferredTime: '3:00 PM',
    status: 'Pending',
  },
];

export const totalScheduleRequests = 24;
