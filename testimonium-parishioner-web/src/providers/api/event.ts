import type { IEventProvider } from "../types";
import type { Event } from "../../types";
import { client } from "../../api/client";
import { getParishImage } from "../../utils/parishImages";
const getManilaYearMonth = (date = new Date()): { year: number; month: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { year: Number(values.year), month: Number(values.month) };
};
const mapCategory = (type: string): Event['category'] => {
  const t = String(type).toUpperCase();
  switch (t) {
    case 'MASS':
    case 'PRIVATE_MASS':
    case 'MASS_INTENTION':
      return 'Holy Mass';
    case 'BAPTISM':
      return 'Baptism';
    case 'WEDDING':
      return 'Wedding';
    case 'CONFIRMATION':
      return 'Confirmation';
    case 'FUNERAL':
      return 'Funeral';
    case 'FIESTA':
      return 'Fiesta';
    case 'SEMINAR':
      return 'Seminar';
    default:
      return 'Other';
  }
};

const dateOnlyFromBackend = (value?: string): string => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
};

const mapBackendEventToFrontend = (e: any): Event => {
  const dateStr = dateOnlyFromBackend(e.eventDate);
  const category = mapCategory(e.eventType);
  const parishName = e.parish?.parishName || e.parishName || 'Main Church';
  const coverImage = getParishImage({ name: parishName, address: e.location });

  return {
    id: String(e.id),
    title: e.title || 'Parish Event',
    description: e.description || 'No description provided.',
    category,
    parishId: String(e.parishId),
    parishName,
    coverImage,
    coverImageAlt: e.title || 'Parish Event',
    startDate: dateStr,
    endDate: dateOnlyFromBackend(e.endDate) || dateStr,
    startTime: e.startTime || '08:00 AM',
    endTime: e.endTime || '12:00 PM',
    location: e.location || 'Parish Main Church',
    organizer: 'Parish Office',
    contactPerson: e.secretaryName || e.assignedPriest?.fullName || 'Secretary',
    contactNumber: e.secretaryContact || '+63 917 123 4567',
    featured: true,
    status: 'upcoming',
    registrationRequired: false,
  };
};

export class ApiEventProvider implements IEventProvider {
  private async getEventsForMonth(year: number, month: number): Promise<Event[]> {
    const response = await client.get<any>(`/parish-events/all?year=${year}&month=${month}`);
    const list = Array.isArray(response)
      ? response
      : response?.items || response?.data || [];
    return list.map(mapBackendEventToFrontend);
  }

  async getEvents(): Promise<Event[]> {
    const { year, month } = getManilaYearMonth();
    return this.getEventsForMonth(year, month);
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return this.getEvents();
  }

  async getEventById(id: string): Promise<Event | null> {
    const list = await this.getEvents();
    return list.find(e => e.id === id) || null;
  }
}
