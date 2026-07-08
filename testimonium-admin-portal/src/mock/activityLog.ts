import type { ActivityLogEntry } from '@/types';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.toLocaleString('en-US', { month: 'short' });

export const activityLog: ActivityLogEntry[] = [
  {
    id: 'log-1',
    dateTime: `${currentMonth} 07, ${currentYear}\n14:30 PM`,
    personnel: 'Carlos Mendoza',
    avatar: { initials: 'CM', bgColor: '#7B1C2A' },
    actionDescription: 'Assigned Priest "Rev. Fr. Julius L. Montaño" to parish "St. Joseph Parish"',
    referenceId: 'PRH-4091',
    statusUpdate: 'Approved',
  },
  {
    id: 'log-2',
    dateTime: `${currentMonth} 06, ${currentYear}\n11:15 AM`,
    personnel: 'Carlos Mendoza',
    avatar: { initials: 'CM', bgColor: '#7B1C2A' },
    actionDescription: 'Parish Updated: "Our Lady of the Mountains Quasi-Parish"',
    referenceId: 'PRH-4092',
    statusUpdate: 'Validated',
  },
  {
    id: 'log-3',
    dateTime: `${currentMonth} 05, ${currentYear}\n09:45 AM`,
    personnel: 'Carlos Mendoza',
    avatar: { initials: 'CM', bgColor: '#7B1C2A' },
    actionDescription: 'User Disabled: fr.jimenez@diocese.org',
    referenceId: 'USR-8819',
    statusUpdate: 'Rejected',
  },
  {
    id: 'log-4',
    dateTime: `${currentMonth} 04, ${currentYear}\n16:00 PM`,
    personnel: 'Maria Santos',
    avatar: { initials: 'MS', bgColor: '#B45309' },
    actionDescription: 'User Login',
    referenceId: 'AUTH-1024',
    statusUpdate: 'Validated',
  },
  {
    id: 'log-5',
    dateTime: `${currentMonth} 01, ${currentYear}\n08:00 AM`,
    personnel: 'System',
    avatar: { initials: 'S', bgColor: '#6B7280' },
    actionDescription: 'Initial database migration',
    referenceId: 'SYS-0001',
    statusUpdate: 'Validated',
  },
];

export const totalActivityEntries = 124;
