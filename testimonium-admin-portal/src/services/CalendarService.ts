import { providerFactory } from '@/providers/providerFactory';
import type { CalendarEvent } from '@/types';
import type { CreateParishEventPayload } from '@/providers/interfaces';

export const CalendarService = {
  async getEvents(year: number, month: number): Promise<CalendarEvent[]> {
    return providerFactory.getCalendarProvider().getEvents(year, month);
  },

  async createParishEvent(payload: CreateParishEventPayload): Promise<any> {
    return providerFactory.getCalendarProvider().createParishEvent(payload);
  }
};
