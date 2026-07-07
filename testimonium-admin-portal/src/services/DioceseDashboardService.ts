import { providerFactory } from '@/providers/providerFactory';
import type { DioceseStat, DioceseActivity, DioceseNotification } from '@/types';

export const DioceseDashboardService = {
  async getStats(): Promise<DioceseStat[]> {
    return providerFactory.getDioceseDashboardProvider().getStats();
  },

  async getRecentActivity(): Promise<DioceseActivity[]> {
    return providerFactory.getDioceseDashboardProvider().getRecentActivity();
  },

  async getNotifications(): Promise<DioceseNotification[]> {
    return providerFactory.getDioceseDashboardProvider().getNotifications();
  },
};
