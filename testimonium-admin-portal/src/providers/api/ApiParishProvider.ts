import api from '@/api/api';
import type { ParishProvider, ParishFilters, MassScheduleTemplate } from '../interfaces';
import type { Parish } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiParishProvider: ParishProvider = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    const response = await api.get<ApiResponseEnvelope<{ items: Parish[] }>>('/parishes', {
      params: filters,
    });
    return response.data.data.items;
  },

  async addParish(data: Omit<Parish, 'id' | 'status'>): Promise<Parish> {
    const response = await api.post<ApiResponseEnvelope<Parish>>('/parishes', data);
    return response.data.data;
  },

  async editParish(id: string, data: Partial<Parish>): Promise<Parish> {
    const response = await api.put<ApiResponseEnvelope<Parish>>(`/parishes/${id}`, data);
    return response.data.data;
  },

  async editParishSettings(id: string, data: { documentSettings?: any; eventSettings?: any; officeHours?: any }): Promise<Parish> {
    const response = await api.put<ApiResponseEnvelope<Parish>>(`/parishes/${id}/settings`, data);
    return response.data.data;
  },

  async archiveParish(id: string): Promise<void> {
    await api.delete(`/parishes/${id}`);
  },

  async getMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    const response = await api.get<ApiResponseEnvelope<MassScheduleTemplate[]>>(`/mass-schedules/${parishId}`);
    return response.data.data;
  },

  async upsertMassSchedule(parishId: string, data: Partial<MassScheduleTemplate> & { dayType: string; timeSlot: string; label: string }): Promise<MassScheduleTemplate> {
    const response = await api.post<ApiResponseEnvelope<MassScheduleTemplate>>(`/mass-schedules/${parishId}`, data);
    return response.data.data;
  },

  async deleteMassSchedule(id: string): Promise<void> {
    await api.delete(`/mass-schedules/${id}`);
  },

  async resetMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    const response = await api.post<ApiResponseEnvelope<MassScheduleTemplate[]>>(`/mass-schedules/${parishId}/reset`);
    return response.data.data;
  }
};
