import { providerFactory } from '@/providers/providerFactory';
import type {
  SacramentStat,
  DocumentAnalyticsStat,
  ParishAnalyticsStat,
  FinancialStat,
} from '@/types';

export const AnalyticsService = {
  async getOverviewStats(): Promise<any> {
    return providerFactory.getAnalyticsProvider().getOverviewStats();
  },

  async getSacramentStats(): Promise<SacramentStat[]> {
    return providerFactory.getAnalyticsProvider().getSacramentStats();
  },

  async getDocumentStats(): Promise<DocumentAnalyticsStat[]> {
    return providerFactory.getAnalyticsProvider().getDocumentStats();
  },

  async getParishStats(): Promise<ParishAnalyticsStat[]> {
    return providerFactory.getAnalyticsProvider().getParishStats();
  },

  async getFinancialStats(): Promise<FinancialStat[]> {
    return providerFactory.getAnalyticsProvider().getFinancialStats();
  },
};
