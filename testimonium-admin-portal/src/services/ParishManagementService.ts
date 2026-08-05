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

  async editParishSettings(id: string, data: { documentSettings?: any; eventSettings?: any; officeHours?: any; availableDocuments?: string[]; paymentQrEnabled?: boolean }): Promise<Parish> {
    return providerFactory.getParishProvider().editParishSettings(id, data);
  },

  async uploadPaymentQr(id: string, file: File): Promise<Parish> {
    return providerFactory.getParishProvider().uploadPaymentQr(id, file);
  },

  async deletePaymentQr(id: string): Promise<Parish> {
    return providerFactory.getParishProvider().deletePaymentQr(id);
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
  },

  async getMapConfig(): Promise<Parish[]> {
    return providerFactory.getParishProvider().getMapConfig();
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
    return providerFactory.getParishProvider().batchUpdateMap(updates);
  },

  async updateDirectorySettings(id: string, data: {
    directoryDescription?: string | null;
    contactNumber?: string | null;
    email?: string | null;
  }): Promise<Parish> {
    return providerFactory.getParishProvider().updateDirectorySettings(id, data);
  },

  async uploadParishImage(id: string, type: 'cover' | 'logo', file: File): Promise<{ url: string; type: string }> {
    return providerFactory.getParishProvider().uploadParishImage(id, type, file);
  }
};
