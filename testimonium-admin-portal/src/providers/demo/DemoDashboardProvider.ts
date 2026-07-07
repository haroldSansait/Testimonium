import type { DashboardProvider } from '../interfaces';
import { statCards, todaySchedule, recentAlerts } from '@/mock/dashboard';

export const DemoDashboardProvider: DashboardProvider = {
  async getStats() {
    return [...statCards];
  },
  async getTodaySchedule() {
    return [...todaySchedule];
  },
  async getRecentAlerts() {
    return [...recentAlerts];
  }
};
