import type { IEventProvider } from "../types";
import type { Event } from "../../types";

export class ApiEventProvider implements IEventProvider {
  async getEvents(): Promise<Event[]> {
    return [];
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return [];
  }

  async getEventById(_id: string): Promise<Event | null> {
    return null;
  }
}
