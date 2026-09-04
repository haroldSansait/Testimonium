export const UserRole = {
  PARISHIONER: 'PARISHIONER',
  SECRETARY: 'SECRETARY',
  PRIEST: 'PRIEST',
  DIOCESE_COORDINATOR: 'DIOCESE_COORDINATOR'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Parish {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  coordinates: { lat: number; lng: number };
  coverImage: string;
  gallery: string[];
  phone: string;
  email: string;
  facebookPage: string;
  officeHours: string | Record<string, unknown> | null;
  patronSaint: string;
  feastDay: string;
  description: string;
  assignedPriest: string;
  assignedSecretary: string;
  massSchedules: string[];
  upcomingEvents: string[];
  services: string[];
  logoImage?: string;
  pinColor?: string;
  showLabel?: boolean;
  directoryDescription?: string;
  paymentQrImage?: string | null;
  paymentQrEnabled?: boolean;
  availableDocuments?: string[] | null;
  venueCapacity?: number | null;
  eventSettings?: any;
  councils?: {
    pastoral: {
      members: Array<{
        positionTitle: string;
        memberName: string;
      }>;
    };
    finance: {
      members: Array<{
        positionTitle: string;
        memberName: string;
      }>;
    } | null;
  } | null;
}

export type RequestStatus =
  | 'pending'
  | 'under-review'
  | 'awaiting-information'
  | 'payment-pending'
  | 'payment-verification'
  | 'payment-under-review'
  | 'payment-needs-correction'
  | 'processing'
  | 'ready'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'needs-correction'
  | 'needs_correction';

export interface RequestAttachment {
  id: number;
  requestId: number;
  fileName: string;
  r2ObjectKey: string;
  fileType?: string | null;
  fileSize?: number | null;
  category: string; // "primary" | "supporting" | "receipt"
  uploadedAt: string;
}

export interface PaymentTransaction {
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
      processedAt: string;
    } | null;
  }[];
}

export interface RequestHistoryEntry {
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
  } | null;
}

export interface SacramentalRequest {
  id: string;
  trackingNumber: string | null;
  parishId: string;
  documentType: 'baptism' | 'confirmation' | 'marriage' | 'death' | 'other' | 'marriage-banns' | 'permit-to-marry' | 'status-of-liberty' | 'first-communion' | 'BAPTISMAL_CERTIFICATE' | 'CONFIRMATION_CERTIFICATE' | 'MARRIAGE_CERTIFICATE' | 'FIRST_COMMUNION_CERTIFICATE' | 'MARRIAGE_BANNS' | 'PERMIT_TO_MARRY' | 'STATUS_OF_LIBERTY';
  fee?: number | null;
  status: RequestStatus;
  applicantName: string;
  relationship: string;
  purpose: string;
  isDraft: boolean;
  submittedAt: string;
  updatedAt: string;
  requirements: string[]; // for backward compatibility/demo
  attachments?: RequestAttachment[];
  paymentTransactions?: PaymentTransaction[];
  requestHistory?: RequestHistoryEntry[];
  paymentStatus?: 'unpaid' | 'proof-submitted' | 'confirmed' | 'UNPAID' | 'PROOF_SUBMITTED' | 'CONFIRMED';
  rejectionReason?: string;
  instructions?: string;
  correctionRequirementIds?: string[];
  correctionNote?: string | null;
  paymentCorrectionNote?: string | null;
}

export interface Appointment {
  id: string;
  parishId: string;
  parishName?: string;
  serviceName: string;
  date: string;
  timeSlot: string;
  status: 'booked' | 'confirmed' | 'cancelled' | 'proposed' | 'tentative';
  confirmationNumber: string;
  proposedDate?: string;
  proposedTime?: string;
  rescheduleReason?: string;
  assignedPriestId?: string | number | null;
  assignedPriestName?: string | null;
  priestResponseStatus?: 'ACCEPTED' | 'REJECTED' | 'PENDING' | null;
  remarks?: string | null;
  notes?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

export type NotificationType =
  | 'document-submitted'
  | 'document-approved'
  | 'document-ready'
  | 'document-completed'
  | 'document-cancelled'
  | 'document-rejected'
  | 'payment-requested'
  | 'payment-verified'
  | 'appointment-confirmed'
  | 'appointment-declined'
  | 'appointment-submitted'
  | 'announcement'
  | 'general';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  referenceType?: 'DOCUMENT_REQUEST' | 'SCHEDULE_REQUEST' | 'GENERAL' | null;
  referenceId?: number | null;
}


export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  displayName?: string;
  phone?: string;
  address?: string;
  photoURL?: string;
  notificationsEnabled: boolean;
  parishId?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  category: 'Holy Mass' | 'Baptism' | 'Wedding' | 'Confirmation' | 'Funeral' | 'Fiesta' | 'Seminar' | 'Other';
  parishId: string;
  parishName: string;
  coverImage: string;
  coverImageAlt: string;
  gallery?: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  organizer: string;
  contactPerson: string;
  contactNumber: string;
  featured: boolean;
  status: 'upcoming' | 'ongoing' | 'completed';
  registrationRequired: boolean;
  maxParticipants?: number;
  currentParticipants?: number;
}
