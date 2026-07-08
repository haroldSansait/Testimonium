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
  purpose?: string;
  paymentStatus?: string;
  requirements?: string[];
  timeline?: { status: string; date: string; note?: string }[];
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
  assignedPriest?: string;
  parish?: string;
  contactInfo?: string;
  notes?: string;
  timeline?: { status: string; date: string; note?: string }[];
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
  parish?: string;
  priest?: string;
  requestor?: string;
  status?: string;
  description?: string;
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
  role?: string;
  avatar: PersonnelAvatar;
  actionDescription: string;
  referenceId: string;
  statusUpdate: ActivityStatus;
  archivedAt?: string | null;
  archivedBy?: number | null;
  archivedByName?: string | null;
  isSystem?: boolean;
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

// ─── Diocese Dashboard ────────────────────────────────────────────────────────

export interface DioceseStat {
  id: string;
  label: string;
  value: number;
  icon: string; // lucide icon name
  iconColor: string;
  bgColor: string;
}

export interface DioceseActivity {
  id: string;
  actor: string;
  actorInitials: string;
  actorColor: string;
  action: string;
  parish: string;
  timeAgo: string;
}

export interface DioceseNotification {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  body: string;
  timeAgo: string;
}

// ─── Parish Management ────────────────────────────────────────────────────────

export type ParishType = 'Parish' | 'Quasi-Parish' | 'Mission Station';
export type ParishStatus = 'Active' | 'Inactive' | 'Archived';

export interface Parish {
  id: string;
  name: string;
  type: ParishType;
  vicariate: string;
  priest: string;
  priestId?: string | null;
  priestName?: string | null;
  secretary: string;
  secretaryId?: string | null;
  secretaryName?: string | null;
  status: ParishStatus;
  patronSaint?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
}

// ─── User Management ──────────────────────────────────────────────────────────

export type ManagedUserRole = 'DIOCESE_COORDINATOR' | 'SECRETARY' | 'PRIEST';
export type ManagedUserStatus = 'Active' | 'Inactive' | 'Disabled';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: ManagedUserRole;
  parish: string;
  parishId?: string | null;
  status: ManagedUserStatus;
  avatarInitials: string;
  avatarColor: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface SacramentStat {
  type: 'Baptisms' | 'Confirmations' | 'Weddings' | 'Funerals';
  count: number;
  trend: number; // percentage change vs last period
}

export interface DocumentAnalyticsStat {
  documentType: string;
  requestCount: number;
  completionRate: number; // 0-100
  avgProcessingDays: number;
}

export interface ParishAnalyticsStat {
  parish: string;
  requestCount: number;
  activeParishioners: number;
  newRegistrations: number;
}

export interface FinancialStat {
  label: string;
  value: string; // formatted display string e.g. "₱12,500"
  note: string;
}
