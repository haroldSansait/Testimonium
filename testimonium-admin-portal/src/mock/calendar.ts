import type { CalendarEvent } from '@/types';

// October 2024 calendar events
export const calendarEvents: CalendarEvent[] = [
  // Week 1
  {
    id: 'cal-1',
    day: 1,
    month: 9, // October (0-indexed)
    year: 2024,
    time: '9:00a',
    title: 'Staff Mtg',
    category: 'admin',
  },
  {
    id: 'cal-2',
    day: 3,
    month: 9,
    year: 2024,
    time: '6:00p',
    title: 'Daily Mass',
    category: 'mass',
  },
  {
    id: 'cal-3',
    day: 5,
    month: 9,
    year: 2024,
    time: '10:00a',
    title: 'Baptism - Santos',
    category: 'sacrament',
  },
  {
    id: 'cal-4',
    day: 5,
    month: 9,
    year: 2024,
    time: '2:00p',
    title: 'Wedding (Dela Cruz)',
    category: 'tentative',
  },
  // Week 2
  {
    id: 'cal-5',
    day: 6,
    month: 9,
    year: 2024,
    time: '8:00a',
    title: 'Sunday Mass',
    category: 'mass',
  },
  {
    id: 'cal-6',
    day: 6,
    month: 9,
    year: 2024,
    time: '10:00a',
    title: 'Sunday Mass',
    category: 'mass',
  },
  {
    id: 'cal-7',
    day: 8,
    month: 9,
    year: 2024,
    time: '4:00p',
    title: 'Facility Tour',
    category: 'tentative',
  },
  {
    id: 'cal-8',
    day: 10,
    month: 9,
    year: 2024,
    time: '6:00p',
    title: 'Daily Mass',
    category: 'mass',
  },
  {
    id: 'cal-9',
    day: 10,
    month: 9,
    year: 2024,
    time: '7:30p',
    title: 'Finance Committee',
    category: 'admin',
  },
  {
    id: 'cal-10',
    day: 12,
    month: 9,
    year: 2024,
    time: '9:00a',
    title: 'Baptism - Santos',
    category: 'sacrament',
  },
  {
    id: 'cal-11',
    day: 12,
    month: 9,
    year: 2024,
    time: '2:00p',
    title: 'Wedding - Cruz',
    category: 'sacrament',
  },
];

export const calendarYear = 2024;
export const calendarMonth = 9; // October, 0-indexed
