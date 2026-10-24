import { providerFactory } from '@/providers/providerFactory';
import type { DocumentRequest, DocumentStatus, DocumentType, DocumentReturn } from '@/types';
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

export async function verifyCashPayment(id: string): Promise<DocumentRequest> {
  return providerFactory.getDocumentProvider().verifyCashPayment(id);
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  remarks?: string,
  correctionRequirementIds?: string[],
  correctionReasonCode?: string,
  correctionNote?: string
): Promise<DocumentRequest> {
  return providerFactory.getDocumentProvider().updateDocumentStatus(
    id,
    status,
    remarks,
    correctionRequirementIds,
    correctionReasonCode,
    correctionNote
  );
}

export async function uploadCorrectedDocument(
  id: string,
  file: File
): Promise<DocumentReturn> {
  const provider = providerFactory.getDocumentProvider();
  if (provider.uploadCorrectedDocument) {
    return provider.uploadCorrectedDocument(id, file);
  }
  throw new Error('Upload corrected document not supported by provider');
}

export async function getReturnHistory(
  id: string
): Promise<DocumentReturn[]> {
  const provider = providerFactory.getDocumentProvider();
  if (provider.getReturnHistory) {
    return provider.getReturnHistory(id);
  }
  return [];
}
