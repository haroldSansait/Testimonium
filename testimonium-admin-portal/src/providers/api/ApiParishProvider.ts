import type { ParishProvider, ParishFilters } from '../interfaces';
import type { Parish } from '@/types';
import { DemoParishProvider } from '../demo/DemoParishProvider';

export const ApiParishProvider: ParishProvider = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    console.warn('[ApiParishProvider] getParishes is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoParishProvider.getParishes(filters);
  },

  async addParish(data: Omit<Parish, 'id' | 'status'>): Promise<Parish> {
    console.warn('[ApiParishProvider] addParish is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoParishProvider.addParish(data);
  },

  async editParish(id: string, data: Partial<Parish>): Promise<Parish> {
    console.warn('[ApiParishProvider] editParish is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoParishProvider.editParish(id, data);
  },

  async archiveParish(id: string): Promise<void> {
    console.warn('[ApiParishProvider] archiveParish is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoParishProvider.archiveParish(id);
  },
};
