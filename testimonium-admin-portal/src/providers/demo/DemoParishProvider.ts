import type { ParishProvider, ParishFilters, MassScheduleTemplate } from '../interfaces';
import type { Parish } from '@/types';
import { parishes as mockParishes } from '@/mock/parishes';
import { DemoUserProvider } from './DemoUserProvider';

let store: Parish[] = [...mockParishes];
let massTemplates: MassScheduleTemplate[] = [];

const seedDemoMassTemplates = (parishId: string) => {
  const defaults: Omit<MassScheduleTemplate, 'id' | 'parishId' | 'isActive'>[] = [
    { dayType: "WEEKDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
    { dayType: "WEEKDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
    { dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Sunday Early Mass" },
    { dayType: "SUNDAY", timeSlot: "07:00 AM", label: "Sunday Morning Mass" },
    { dayType: "SUNDAY", timeSlot: "09:00 AM", label: "Sunday High Mass" },
    { dayType: "SUNDAY", timeSlot: "04:00 PM", label: "Sunday Afternoon Mass" },
    { dayType: "SUNDAY", timeSlot: "06:00 PM", label: "Sunday Evening Mass" },
  ];
  const items = defaults.map((d, index) => ({
    id: `demo-mt-${parishId}-${index}`,
    parishId,
    dayType: d.dayType as any,
    timeSlot: d.timeSlot,
    label: d.label,
    isActive: true
  }));
  massTemplates = [...massTemplates, ...items];
};

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

  async editParishSettings(id: string, data: { documentSettings?: any; eventSettings?: any; officeHours?: any; availableDocuments?: string[]; paymentQrEnabled?: boolean }): Promise<Parish> {
    store = store.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          documentSettings: data.documentSettings !== undefined ? data.documentSettings : p.documentSettings,
          eventSettings: data.eventSettings !== undefined ? data.eventSettings : p.eventSettings,
          officeHours: data.officeHours !== undefined ? data.officeHours : p.officeHours,
          availableDocuments: data.availableDocuments !== undefined ? data.availableDocuments : p.availableDocuments,
          paymentQrEnabled: data.paymentQrEnabled !== undefined ? data.paymentQrEnabled : p.paymentQrEnabled,
        };
      }
      return p;
    });
    const updated = store.find((p) => p.id === id);
    if (!updated) throw new Error(`Parish ${id} not found`);
    return updated;
  },

  async uploadPaymentQr(id: string, _file: File): Promise<Parish> {
    const fakeUrl = "https://images.unsplash.com/photo-1548625361-155de0cbb55a?auto=format&fit=crop&q=80&w=800";
    store = store.map((p) => (p.id === id ? { ...p, paymentQrImage: fakeUrl, paymentQrEnabled: true } : p));
    const match = store.find((p) => p.id === id);
    if (!match) throw new Error(`Parish ${id} not found`);
    return match;
  },

  async deletePaymentQr(id: string): Promise<Parish> {
    store = store.map((p) => (p.id === id ? { ...p, paymentQrImage: null, paymentQrEnabled: false } : p));
    const match = store.find((p) => p.id === id);
    if (!match) throw new Error(`Parish ${id} not found`);
    return match;
  },

  async archiveParish(id: string): Promise<void> {
    store = store.map((p) => (p.id === id ? { ...p, status: 'Archived' } : p));
    return Promise.resolve();
  },

  async getMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    const existing = massTemplates.filter(t => t.parishId === parishId && t.isActive);
    if (existing.length === 0) {
      seedDemoMassTemplates(parishId);
    }
    const list = massTemplates.filter(t => t.parishId === parishId && t.isActive);
    
    // Resolve priest details
    const users = await DemoUserProvider.getUsers({});
    for (const t of list) {
      if (t.assignedPriestId) {
        const u = users.find(x => x.id === t.assignedPriestId);
        if (u) {
          t.assignedPriest = { id: u.id, fullName: u.name, isAssistant: u.role === 'ASSISTANT_PRIEST' };
        }
      } else {
        t.assignedPriest = null;
      }
    }
    return list;
  },

  async upsertMassSchedule(parishId: string, data: Partial<MassScheduleTemplate> & { dayType: string; timeSlot: string; label: string }): Promise<MassScheduleTemplate> {
    const users = await DemoUserProvider.getUsers({});
    let priestObj = null;
    if (data.assignedPriestId) {
      const u = users.find(x => x.id === data.assignedPriestId);
      if (u) {
        priestObj = { id: u.id, fullName: u.name, isAssistant: u.role === 'ASSISTANT_PRIEST' };
      }
    }

    if (data.id) {
      massTemplates = massTemplates.map(t => {
        if (t.id === data.id) {
          return { ...t, ...data, assignedPriest: priestObj } as MassScheduleTemplate;
        }
        return t;
      });
      const match = massTemplates.find(t => t.id === data.id);
      if (!match) throw new Error(`Template ${data.id} not found`);
      return match;
    } else {
      const newT: MassScheduleTemplate = {
        id: `demo-mt-${parishId}-${Date.now()}`,
        parishId,
        dayType: data.dayType as any,
        timeSlot: data.timeSlot,
        label: data.label,
        isActive: true,
        assignedPriestId: data.assignedPriestId || null,
        assignedPriest: priestObj
      };
      massTemplates.push(newT);
      return newT;
    }
  },

  async deleteMassSchedule(id: string): Promise<void> {
    massTemplates = massTemplates.map(t => t.id === id ? { ...t, isActive: false } : t);
  },

  async resetMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    massTemplates = massTemplates.map(t => t.parishId === parishId ? { ...t, isActive: false } : t);
    seedDemoMassTemplates(parishId);
    return this.getMassSchedule(parishId);
  },

  async getMapConfig(): Promise<Parish[]> {
    return this.getParishes({});
  },

  async batchUpdateMap(updates: {
    id: string;
    latitude: number;
    longitude: number;
    mapZoom?: number | null;
    pinColor?: string;
    showLabel?: boolean;
    locationUpdatedAt?: string | null;
  }[]): Promise<Parish[]> {
    for (const update of updates) {
      store = store.map((p) => {
        if (p.id === update.id) {
          return {
            ...p,
            latitude: update.latitude,
            longitude: update.longitude,
            mapZoom: update.mapZoom !== undefined ? update.mapZoom : p.mapZoom,
            pinColor: update.pinColor !== undefined ? update.pinColor : p.pinColor,
            showLabel: update.showLabel !== undefined ? update.showLabel : p.showLabel,
            locationUpdatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
    }
    const updatedIds = updates.map((u) => u.id);
    return store.filter((p) => updatedIds.includes(p.id));
  },

  async updateDirectorySettings(id: string, data: {
    directoryDescription?: string | null;
    contactNumber?: string | null;
    email?: string | null;
  }): Promise<Parish> {
    store = store.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          directoryDescription: data.directoryDescription !== undefined ? data.directoryDescription || undefined : p.directoryDescription,
          contactNumber: data.contactNumber !== undefined ? data.contactNumber || undefined : p.contactNumber,
          email: data.email !== undefined ? data.email || undefined : p.email,
        };
      }
      return p;
    });
    const match = store.find((p) => p.id === id);
    if (!match) throw new Error(`Parish ${id} not found`);
    return match;
  },

  async uploadParishImage(id: string, type: 'cover' | 'logo', _file: File): Promise<{ url: string; type: string }> {
    const fakeUrl = type === 'cover' 
      ? "https://images.unsplash.com/photo-1548625361-155de0cbb55a?auto=format&fit=crop&q=80&w=800"
      : "https://images.unsplash.com/photo-1507038772120-7bef2c68207a?auto=format&fit=crop&q=80&w=800";
    
    store = store.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          [type === 'cover' ? 'coverImage' : 'logoImage']: fakeUrl,
        };
      }
      return p;
    });

    return { url: fakeUrl, type };
  }
};
