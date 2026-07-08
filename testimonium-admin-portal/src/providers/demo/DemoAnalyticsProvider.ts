import type { AnalyticsProvider } from '../interfaces';
import { sacramentStats, documentStats, parishStats, financialStats } from '@/mock/analytics';

export const DemoAnalyticsProvider: AnalyticsProvider = {
  async getOverviewStats() {
    return {
      totalDocumentRequests: 1206,
      totalScheduleRequests: 843,
      activeUsersCount: 3500,
      activeParishesCount: 7
    };
  },
  async getSacramentStats() {
    return [...sacramentStats];
  },
  async getDocumentStats() {
    return [...documentStats];
  },
  async getParishStats() {
    return [...parishStats];
  },
  async getFinancialStats() {
    return [...financialStats];
  }
};
