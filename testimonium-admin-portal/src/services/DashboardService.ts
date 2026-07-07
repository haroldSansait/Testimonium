import { providerFactory } from '@/providers/providerFactory';
import type { StatCardData, TodayScheduleItem, RecentAlert } from '@/types';

export const DashboardService = {
  async getStats(): Promise<StatCardData[]> {
    return providerFactory.getDashboardProvider().getStats();
  },

  async getTodaySchedule(): Promise<TodayScheduleItem[]> {
    return providerFactory.getDashboardProvider().getTodaySchedule();
  },

  async getRecentAlerts(): Promise<RecentAlert[]> {
    return providerFactory.getDashboardProvider().getRecentAlerts();
  },
};
