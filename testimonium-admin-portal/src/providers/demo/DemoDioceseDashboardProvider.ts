import type { DioceseDashboardProvider } from '../interfaces';
import { dioceseStats, dioceseRecentActivity, dioceseNotifications } from '@/mock/diocese';

export const DemoDioceseDashboardProvider: DioceseDashboardProvider = {
  async getStats() {
    return [...dioceseStats];
  },
  async getRecentActivity() {
    return [...dioceseRecentActivity];
  },
  async getNotifications() {
    return [...dioceseNotifications];
  }
};
