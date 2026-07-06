// ─── Document Requests ────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'Pending Review'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Released'
  | 'Rejected'
  | 'Needs Correction';

export type DocumentType =
  | 'Baptismal Certificate'
  | 'Marriage Certificate'
  | 'Confirmation Certificate'
  | 'Good Moral Character'
  | 'Death Certificate'
  | 'Burial Permit';

export interface DocumentRequest {
  id: string;
  referenceNo: string;
  parishionerName: string;
  documentType: DocumentType;
  dateSubmitted: string;
  status: DocumentStatus;
}

// ─── Schedule Requests ─────────────────────────────────────────────────────────

export type ScheduleStatus =
  | 'Pending'
  | 'Under Review'
  | 'Tentative'
  | 'Confirmed'
  | 'Cancelled';

export type EventType =
  | 'Baptism'
  | 'Wedding'
  | 'Venue Use'
  | 'Mass Intention'
  | 'House Blessing'
  | 'Funeral Mass'
  | 'Other';

export interface ScheduleRequest {
  id: string;
  referenceNo: string;
  parishionerName: string;
  initials: string;
  avatarColor?: string;
  eventType: EventType;
  preferredDate: string;
  preferredTime: string;
  status: ScheduleStatus;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export interface StatCardData {
  id: string;
  label: string;
  value: number;
  iconColor: string;
  bgColor: string;
  icon: string; // lucide icon name
}

export interface TodayScheduleItem {
  id: string;
  time: string;
  period: 'AM' | 'PM';
  title: string;
  location: string;
  priest: string;
  status: 'Confirmed' | 'In Progress' | 'Pending';
}

export interface RecentAlert {
  id: string;
  type: 'warning' | 'info' | 'document';
  title: string;
  description: string;
  timeAgo: string;
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export type NotificationGroup = 'TODAY' | 'YESTERDAY' | 'EARLIER';

export type NotificationType =
  | 'schedule-conflict'
  | 'baptism-request'
  | 'document-ready'
  | 'system-update'
  | 'warning';

export type NotificationUrgency = 'urgent' | 'pending' | 'info' | 'success';

export interface NotificationAction {
  label: string;
  href?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  group: NotificationGroup;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  urgency: NotificationUrgency;
  actions: NotificationAction[];
  leftBorderColor: string; // tailwind border color class
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarEventCategory =
  | 'mass'
  | 'sacrament'
  | 'admin'
  | 'tentative';

export interface CalendarEvent {
  id: string;
  day: number; // day of month
  month: number; // 0-indexed
  year: number;
  time: string;
  title: string;
  category: CalendarEventCategory;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActivityStatus =
  | 'Validated'
  | 'Under Review'
  | 'Rejected'
  | 'Approved'
  | 'Pending';

export interface PersonnelAvatar {
  initials: string;
  bgColor: string;
}

export interface ActivityLogEntry {
  id: string;
  dateTime: string; // display string e.g. "Oct 24, 2023 14:30 PM"
  personnel: string;
  avatar: PersonnelAvatar;
  actionDescription: string;
  referenceId: string;
  statusUpdate: ActivityStatus;
}

// ─── User / Auth ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'secretary' | 'priest';
  parish: string;
  avatarInitials: string;
  avatarColor: string;
}
