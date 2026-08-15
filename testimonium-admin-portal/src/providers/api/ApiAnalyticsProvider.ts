import api from '@/api/api';
import type { AnalyticsProvider } from '../interfaces';
import type { SacramentStat, DocumentAnalyticsStat, ParishAnalyticsStat } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiAnalyticsProvider: AnalyticsProvider = {
  async getOverviewStats(): Promise<any> {
    const response = await api.get<ApiResponseEnvelope<any>>('/analytics/overview');
    return response.data.data;
  },
  async getSacramentStats(): Promise<SacramentStat[]> {
    const response = await api.get<ApiResponseEnvelope<SacramentStat[]>>('/analytics/sacraments');
    return response.data.data;
  },
  async getDocumentStats(): Promise<DocumentAnalyticsStat[]> {
    const response = await api.get<ApiResponseEnvelope<DocumentAnalyticsStat[]>>('/analytics/documents');
    return response.data.data;
  },
  async getParishStats(): Promise<ParishAnalyticsStat[]> {
    const response = await api.get<ApiResponseEnvelope<ParishAnalyticsStat[]>>('/analytics/parishes');
    return response.data.data;
  },
};
