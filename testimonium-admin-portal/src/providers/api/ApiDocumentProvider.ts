import api from '@/api/api';
import type { DocumentProvider, DocumentRequestFilters } from '../interfaces';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';

interface BackendDocumentRequestDTO {
  id: number;
  userId: number;
  parishId: number;
  documentType: string;
  purpose: string | null;
  status: string;
  paymentStatus: string;
  paymentProofObjectKey: string | null;
  paymentQrReference: string | null;
  processedById: number | null;
  remarks: string | null;
  dateRequested: string;
  dateProcessed: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

const mapDocumentStatus = (status: string): DocumentStatus => {
  switch (status) {
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'PAYMENT_PENDING':
      return 'Pending Review';
    case 'PAYMENT_VERIFIED':
    case 'PROCESSING':
      return 'Processing';
    case 'READY_FOR_PICKUP':
      return 'Ready for Pickup';
    case 'COMPLETED':
      return 'Released';
    case 'REJECTED':
    case 'CANCELLED':
      return 'Rejected';
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

  return {
    id: String(dbItem.id),
    referenceNo: `REQ-${new Date(dbItem.createdAt || dbItem.dateRequested).getFullYear()}-${String(dbItem.id).padStart(4, '0')}`,
    parishionerName: dbItem.user?.fullName || 'Anonymous',
    documentType: mapDocumentType(dbItem.documentType),
    dateSubmitted,
    status: mapDocumentStatus(dbItem.status),
    purpose: dbItem.purpose || 'Official Use',
    paymentStatus: dbItem.paymentStatus === 'PAID' || dbItem.paymentStatus === 'VERIFIED' ? 'Paid' : 'Pending',
    requirements: ['Government Issued ID', 'Parishioner Certificate'],
    timeline: [
      { status: 'Pending Review', date: dateSubmitted, note: 'Request received.' },
      ...(dbItem.status !== 'PENDING' ? [{ status: 'Processing', date: dateSubmitted, note: 'Document preparation in progress.' }] : []),
      ...(dbItem.status === 'READY_FOR_PICKUP' ? [{ status: 'Ready for Pickup', date: dateSubmitted, note: 'Document is ready for pickup.' }] : []),
      ...(dbItem.status === 'COMPLETED' ? [{ status: 'Released', date: dateSubmitted, note: 'Document collected.' }] : []),
    ]
  };
};

export const ApiDocumentProvider: DocumentProvider = {
  async getDocumentRequests(
    filters: DocumentRequestFilters = {}
  ): Promise<PaginatedResponse<DocumentRequest>> {
    const { search, documentType, status, page = 1, pageSize = 5 } = filters;

    // If status / documentType is passed in frontend format, map it to backend format
    let backendStatus = status;
    if (status && status !== 'all') {
      if (status === 'Pending Review') backendStatus = 'PENDING' as any;
      else if (status === 'Processing') backendStatus = 'PROCESSING' as any;
      else if (status === 'Ready for Pickup') backendStatus = 'READY_FOR_PICKUP' as any;
      else if (status === 'Released') backendStatus = 'COMPLETED' as any;
      else if (status === 'Rejected') backendStatus = 'REJECTED' as any;
    }

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

    return {
      data: (response.data.data || []).map(mapToFrontend),
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      pageSize: response.data.pagination?.limit || pageSize,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  async updateDocumentStatus(id: string, status: DocumentStatus): Promise<DocumentRequest> {
    let backendStatus = 'PENDING';
    if (status === 'Processing') backendStatus = 'PROCESSING';
    else if (status === 'Ready for Pickup') backendStatus = 'READY_FOR_PICKUP';
    else if (status === 'Released') backendStatus = 'COMPLETED';
    else if (status === 'Rejected') backendStatus = 'REJECTED';
    else if (status === 'Needs Correction') backendStatus = 'NEEDS_CORRECTION';

    const response = await api.patch<{ data: BackendDocumentRequestDTO }>(`/document-requests/${id}/status`, { status: backendStatus });
    return mapToFrontend(response.data.data);
  }
};
