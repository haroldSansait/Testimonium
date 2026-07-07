import type { AnalyticsProvider } from '../interfaces';
import { sacramentStats, documentStats, parishStats, financialStats } from '@/mock/analytics';

export const ApiAnalyticsProvider: AnalyticsProvider = {
  async getSacramentStats() {
    console.warn('[ApiAnalyticsProvider] getSacramentStats is not yet implemented on the backend. Falling back to mock data.');
    return [...sacramentStats];
  },
  async getDocumentStats() {
    console.warn('[ApiAnalyticsProvider] getDocumentStats is not yet implemented on the backend. Falling back to mock data.');
    return [...documentStats];
  },
  async getParishStats() {
    console.warn('[ApiAnalyticsProvider] getParishStats is not yet implemented on the backend. Falling back to mock data.');
    return [...parishStats];
  },
  async getFinancialStats() {
    console.warn('[ApiAnalyticsProvider] getFinancialStats is not yet implemented on the backend. Falling back to mock data.');
    return [...financialStats];
  }
};
