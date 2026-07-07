import { providerFactory } from '@/providers/providerFactory';
import type { CalendarEvent } from '@/types';

export const CalendarService = {
  async getEvents(year: number, month: number): Promise<CalendarEvent[]> {
    return providerFactory.getCalendarProvider().getEvents(year, month);
  },
};
