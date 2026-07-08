import api from '@/api/api';
import type { DioceseDashboardProvider } from '../interfaces';
import type { DioceseStat, DioceseActivity, DioceseNotification } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiDioceseDashboardProvider: DioceseDashboardProvider = {
  async getStats(): Promise<DioceseStat[]> {
    const response = await api.get<ApiResponseEnvelope<DioceseStat[]>>('/diocese/stats');
    return response.data.data;
  },
  async getRecentActivity(): Promise<DioceseActivity[]> {
    const response = await api.get<ApiResponseEnvelope<DioceseActivity[]>>('/diocese/activity');
    return response.data.data;
  },
  async getNotifications(): Promise<DioceseNotification[]> {
    const response = await api.get<ApiResponseEnvelope<DioceseNotification[]>>('/diocese/notifications');
    return response.data.data;
  }
};
