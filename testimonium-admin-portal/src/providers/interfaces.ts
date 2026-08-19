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
  parishId?: string;
}

export interface PersonData {
  fullName: string;
  email: string;
  contactNumber?: string;
}

export type StaffAssignmentMode = 'none' | 'existing' | 'new';

export interface StaffAssignmentConfig {
  mode: StaffAssignmentMode;
  existingUserId?: string | null;
  newUserData?: PersonData | null;
}

export interface CreateParishPayload {
  parishInfo: {
    name: string;
    type: 'Parish' | 'Quasi-Parish' | 'Mission Station' | '';
    vicariate: string;
    municipalityCity: string;
    feastDay: string;
    patronSaint?: string;
    address?: string;
    contactNumber?: string;
    email?: string;
    venueCapacity?: number | null;
  };
  priest?: StaffAssignmentConfig;
  secretary?: StaffAssignmentConfig;
}

export interface AddUserPayload {
  name: string;
  email: string;
  role: ManagedUser['role'];
  parish: string;
  contactNumber?: string;
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
  updateDocumentStatus(id: string, status: DocumentStatus, remarks?: string, correctionRequirementIds?: string[]): Promise<DocumentRequest>;
}

export interface ProposeReschedulePayload {
  proposedDate: string;
  proposedStartDatetime?: string;
  proposedEndDatetime?: string;
  reason: string;
}

export interface ScheduleProvider {
  getScheduleRequests(filters: ScheduleRequestFilters): Promise<PaginatedResponse<ScheduleRequest>>;
  getScheduleRequest(id: string): Promise<ScheduleRequest>;
  updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest>;
  proposeReschedule(id: string, payload: ProposeReschedulePayload): Promise<ScheduleRequest>;
  respondReschedule(id: string, accept: boolean): Promise<ScheduleRequest>;
  assignPriest(id: string, priestId: string): Promise<ScheduleRequest>;
  respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<ScheduleRequest>;
}

export interface CreateParishEventPayload {
  title: string;
  eventType: string;
  description?: string;
  location?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  assignedPriestId?: string;
  parishId?: string;
}

export interface CalendarProvider {
  getEvents(year: number, month: number, parishId?: string): Promise<CalendarEvent[]>;
  createParishEvent(payload: CreateParishEventPayload): Promise<any>;
  updateParishEvent(id: string, payload: Partial<CreateParishEventPayload>): Promise<any>;
}

export interface ActivityLogProvider {
  getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResponse<ActivityLogEntry>>;
  archiveSelected(ids: string[]): Promise<void>;
  archiveAll(): Promise<void>;
  restoreSelected(ids: string[]): Promise<void>;
  restoreAll(): Promise<void>;
  purgeArchived(): Promise<void>;
  getActionTypes(): Promise<string[]>;
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
}

export interface MassScheduleTemplate {
  id: string;
  parishId: string;
  dayType: string;
  timeSlot: string;
  label: string;
  isActive: boolean;
  assignedPriestId?: string | null;
  assignedPriest?: {
    id: string;
    fullName: string;
    isAssistant?: boolean;
  } | null;
}

export interface ParishProvider {
  getParishes(filters: ParishFilters): Promise<Parish[]>;
  addParish(data: CreateParishPayload | Omit<Parish, 'id' | 'status'>): Promise<Parish>;
  editParish(id: string, data: Partial<Parish>): Promise<Parish>;
  editParishSettings(id: string, data: { documentSettings?: any; eventSettings?: any; officeHours?: any; availableDocuments?: string[]; paymentQrEnabled?: boolean; paymentQrImage?: string | null; venueCapacity?: number | null }): Promise<Parish>;
  uploadPaymentQr(id: string, file: File): Promise<Parish>;
  deletePaymentQr(id: string): Promise<Parish>;
  archiveParish(id: string): Promise<void>;
  getMassSchedule(parishId: string): Promise<MassScheduleTemplate[]>;
  upsertMassSchedule(parishId: string, data: Partial<MassScheduleTemplate> & { dayType: string; timeSlot: string; label: string }): Promise<MassScheduleTemplate>;
  deleteMassSchedule(id: string): Promise<void>;
  resetMassSchedule(parishId: string): Promise<MassScheduleTemplate[]>;
  getMapConfig(): Promise<Parish[]>;
  batchUpdateMap(updates: {
    id: string;
    latitude: number;
    longitude: number;
    mapZoom?: number | null;
    pinColor?: string;
    showLabel?: boolean;
    locationUpdatedAt?: string | null;
  }[]): Promise<Parish[]>;
  updateDirectorySettings(id: string, data: {
    directoryDescription?: string | null;
    contactNumber?: string | null;
    email?: string | null;
  }): Promise<Parish>;
  uploadParishImage(id: string, type: 'cover' | 'logo', file: File): Promise<{ url: string; type: string }>;
}

export interface UserProvider {
  getUsers(filters: UserFilters): Promise<ManagedUser[]>;
  addUser(payload: AddUserPayload): Promise<{ user: ManagedUser; setupLink?: string }>;
  editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser>;
  disableUser(id: string): Promise<void>;
  enableUser(id: string): Promise<void>;
  resetPassword(id: string): Promise<string>;
  updateUserColor(id: string, color: string | null): Promise<ManagedUser>;
}

export interface ParishAvailability {
  id: string;
  parishId: string;
  userId?: string | null;
  type: 'PARISH_CLOSED' | 'SECRETARY_LEAVE' | 'PRIEST_LEAVE' | 'FULLY_BOOKED';
  startDate: string;
  endDate: string;
  title: string;
  description?: string;
  user?: {
    fullName: string;
    email: string;
  } | null;
}

export interface AvailabilityProvider {
  getAvailabilities(parishId?: string, startDate?: string, endDate?: string): Promise<ParishAvailability[]>;
  createAvailability(data: Omit<ParishAvailability, 'id'>): Promise<ParishAvailability>;
  deleteAvailability(id: string): Promise<void>;
}
