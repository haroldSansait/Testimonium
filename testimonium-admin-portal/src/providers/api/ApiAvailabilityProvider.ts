import api from '@/api/api';
import type { AvailabilityProvider, ParishAvailability } from '../interfaces';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiAvailabilityProvider: AvailabilityProvider = {
  async getAvailabilities(parishId?: string, startDate?: string, endDate?: string): Promise<ParishAvailability[]> {
    const response = await api.get<ApiResponseEnvelope<ParishAvailability[]>>('/parish-availabilities', {
      params: { parishId, startDate, endDate },
    });
    return response.data.data;
  },

  async createAvailability(data: Omit<ParishAvailability, 'id'>): Promise<ParishAvailability> {
    const response = await api.post<ApiResponseEnvelope<ParishAvailability>>('/parish-availabilities', data);
    return response.data.data;
  },

  async deleteAvailability(id: string): Promise<void> {
    await api.delete(`/parish-availabilities/${id}`);
  },
};
