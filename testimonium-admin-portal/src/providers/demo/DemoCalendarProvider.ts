import type { CalendarProvider } from '../interfaces';
import type { CalendarEvent } from '@/types';
import { calendarEvents } from '@/mock/calendar';

export const DemoCalendarProvider: CalendarProvider = {
  async getEvents(_year: number, _month: number): Promise<CalendarEvent[]> {
    return calendarEvents.map(evt => ({
      ...evt,
      parish: evt.category === 'sacrament' ? 'St. Joseph the Worker Parish' : 'Diocese Office',
      priest: evt.category === 'sacrament' ? 'Fr. Michael Reyes' : 'Father Michael',
      requestor: evt.title.includes(':') ? evt.title.split(':')[1].trim() : evt.title.includes('-') ? evt.title.split('-')[1].trim() : 'Maria Clara',
      status: evt.category === 'tentative' ? 'Pending' : 'Confirmed',
      description: evt.category === 'sacrament' ? 'Official sacramental event registration.' : 'Administrative parish staff meeting.',
    }));
  }
};
