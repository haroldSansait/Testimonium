import type { IAnnouncementProvider } from "../types";
import type { Announcement } from "../../types";

export class ApiAnnouncementProvider implements IAnnouncementProvider {
  async getAnnouncements(): Promise<Announcement[]> {
    return [];
  }
}
