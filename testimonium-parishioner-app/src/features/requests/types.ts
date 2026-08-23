/**
 * Canonical Document Request Types and Models
 */

export const CANONICAL_DOCUMENT_TYPES = [
  "BAPTISMAL_CERTIFICATE",
  "CONFIRMATION_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "FIRST_COMMUNION_CERTIFICATE",
  "MARRIAGE_BANNS",
  "PERMIT_TO_MARRY",
  "STATUS_OF_LIBERTY",
] as const;

export type CanonicalDocumentType = (typeof CANONICAL_DOCUMENT_TYPES)[number];

export type DocumentRequestStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "NEEDS_CORRECTION"
  | "PAYMENT_PENDING"
  | "PAYMENT_UNDER_REVIEW"
  | "PAYMENT_NEEDS_CORRECTION"
  | "PAYMENT_VERIFIED"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PROOF_SUBMITTED" | "CONFIRMED";

export interface RequiredField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export interface RequiredDocument {
  id: string;
  label: string;
  category: string;
  required: boolean;
  description?: string;
}

export interface DocumentRequirement {
  documentType: CanonicalDocumentType | string;
  title: string;
  description: string;
  estimatedProcessingDays: number;
  baseFee: number;
  requiredFields: RequiredField[];
  requiredDocuments: RequiredDocument[];
}

export interface RequestAttachment {
  id: number;
  requestId: number;
  fileName: string;
  r2ObjectKey?: string;
  fileType?: string | null;
  fileSize?: number | null;
  category: string;
  uploadedAt: string;
  publicUrl?: string | null;
}

export interface RequestHistoryItem {
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
}

export interface OcrResultSummary {
  id: number;
  status: string;
  referenceNumber?: string | null;
  amount?: string | null;
  confidenceScore?: number | null;
  isDuplicate?: boolean;
}

export interface ReceiptUpload {
  id: number;
  paymentTransactionId: number;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedAt: string;
  ocrResult?: OcrResultSummary | null;
}

export interface PaymentTransaction {
  id: number;
  requestId: number;
  amount?: string | number | null;
  provider?: string | null;
  referenceNumber?: string | null;
  status: string;
  createdAt: string;
  receipts?: ReceiptUpload[];
}

export interface ParishSummary {
  id: number;
  parishName: string;
  type?: string | null;
  municipalityCity?: string | null;
  province?: string | null;
}

export interface DocumentRequestDetail {
  id: number;
  userId: number;
  parishId: number;
  trackingNumber: string | null;
  applicantName: string;
  relationship?: string | null;
  purpose?: string | null;
  isDraft: boolean;
  documentType: CanonicalDocumentType | string;
  status: DocumentRequestStatus;
  paymentStatus: PaymentStatus;
  fee?: number | string | null;
  remarks?: string | null;
  correctionNote?: string | null;
  paymentCorrectionNote?: string | null;
  correctionRequirementIds?: string[];
  dateRequested: string;
  dateProcessed?: string | null;
  createdAt: string;
  updatedAt: string;
  parish?: ParishSummary | null;
  attachments?: RequestAttachment[];
  requestHistory?: RequestHistoryItem[];
  paymentTransactions?: PaymentTransaction[];
}

export interface DocumentRequestListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentRequestStatus | string;
  documentType?: CanonicalDocumentType | string;
}

export interface DocumentRequestListResponse {
  data: DocumentRequestDetail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateDraftRequestPayload {
  parishId: number;
  documentType: CanonicalDocumentType | string;
  applicantName: string;
  relationship?: string;
  purpose?: string;
  idempotencyKey?: string;
}

export interface LocalSelectedFile {
  requirementId: string;
  requirementLabel: string;
  name: string;
  uri: string;
  size?: number;
  mimeType?: string | null;
}

export interface LocalSelectedReceipt {
  uri: string;
  name: string;
  size?: number;
  mimeType: "image/jpeg" | "image/png";
}

export interface PaymentQrCode {
  enabled: boolean;
  imageUrl: string | null;
}

export interface PaymentConfiguration {
  configured: boolean;
  qrCode: PaymentQrCode;
  message?: string;
}
