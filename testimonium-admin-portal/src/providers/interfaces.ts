import type {
  StatCardData,
  TodayScheduleItem,
  RecentAlert,
  Notification,
  DocumentRequest,
  DocumentType,
  DocumentStatus,
  ScheduleRequest,
  ScheduleStatus,
  CalendarEvent,
  ActivityLogEntry,
  DioceseStat,
  DioceseActivity,
  DioceseNotification,
  SacramentStat,
  DocumentAnalyticsStat,
  ParishAnalyticsStat,
  FinancialStat,
  Parish,
  ManagedUser
} from '@/types';
import type { PaginatedResponse } from '@/types/api';

// ─── Filter Interfaces ────────────────────────────────────────────────────────

export interface DocumentRequestFilters {
  search?: string;
  documentType?: DocumentType | 'all';
  status?: DocumentStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface ScheduleRequestFilters {
  filter?: 'all' | 'pending' | 'upcoming';
  page?: number;
  pageSize?: number;
}

export interface ActivityLogFilters {
  page?: number;
  pageSize?: number;
  role?: string;
  actionType?: string;
  dateRange?: string;
  status?: 'All' | 'Active' | 'Archived';
}

export interface ParishFilters {
  search?: string;
  type?: string;
  status?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  assignableForParishId?: string;
}

export interface AddUserPayload {
  name: string;
  email: string;
  role: ManagedUser['role'];
  parish: string;
}

// ─── Provider Interfaces ──────────────────────────────────────────────────────

export interface DashboardProvider {
  getStats(): Promise<StatCardData[]>;
  getTodaySchedule(): Promise<TodayScheduleItem[]>;
  getRecentAlerts(): Promise<RecentAlert[]>;
}

export interface NotificationProvider {
  getNotifications(): Promise<Notification[]>;
  markAllRead(): Promise<void>;
  markRead(id: string): Promise<void>;
}

export interface DocumentProvider {
  getDocumentRequests(filters: DocumentRequestFilters): Promise<PaginatedResponse<DocumentRequest>>;
  updateDocumentStatus(id: string, status: DocumentStatus): Promise<DocumentRequest>;
}

export interface ScheduleProvider {
  getScheduleRequests(filters: ScheduleRequestFilters): Promise<PaginatedResponse<ScheduleRequest>>;
  getScheduleRequest(id: string): Promise<ScheduleRequest>;
  updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest>;
}

export interface CalendarProvider {
  getEvents(year: number, month: number): Promise<CalendarEvent[]>;
}

export interface ActivityLogProvider {
  getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResponse<ActivityLogEntry>>;
  archiveSelected(ids: string[]): Promise<void>;
  archiveAll(): Promise<void>;
  restoreSelected(ids: string[]): Promise<void>;
  restoreAll(): Promise<void>;
  purgeArchived(): Promise<void>;
}

export interface DioceseDashboardProvider {
  getStats(): Promise<DioceseStat[]>;
  getRecentActivity(): Promise<DioceseActivity[]>;
  getNotifications(): Promise<DioceseNotification[]>;
}

export interface AnalyticsProvider {
  getOverviewStats(): Promise<any>;
  getSacramentStats(): Promise<SacramentStat[]>;
  getDocumentStats(): Promise<DocumentAnalyticsStat[]>;
  getParishStats(): Promise<ParishAnalyticsStat[]>;
  getFinancialStats(): Promise<FinancialStat[]>;
}

export interface ParishProvider {
  getParishes(filters: ParishFilters): Promise<Parish[]>;
  addParish(data: Omit<Parish, 'id' | 'status'>): Promise<Parish>;
  editParish(id: string, data: Partial<Parish>): Promise<Parish>;
  archiveParish(id: string): Promise<void>;
}

export interface UserProvider {
  getUsers(filters: UserFilters): Promise<ManagedUser[]>;
  addUser(payload: AddUserPayload): Promise<{ user: ManagedUser; setupLink?: string }>;
  editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser>;
  disableUser(id: string): Promise<void>;
  enableUser(id: string): Promise<void>;
  resetPassword(id: string): Promise<string>;
}
