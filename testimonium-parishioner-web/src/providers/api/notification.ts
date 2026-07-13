import type { INotificationProvider } from "../types";
import type { AppNotification } from "../../types";
import { client } from "../../api/client";

const mapNotificationType = (n: any): AppNotification["type"] => {
  const lowerTitle = n.title.toLowerCase();
  
  if (n.referenceType === "DOCUMENT_REQUEST") {
    if (lowerTitle.includes("submitted")) return "document-submitted";
    if (lowerTitle.includes("approved")) return "document-approved";
    if (lowerTitle.includes("ready") || lowerTitle.includes("pickup")) return "document-ready";
    if (lowerTitle.includes("completed")) return "document-completed";
    if (lowerTitle.includes("cancelled")) return "document-cancelled";
    if (lowerTitle.includes("rejected")) return "document-rejected";
    if (lowerTitle.includes("payment proof verified") || lowerTitle.includes("verified")) return "payment-verified";
    if (lowerTitle.includes("payment required") || lowerTitle.includes("payment")) return "payment-requested";
  }
  
  if (n.referenceType === "SCHEDULE_REQUEST") {
    if (lowerTitle.includes("submitted")) return "appointment-submitted";
    if (lowerTitle.includes("confirmed")) return "appointment-confirmed";
    if (lowerTitle.includes("declined")) return "appointment-declined";
    if (lowerTitle.includes("cancelled")) return "appointment-declined";
  }
  
  // Fallbacks based on title
  if (lowerTitle.includes("announcement")) return "announcement";
  if (lowerTitle.includes("submitted") && lowerTitle.includes("request")) return "document-submitted";
  if (lowerTitle.includes("ready") || lowerTitle.includes("pickup")) return "document-ready";
  if (lowerTitle.includes("interview") || lowerTitle.includes("appointment")) return "appointment-confirmed";
  
  return "general";
};

const mapNotification = (n: any): AppNotification => {
  if (!n) return n;

  return {
    id: String(n.id),
    title: n.title,
    message: n.message,
    type: mapNotificationType(n),
    read: n.isRead,
    createdAt: n.dateSent || n.createdAt,
    referenceType: n.referenceType || null,
    referenceId: n.referenceId ? Number(n.referenceId) : null,
  };
};

export class ApiNotificationProvider implements INotificationProvider {
  async getNotifications(): Promise<AppNotification[]> {
    const response = await client.get<any>("/notifications");
    const list = Array.isArray(response)
      ? response
      : response?.data || response?.items || [];
    return list.map(mapNotification);
  }

  async markAsRead(id: string): Promise<void> {
    await client.patch(`/notifications/${id}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await client.patch("/notifications/read-all");
  }
}

