import type { AnalyticsProvider } from '../interfaces';
import { sacramentStats, documentStats, parishStats, financialStats } from '@/mock/analytics';

export const DemoAnalyticsProvider: AnalyticsProvider = {
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
