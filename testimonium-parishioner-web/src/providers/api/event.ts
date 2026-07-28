import type { IEventProvider } from "../types";
import type { Event } from "../../types";
import { client } from "../../api/client";
import { getParishImage } from "../../utils/parishImages";

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

const mapBackendEventToFrontend = (e: any): Event => {
  const dateStr = e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
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
    endDate: dateStr,
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
  async getEvents(): Promise<Event[]> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const response = await client.get<any>(`/parish-events/all?year=${year}&month=${month}`);
      const list = Array.isArray(response)
        ? response
        : response?.items || response?.data || [];
      return list.map(mapBackendEventToFrontend);
    } catch (err) {
      console.error("Failed to fetch API events:", err);
      return [];
    }
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return this.getEvents();
  }

  async getEventById(id: string): Promise<Event | null> {
    const list = await this.getEvents();
    return list.find(e => e.id === id) || null;
  }
}
