import type { DioceseDashboardProvider } from '../interfaces';
import { dioceseStats, dioceseRecentActivity, dioceseNotifications } from '@/mock/diocese';

export const ApiDioceseDashboardProvider: DioceseDashboardProvider = {
  async getStats() {
    console.warn('[ApiDioceseDashboardProvider] getStats is not yet implemented on the backend. Falling back to mock data.');
    return [...dioceseStats];
  },
  async getRecentActivity() {
    console.warn('[ApiDioceseDashboardProvider] getRecentActivity is not yet implemented on the backend. Falling back to mock data.');
    return [...dioceseRecentActivity];
  },
  async getNotifications() {
    console.warn('[ApiDioceseDashboardProvider] getNotifications is not yet implemented on the backend. Falling back to mock data.');
    return [...dioceseNotifications];
  }
};
