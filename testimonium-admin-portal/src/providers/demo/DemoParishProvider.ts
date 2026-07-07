import type { ParishProvider, ParishFilters } from '../interfaces';
import type { Parish } from '@/types';
import { parishes as mockParishes } from '@/mock/parishes';

let store: Parish[] = [...mockParishes];

export const DemoParishProvider: ParishProvider = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    const { search = '', type = 'all', status = 'all' } = filters;
    let result = [...store];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.priest.toLowerCase().includes(q) ||
          p.secretary.toLowerCase().includes(q)
      );
    }
    if (type !== 'all') {
      result = result.filter((p) => p.type === type);
    }
    if (status !== 'all') {
      result = result.filter((p) => p.status === status);
    }

    return result;
  },

  async addParish(data: Omit<Parish, 'id' | 'status'>): Promise<Parish> {
    const newParish: Parish = {
      ...data,
      id: `parish-${Date.now()}`,
      status: 'Active',
    };
    store = [newParish, ...store];
    return newParish;
  },

  async editParish(id: string, data: Partial<Parish>): Promise<Parish> {
    store = store.map((p) => (p.id === id ? { ...p, ...data } : p));
    const updated = store.find((p) => p.id === id);
    if (!updated) throw new Error(`Parish ${id} not found`);
    return updated;
  },

  async archiveParish(id: string): Promise<void> {
    store = store.map((p) => (p.id === id ? { ...p, status: 'Archived' } : p));
    return Promise.resolve();
  },
};
