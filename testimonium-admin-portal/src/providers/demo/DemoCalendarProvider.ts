import type { CalendarProvider, CreateParishEventPayload } from '../interfaces';
import type { CalendarEvent } from '@/types';
import { calendarEvents } from '@/mock/calendar';

export const DemoCalendarProvider: CalendarProvider = {
  async getEvents(_year: number, _month: number): Promise<CalendarEvent[]> {
    return calendarEvents.map(evt => ({
      ...evt,
      parish: evt.category === 'sacrament' ? 'St. Joseph the Worker Parish' : 'Diocese Office',
      priest: evt.category === 'sacrament' ? 'Fr. Michael Reyes' : 'Father Michael',
      priestId: evt.category === 'sacrament' ? 'p1' : 'p2',
      priestColor: evt.category === 'sacrament' ? '#4F46E5' : undefined,
      requestor: evt.title.includes(':') ? evt.title.split(':')[1].trim() : evt.title.includes('-') ? evt.title.split('-')[1].trim() : 'Maria Clara',
      status: evt.category === 'tentative' ? 'Pending' : 'Confirmed',
      description: evt.category === 'sacrament' ? 'Official sacramental event registration.' : 'Administrative parish staff meeting.',
    }));
  },

  async createParishEvent(payload: CreateParishEventPayload): Promise<any> {
    const newEvent: CalendarEvent = {
      id: `demo-pe-${Date.now()}`,
      day: new Date(payload.eventDate).getDate(),
      month: new Date(payload.eventDate).getMonth(),
      year: new Date(payload.eventDate).getFullYear(),
      time: payload.startTime || 'All Day',
      title: payload.title,
      category: 'sacrament',
      parish: 'St. Joseph the Worker Parish',
      priest: payload.assignedPriestId ? `Priest ID ${payload.assignedPriestId}` : 'TBD',
      priestId: payload.assignedPriestId || undefined,
      priestColor: undefined,
      requestor: 'Secretary',
      status: 'Confirmed',
      description: payload.description || '',
    };
    calendarEvents.push(newEvent);
    return newEvent;
  }
};
