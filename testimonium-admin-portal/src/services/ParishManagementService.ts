import { providerFactory } from '@/providers/providerFactory';
import type { Parish } from '@/types';
import type { MassScheduleTemplate } from '@/providers/interfaces';

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

  async getMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    return providerFactory.getParishProvider().getMassSchedule(parishId);
  },

  async upsertMassSchedule(parishId: string, data: Partial<MassScheduleTemplate> & { dayType: string; timeSlot: string; label: string }): Promise<MassScheduleTemplate> {
    return providerFactory.getParishProvider().upsertMassSchedule(parishId, data);
  },

  async deleteMassSchedule(id: string): Promise<void> {
    return providerFactory.getParishProvider().deleteMassSchedule(id);
  },

  async resetMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    return providerFactory.getParishProvider().resetMassSchedule(parishId);
  }
};
