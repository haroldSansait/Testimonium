import api from '@/api/api';
import type { DocumentProvider, DocumentRequestFilters } from '../interfaces';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';
import { mapDocumentStatusToBackend } from './documentStatusMapping';

interface BackendDocumentRequestDTO {
  id: number;
  userId: number;
  parishId: number;
  trackingNumber: string | null;
  applicantName: string;
  relationship: string | null;
  documentType: string;
  purpose: string | null;
  status: string;
  paymentStatus: string;
  paymentProofObjectKey: string | null;
  paymentQrReference: string | null;
  processedById: number | null;
  remarks: string | null;
  correctionNote?: string | null;
  paymentCorrectionNote?: string | null;
  correctionRequirementIds?: string[];
  dateRequested: string;
  dateProcessed: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
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
        processedAt: string;
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

const mapDocumentStatus = (status: string): DocumentStatus => {
  switch (status) {
    case 'PENDING':
      return 'Pending Review';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'PAYMENT_PENDING':
      return 'Payment Pending';
    case 'PAYMENT_UNDER_REVIEW':
      return 'Awaiting Payment Review';
    case 'PAYMENT_NEEDS_CORRECTION':
      return 'Payment Needs Correction';
    case 'PAYMENT_VERIFIED':
      return 'Payment Verified';
    case 'PROCESSING':
      return 'Processing';
    case 'READY_FOR_SIGNING':
      return 'Ready for Signing';
    case 'READY_FOR_PICKUP':
      return 'Ready for Pickup';
    case 'NEEDS_CORRECTION':
      return 'Needs Correction';
    case 'COMPLETED':
      return 'Released';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Pending Review';
  }
};

const mapDocumentType = (type: string): DocumentType => {
  switch (type) {
    case 'BAPTISMAL_CERTIFICATE':
      return 'Baptismal Certificate';
    case 'MARRIAGE_CERTIFICATE':
      return 'Marriage Certificate';
    case 'CONFIRMATION_CERTIFICATE':
      return 'Confirmation Certificate';
    case 'FIRST_COMMUNION_CERTIFICATE':
      return 'Confirmation Certificate';
    default:
      return 'Baptismal Certificate';
  }
};

const mapToFrontend = (dbItem: BackendDocumentRequestDTO): DocumentRequest => {
  const dateSubmitted = new Date(dbItem.createdAt || dbItem.dateRequested).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const timeline = dbItem.requestHistory && dbItem.requestHistory.length > 0
    ? dbItem.requestHistory.map(h => {
        const staffName = h.actor?.fullName ? ` by ${h.actor.fullName}` : '';
        return {
          status: mapDocumentStatus(h.newStatus || h.oldStatus || 'PENDING'),
          date: new Date(h.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          note: `${h.remarks || h.action}${staffName}`
        };
      })
    : [
        { status: 'Pending Review' as DocumentStatus, date: dateSubmitted, note: 'Request received.' }
      ];

  return {
    id: String(dbItem.id),
    parishId: String(dbItem.parishId),
    referenceNo: dbItem.trackingNumber || `REQ-${new Date(dbItem.createdAt || dbItem.dateRequested).getFullYear()}-${String(dbItem.id).padStart(4, '0')}`,
    trackingNumber: dbItem.trackingNumber || '',
    applicantName: dbItem.applicantName || '',
    relationship: dbItem.relationship || 'Self',
    parishionerName: dbItem.user?.fullName || dbItem.applicantName || 'Anonymous',
    documentType: mapDocumentType(dbItem.documentType),
    dateSubmitted,
    status: mapDocumentStatus(dbItem.status),
    purpose: dbItem.purpose || 'Official Use',
    paymentStatus: dbItem.paymentStatus === 'CONFIRMED' || dbItem.paymentStatus === 'PROOF_SUBMITTED' ? 'Paid' : 'Pending',
    requirements: ['Government Issued ID', 'Parishioner Certificate'],
    correctionRequirementIds: dbItem.correctionRequirementIds || [],
    correctionNote: dbItem.correctionNote || null,
    paymentCorrectionNote: dbItem.paymentCorrectionNote || null,
    attachments: dbItem.attachments || [],
    paymentTransactions: dbItem.paymentTransactions || [],
    requestHistory: dbItem.requestHistory || [],
    timeline
  };
};

// Local optimistic cache
const optimisticDocumentStatuses: Record<string, DocumentStatus> = {};

export const ApiDocumentProvider: DocumentProvider = {
  async getDocumentRequests(
    filters: DocumentRequestFilters = {}
  ): Promise<PaginatedResponse<DocumentRequest>> {
    const { search, documentType, status, page = 1, pageSize = 5 } = filters;

    // Map filters back to backend values
    const backendStatus = mapDocumentStatusToBackend(status);

    let backendDocType = documentType;
    if (documentType && documentType !== 'all') {
      if (documentType === 'Baptismal Certificate') backendDocType = 'BAPTISMAL_CERTIFICATE' as any;
      else if (documentType === 'Marriage Certificate') backendDocType = 'MARRIAGE_CERTIFICATE' as any;
      else if (documentType === 'Confirmation Certificate') backendDocType = 'CONFIRMATION_CERTIFICATE' as any;
    }

    const response = await api.get<BackendPaginatedResponse<BackendDocumentRequestDTO>>('/document-requests', {
      params: {
        ...(search ? { search } : {}),
        ...(backendDocType && backendDocType !== 'all' ? { documentType: backendDocType } : {}),
        ...(backendStatus && backendStatus !== 'all' ? { status: backendStatus } : {}),
        page,
        limit: pageSize,
      },
    });

    const mappedData = (response.data.data || []).map(mapToFrontend).map(item => {
      if (optimisticDocumentStatuses[item.id]) {
        return { ...item, status: optimisticDocumentStatuses[item.id] };
      }
      return item;
    });

    return {
      data: mappedData,
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      pageSize: response.data.pagination?.limit || pageSize,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  async updateDocumentStatus(id: string, status: DocumentStatus, remarks?: string, correctionRequirementIds?: string[]): Promise<DocumentRequest> {
    const backendStatus = mapDocumentStatusToBackend(status) || 'PENDING';

    optimisticDocumentStatuses[id] = status;

    try {
      const response = await api.patch<{ data: BackendDocumentRequestDTO }>(`/document-requests/${id}/status`, { status: backendStatus, remarks, correctionRequirementIds });
      const updated = mapToFrontend(response.data.data);
      return { ...updated, status };
    } catch (error) {
      delete optimisticDocumentStatuses[id];
      throw error;
    } finally {
      setTimeout(() => {
        delete optimisticDocumentStatuses[id];
      }, 1500);
    }
  }
};

