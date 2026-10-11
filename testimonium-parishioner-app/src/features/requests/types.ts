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
  | "READY_FOR_SIGNING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "RETURNED"
  | "REJECTED"
  | "CANCELLED";

export const DOCUMENT_RETURN_REASONS = [
  { code: "TYPOGRAPHICAL_OR_SPELLING", label: "Typographical or Spelling Error" },
  { code: "INCORRECT_NAME", label: "Incorrect Name" },
  { code: "INCORRECT_SACRAMENTAL_DATE", label: "Incorrect Sacramental Date" },
  { code: "INCORRECT_RECORD_INFORMATION", label: "Incorrect Record Information" },
  { code: "MISSING_INFORMATION", label: "Missing Information" },
  { code: "WRONG_DOCUMENT_ISSUED", label: "Wrong Document Issued" },
  { code: "PRINTING_OR_FORMAT_DEFECT", label: "Printing or Formatting Defect" },
  { code: "OTHER_ISSUED_DOCUMENT_ERROR", label: "Other Issued Document Error" },
] as const;

export type DocumentReturnReasonCode = (typeof DOCUMENT_RETURN_REASONS)[number]["code"];

export interface DocumentReturn {
  id: number;
  requestId: number;
  cycleNumber: number;
  reasonCode: string;
  notes?: string | null;
  returnedFileName: string;
  returnedFileSize?: number | null;
  returnedFileType?: string | null;
  returnedAt: string;
  correctedFileName?: string | null;
  correctedFileSize?: number | null;
  correctedFileType?: string | null;
  correctedAt?: string | null;
  correctedRevision?: number;
  createdAt: string;
  updatedAt: string;
}

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
  relationshipEvidence?: RequiredDocument[];
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
  registrantIdEvidence?: {
    frontUploadedAt?: string | null;
    frontRevision: number;
    backUploadedAt?: string | null;
    backRevision: number;
    ocrStatus: string;
    updatedAt: string;
  } | null;
  requestHistory?: RequestHistoryItem[];
  paymentTransactions?: PaymentTransaction[];
  returns?: DocumentReturn[];
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
  applicantName?: string;
  applicantFirstName?: string;
  applicantMiddleName?: string;
  applicantLastName?: string;
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

export interface LocalRegistrantIdImage {
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

export interface ReceiptUploadResponse {
  autoVerified: boolean;
  ocrPending: boolean;
  receiptId: number;
  ocrStatus: string;
}
