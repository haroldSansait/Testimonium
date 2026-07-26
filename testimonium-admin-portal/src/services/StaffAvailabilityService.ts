import { providerFactory } from '@/providers/providerFactory';
import type { ParishAvailability } from '@/providers/interfaces';

export const StaffAvailabilityService = {
  async getAvailabilities(parishId?: string, startDate?: string, endDate?: string): Promise<ParishAvailability[]> {
    return providerFactory.getAvailabilityProvider().getAvailabilities(parishId, startDate, endDate);
  },

  async createAvailability(data: Omit<ParishAvailability, 'id'>): Promise<ParishAvailability> {
    return providerFactory.getAvailabilityProvider().createAvailability(data);
  },

  async deleteAvailability(id: string): Promise<void> {
    return providerFactory.getAvailabilityProvider().deleteAvailability(id);
  },
};
