// ─── Document Requests ────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'Pending Review'
  | 'Under Review'
  | 'Payment Pending'
  | 'Awaiting Payment Review'
  | 'Payment Needs Correction'
  | 'Payment Verified'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Released'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'
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
  trackingNumber?: string;
  applicantName?: string;
  relationship?: string;
  parishionerName: string;
  documentType: DocumentType;
  dateSubmitted: string;
  status: DocumentStatus;
  purpose?: string;
  paymentStatus?: string;
  requirements?: string[];
  parishId?: string;
  correctionRequirementIds?: string[];
  correctionNote?: string | null;
  paymentCorrectionNote?: string | null;
  timeline?: { status: string; date: string; note?: string }[];
  attachments?: {
    id: number;
    requestId: number;
    fileName: string;
    r2ObjectKey: string;
    fileType?: string | null;
    fileSize?: number | null;
    category: string;
    uploadedAt: string;
  }[];
  paymentTransactions?: {
    id: number;
    requestId: number;
    amount: number | null;
    provider: string | null;
    referenceNumber: string | null;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    verifiedById?: number | null;
    verifiedAt?: string | null;
    createdAt: string;
    receipts?: {
      id: number;
      paymentTransactionId: number;
      r2ObjectKey: string;
      fileName: string;
      mimeType?: string | null;
      fileSize?: number | null;
      uploadedAt: string;
      ocrResult?: {
        id: number;
        receiptUploadId: number;
        referenceNumber?: string | null;
        amount?: string | null;
        paymentDate?: string | null;
        provider?: string | null;
        confidenceScore?: number | null;
        rawText?: string | null;
        status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
        // Expanded fields from OCR.space integration
        merchant?: string | null;
        paymentTime?: string | null;
        accountName?: string | null;
        ocrProvider?: string | null;
        ocrDurationMs?: number | null;
        originalFileSize?: number | null;
        compressedFileSize?: number | null;
        // Phase 2 additions
        ocrConfidence?: number | null;
        parserConfidence?: number | null;
        finalConfidence?: number | null;
        ocrEngine?: string | null;
        ocrLanguage?: string | null;
        normalizedAmount?: string | null;
        normalizedDate?: string | null;
        compressionWidth?: number | null;
        compressionQuality?: number | null;
      } | null;
    }[];
  }[];
  requestHistory?: {
    id: number;
    requestId: number;
    actorId?: number | null;
    action: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    remarks?: string | null;
    createdAt: string;
    actor?: {
      id: number;
      fullName: string;
      role?: {
        roleName: string;
      } | null;
    } | null;
  }[];
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
  | 'Confirmation'
  | 'Other';


export interface ScheduleRequest {
  id: string;
  referenceNo: string;
  parishionerName: string;
  initials: string;
  avatarColor?: string;
  eventType: EventType;
  rawEventType?: string;
  appointmentTitle?: string;
  preferredDate: string;
  preferredTime: string;
  status: ScheduleStatus;
  assignedPriest?: string;
  assignedPriestId?: string;
  parish?: string;
  parishId?: string;
  contactInfo?: string;
  notes?: string;
  proposedDate?: string;
  proposedTime?: string;
  rescheduleReason?: string;
  priestResponseStatus?: string | null;
  priestResponseReason?: string | null;
  timeline?: { status: string; date: string; note?: string }[];
  isParishEvent?: boolean;
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
  | 'warning'
  | 'document-under-review'
  | 'document-request'
  | 'schedule-request'
  | 'payment-uploaded'
  | 'payment-verified'
  | 'document-cancelled';

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
  referenceType?: string | null;
  referenceId?: string | null;
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
  priestId?: string;
  priestColor?: string;
  requestor?: string;
  status?: string;
  description?: string;
  location?: string;
  sourceType?: string;
  visibility?: 'PUBLIC' | 'PARISH_PRIVATE';
  version?: number | null;
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
  slug?: string;
  feastDay?: string;
  municipalityCity?: string;
  patronSaint?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  latitude?: number | null;
  longitude?: number | null;
  logoImage?: string;
  coverImage?: string;
  mapZoom?: number | null;
  pinColor?: string;
  showLabel?: boolean;
  directoryDescription?: string;
  locationUpdatedAt?: string | null;
  locationUpdatedBy?: number | null;
  documentSettings?: any;
  eventSettings?: any;
  officeHours?: any;
  paymentQrImage?: string | null;
  paymentQrEnabled?: boolean;
  paymentQrUpdatedAt?: string | null;
  paymentQrUpdatedBy?: number | null;
  availableDocuments?: string[] | null;
  venueCapacity?: number | null;
  schedulingConfigVersion?: number;
}

// ─── Parish Councils ──────────────────────────────────────────────────────────

export interface CouncilMemberDraft {
  uiKey: string;       // client-only stable React identity
  id?: number;         // persistent DB ID only when saved
  positionTitle: string;
  memberName: string;
  sortOrder?: number;
  photoUrl?: string | null;
}

export interface ParishCouncilConfig {
  parishId: string;
  version: number;
  financeCouncilEnabled: boolean;
  pastoralCouncilMembers: CouncilMemberDraft[];
  financeCouncilMembers: CouncilMemberDraft[];
}

export interface SaveCouncilPayload {
  expectedVersion: number;
  financeCouncilEnabled: boolean;
  pastoralCouncilMembers: Array<{
    id?: number;
    positionTitle: string;
    memberName: string;
  }>;
  financeCouncilMembers: Array<{
    id?: number;
    positionTitle: string;
    memberName: string;
  }>;
}

export interface ParishSelectorItem {
  id: string;
  name: string;
}

// ─── User Management ──────────────────────────────────────────────────────────

export type ManagedUserRole = 'DIOCESE_COORDINATOR' | 'SECRETARY' | 'PRIEST' | 'ASSISTANT_PRIEST' | 'PARISHIONER';
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
  color?: string | null;
  firebaseUid?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
  registrationDate?: string | null;
  createdAt?: string | null;
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
