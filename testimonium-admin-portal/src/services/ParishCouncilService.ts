import { providerFactory } from '@/providers/providerFactory';
import type {
  ParishCouncilConfig,
  SaveCouncilPayload,
  ParishSelectorItem,
} from '@/types';

export const ParishCouncilService = {
  async getCouncilConfig(parishId: string): Promise<ParishCouncilConfig> {
    return providerFactory.getParishProvider().getCouncilConfig(parishId);
  },

  async saveCouncil(
    parishId: string,
    payload: SaveCouncilPayload
  ): Promise<ParishCouncilConfig> {
    return providerFactory.getParishProvider().saveCouncil(parishId, payload);
  },

  async getParishesForSelector(): Promise<ParishSelectorItem[]> {
    return providerFactory.getParishProvider().getParishesForSelector();
  },
};
