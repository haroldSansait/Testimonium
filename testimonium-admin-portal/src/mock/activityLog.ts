import type { ActivityLogEntry } from '@/types';

export const activityLog: ActivityLogEntry[] = [
  {
    id: 'log-1',
    dateTime: 'Oct 24, 2023\n14:30 PM',
    personnel: 'Father Michael',
    avatar: { initials: 'FM', bgColor: '#7B1C2A' },
    actionDescription: 'Verified baptismal register details',
    referenceId: 'REQ-8821',
    statusUpdate: 'Validated',
  },
  {
    id: 'log-2',
    dateTime: 'Oct 24, 2023\n11:15 AM',
    personnel: 'Sister Theresa',
    avatar: { initials: 'ST', bgColor: '#B45309' },
    actionDescription: 'Updated wedding schedule conflicts',
    referenceId: 'SCH-4092',
    statusUpdate: 'Under Review',
  },
  {
    id: 'log-3',
    dateTime: 'Oct 23, 2023\n09:45 AM',
    personnel: 'John Doe',
    avatar: { initials: 'JD', bgColor: '#6B7280' },
    actionDescription: 'Declined incomplete confirmation certificate request',
    referenceId: 'REQ-8819',
    statusUpdate: 'Rejected',
  },
  {
    id: 'log-4',
    dateTime: 'Oct 22, 2023\n16:00 PM',
    personnel: 'Father Michael',
    avatar: { initials: 'FM', bgColor: '#7B1C2A' },
    actionDescription: 'Approved mass intention scheduling',
    referenceId: 'INT-1024',
    statusUpdate: 'Validated',
  },
];

export const totalActivityEntries = 124;
