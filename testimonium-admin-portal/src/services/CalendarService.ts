import { providerFactory } from '@/providers/providerFactory';
import type { CalendarEvent } from '@/types';
import type { CreateParishEventPayload } from '@/providers/interfaces';

export const CalendarService = {
  async getEvents(year: number, month: number, parishId?: string): Promise<CalendarEvent[]> {
    return providerFactory.getCalendarProvider().getEvents(year, month, parishId);
  },

  async createParishEvent(payload: CreateParishEventPayload): Promise<any> {
    return providerFactory.getCalendarProvider().createParishEvent(payload);
  },

  async updateParishEvent(id: string, payload: Partial<CreateParishEventPayload>): Promise<any> {
    return providerFactory.getCalendarProvider().updateParishEvent(id, payload);
  }
};
