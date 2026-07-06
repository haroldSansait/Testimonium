import api from '@/api/api';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';

export interface DocumentRequestFilters {
  search?: string;
  documentType?: DocumentType | 'all';
  status?: DocumentStatus | 'all';
  page?: number;
  pageSize?: number;
}

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

export async function getDocumentRequests(
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

  const mappedData = (response.data.data || []).map((dbItem): DocumentRequest => {
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
    };
  });

  return {
    data: mappedData,
    total: response.data.pagination?.total || 0,
    page: response.data.pagination?.page || page,
    pageSize: response.data.pagination?.limit || pageSize,
    totalPages: response.data.pagination?.totalPages || 1,
  };
}
