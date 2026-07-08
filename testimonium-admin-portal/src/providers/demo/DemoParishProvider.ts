import type { ParishProvider, ParishFilters } from '../interfaces';
import type { Parish } from '@/types';
import { parishes as mockParishes } from '@/mock/parishes';
import { DemoUserProvider } from './DemoUserProvider';

let store: Parish[] = [...mockParishes];

export const DemoParishProvider: ParishProvider = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    const { search = '', type = 'all', status = 'all' } = filters;
    let result = [...store];

    // Resolve staff IDs dynamically from DemoUserProvider
    const users = await DemoUserProvider.getUsers({});
    result.forEach((p) => {
      const priest = users.find((u) => u.parish === p.name && u.role === 'PRIEST');
      p.priestId = priest ? priest.id : null;
      p.priestName = priest ? priest.name : 'Unassigned';
      p.priest = priest ? priest.name : 'Unassigned';

      const secretary = users.find((u) => u.parish === p.name && u.role === 'SECRETARY');
      p.secretaryId = secretary ? secretary.id : null;
      p.secretaryName = secretary ? secretary.name : 'Unassigned';
      p.secretary = secretary ? secretary.name : 'Unassigned';
    });

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
    const parish = store.find((p) => p.id === id);
    if (!parish) throw new Error(`Parish ${id} not found`);

    // Priest update
    if (data.priestId !== undefined) {
      const users = await DemoUserProvider.getUsers({});
      const currentPriest = users.find((u) => u.parish === parish.name && u.role === 'PRIEST');
      
      // Unassign current priest
      if (currentPriest && currentPriest.id !== data.priestId) {
        await DemoUserProvider.editUser(currentPriest.id, { parish: 'None' });
      }

      // Assign new priest
      if (data.priestId) {
        const newPriest = users.find((u) => u.id === data.priestId);
        if (newPriest) {
          await DemoUserProvider.editUser(newPriest.id, { parish: parish.name });
          parish.priest = newPriest.name;
          parish.priestId = newPriest.id;
          parish.priestName = newPriest.name;
        }
      } else {
        parish.priest = 'Unassigned';
        parish.priestId = null;
        parish.priestName = 'Unassigned';
      }
    }

    // Secretary update
    if (data.secretaryId !== undefined) {
      const users = await DemoUserProvider.getUsers({});
      const currentSecretary = users.find((u) => u.parish === parish.name && u.role === 'SECRETARY');
      
      // Unassign current secretary
      if (currentSecretary && currentSecretary.id !== data.secretaryId) {
        await DemoUserProvider.editUser(currentSecretary.id, { parish: 'None' });
      }

      // Assign new secretary
      if (data.secretaryId) {
        const newSecretary = users.find((u) => u.id === data.secretaryId);
        if (newSecretary) {
          await DemoUserProvider.editUser(newSecretary.id, { parish: parish.name });
          parish.secretary = newSecretary.name;
          parish.secretaryId = newSecretary.id;
          parish.secretaryName = newSecretary.name;
        }
      } else {
        parish.secretary = 'Unassigned';
        parish.secretaryId = null;
        parish.secretaryName = 'Unassigned';
      }
    }

    store = store.map((p) =>
      p.id === id
        ? {
            ...p,
            ...data,
            priest: parish.priest,
            priestId: parish.priestId,
            priestName: parish.priestName,
            secretary: parish.secretary,
            secretaryId: parish.secretaryId,
            secretaryName: parish.secretaryName,
          }
        : p
    );
    const updated = store.find((p) => p.id === id);
    if (!updated) throw new Error(`Parish ${id} not found`);
    return updated;
  },

  async archiveParish(id: string): Promise<void> {
    store = store.map((p) => (p.id === id ? { ...p, status: 'Archived' } : p));
    return Promise.resolve();
  },
};
