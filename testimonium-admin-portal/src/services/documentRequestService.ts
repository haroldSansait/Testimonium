import { providerFactory } from '@/providers/providerFactory';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import type { PaginatedResponse } from '@/types/api';

export interface DocumentRequestFilters {
  search?: string;
  documentType?: DocumentType | 'all';
  status?: DocumentStatus | 'all';
  page?: number;
  pageSize?: number;
}

export async function getDocumentRequests(
  filters: DocumentRequestFilters = {}
): Promise<PaginatedResponse<DocumentRequest>> {
  return providerFactory.getDocumentProvider().getDocumentRequests(filters);
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  remarks?: string,
  correctionRequirementIds?: string[]
): Promise<DocumentRequest> {
  return providerFactory.getDocumentProvider().updateDocumentStatus(id, status, remarks, correctionRequirementIds);
}
