import api from '@/api/api';
import type { BackendPaginatedResponse } from '@/types/api';
import type { CanonicalDocumentType, VerifiedPaymentItem } from '@/types';

export interface VerifiedPaymentsQueryParams {
  from?: string;
  to?: string;
  parishId?: string | number;
  documentType?: CanonicalDocumentType | string;
  search?: string;
  page?: number;
  limit?: number;
}

export const analyticsApi = {
  async getVerifiedPayments(
    params: VerifiedPaymentsQueryParams,
    options?: { signal?: AbortSignal }
  ): Promise<BackendPaginatedResponse<VerifiedPaymentItem>> {
    const response = await api.get<BackendPaginatedResponse<VerifiedPaymentItem>>(
      '/analytics/payments/verified',
      {
        params: {
          from: params.from || undefined,
          to: params.to || undefined,
          parishId: params.parishId || undefined,
          documentType: params.documentType || undefined,
          search: params.search || undefined,
          page: params.page || undefined,
          limit: params.limit || undefined,
        },
        signal: options?.signal,
      }
    );
    return response.data;
  },
};
