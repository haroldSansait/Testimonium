export type NotificationType = "PUSH" | "IN_APP" | "EMAIL";

export type NotificationReferenceType =
  | "DOCUMENT_REQUEST"
  | "SCHEDULE_REQUEST"
  | "GENERAL";

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt?: string | null;
  dateSent: string;
  createdAt: string;
  referenceType?: NotificationReferenceType | null;
  referenceId?: number | null;
}
