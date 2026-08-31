import api from '@/api/api';
import type { ApiResponseEnvelope } from '@/types/api';

export type ReportScope = 'PARISH' | 'DIOCESE';
export type ReportCategory = 'MEETING' | 'ACTIVITY' | 'IMPORTANT_EVENT' | 'OTHER';

export interface DailyReport {
  id: number;
  reportDate: string;
  scope: ReportScope;
  parishId: number | null;
  title: string;
  category: ReportCategory;
  description: string;
  version: number;
  isArchived: boolean;
  parish: { id: number; parishName: string } | null;
  createdBy: { id: number; fullName: string };
  updatedAt: string;
}

export interface ReportPayload {
  reportDate: string;
  scope: ReportScope;
  parishId?: number | null;
  title: string;
  category: ReportCategory;
  description: string;
}

export const reportsApi = {
  async list(params: Record<string, unknown>) {
    const response = await api.get<{ success: boolean; data: DailyReport[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/reports', { params });
    return response.data;
  },
  async create(payload: ReportPayload) {
    const response = await api.post<ApiResponseEnvelope<DailyReport>>('/reports', payload);
    return response.data.data;
  },
  async update(id: number, payload: ReportPayload & { expectedVersion: number }) {
    const response = await api.patch<ApiResponseEnvelope<DailyReport>>('/reports/' + id, payload);
    return response.data.data;
  },
  async archive(id: number, expectedVersion: number) {
    const response = await api.delete<ApiResponseEnvelope<DailyReport>>('/reports/' + id, { params: { expectedVersion } });
    return response.data.data;
  },
};
