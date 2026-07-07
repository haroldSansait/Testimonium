import { providerFactory } from '@/providers/providerFactory';
import type { Parish } from '@/types';

export interface ParishFilters {
  search?: string;
  type?: string;
  status?: string;
}

export const ParishManagementService = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    return providerFactory.getParishProvider().getParishes(filters);
  },

  async addParish(data: Omit<Parish, 'id' | 'status'>): Promise<Parish> {
    return providerFactory.getParishProvider().addParish(data);
  },

  async editParish(id: string, data: Partial<Parish>): Promise<Parish> {
    return providerFactory.getParishProvider().editParish(id, data);
  },

  async archiveParish(id: string): Promise<void> {
    return providerFactory.getParishProvider().archiveParish(id);
  },
};
