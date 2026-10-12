import api from '@/api/api';
import type { ParishProvider, ParishFilters, MassScheduleTemplate, MassScheduleUpsertInput, CreateParishPayload } from '../interfaces';
import type { Parish } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiParishProvider: ParishProvider = {
  async getParishes(filters: ParishFilters = {}): Promise<Parish[]> {
    const response = await api.get<ApiResponseEnvelope<{ items: Parish[] }>>('/parishes', {
      params: filters,
    });
    return response.data.data.items;
  },

  async addParish(data: CreateParishPayload | Omit<Parish, 'id' | 'status'>): Promise<Parish> {
    const response = await api.post<ApiResponseEnvelope<Parish>>('/parishes', data);
    return response.data.data;
  },

  async editParish(id: string, data: Partial<Parish>): Promise<Parish> {
    const response = await api.put<ApiResponseEnvelope<Parish>>(`/parishes/${id}`, data);
    return response.data.data;
  },

  async editParishSettings(id: string, data: { documentSettings?: any; eventSettings?: any; officeHours?: any; expectedSchedulingConfigVersion?: number; availableDocuments?: string[]; paymentQrEnabled?: boolean; paymentQrImage?: string | null; venueCapacity?: number | null }): Promise<Parish> {
    const response = await api.patch<ApiResponseEnvelope<Parish>>(`/parishes/${id}/settings`, data);
    return response.data.data;
  },

  async uploadPaymentQr(id: string, file: File): Promise<Parish> {
    const formData = new FormData();
    formData.append('qrImage', file);
    const response = await api.post<ApiResponseEnvelope<Parish>>(`/parishes/${id}/payment-qr`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async deletePaymentQr(id: string): Promise<Parish> {
    const response = await api.delete<ApiResponseEnvelope<Parish>>(`/parishes/${id}/payment-qr`);
    return response.data.data;
  },

  async archiveParish(id: string): Promise<void> {
    await api.delete(`/parishes/${id}`);
  },

  async getMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    const response = await api.get<ApiResponseEnvelope<MassScheduleTemplate[]>>(`/mass-schedules/${parishId}`);
    return response.data.data;
  },

  async upsertMassSchedule(parishId: string, data: MassScheduleUpsertInput): Promise<MassScheduleTemplate> {
    const response = await api.post<ApiResponseEnvelope<MassScheduleTemplate>>(`/mass-schedules/${parishId}`, data);
    return response.data.data;
  },

  async deleteMassSchedule(id: string): Promise<void> {
    await api.delete(`/mass-schedules/${id}`);
  },

  async resetMassSchedule(parishId: string): Promise<MassScheduleTemplate[]> {
    const response = await api.post<ApiResponseEnvelope<MassScheduleTemplate[]>>(`/mass-schedules/${parishId}/reset`);
    return response.data.data;
  },

  async getMapConfig(): Promise<Parish[]> {
    const response = await api.get<ApiResponseEnvelope<Parish[]>>('/parishes/map-config');
    return response.data.data;
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
    const response = await api.patch<ApiResponseEnvelope<Parish[]>>('/parishes/map-config/batch', { updates });
    return response.data.data;
  },

  async updateDirectorySettings(id: string, data: {
    directoryDescription?: string | null;
    contactNumber?: string | null;
    email?: string | null;
  }): Promise<Parish> {
    const response = await api.patch<ApiResponseEnvelope<Parish>>(`/parishes/${id}/settings`, data);
    return response.data.data;
  },

  async uploadParishImage(id: string, type: 'cover' | 'logo', file: File): Promise<{ url: string; type: string }> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<ApiResponseEnvelope<{ url: string; type: string }>>(
      `/parishes/${id}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: { type },
      }
    );
    return response.data.data;
  },

  async getCouncilConfig(parishId: string) {
    const response = await api.get<ApiResponseEnvelope<any>>(`/parishes/${parishId}/councils`);
    return response.data.data;
  },

  async saveCouncil(parishId: string, payload: any) {
    const response = await api.put<ApiResponseEnvelope<any>>(`/parishes/${parishId}/councils`, payload);
    return response.data.data;
  },

  async getParishesForSelector() {
    const response = await api.get<ApiResponseEnvelope<any>>('/parishes/selector');
    return response.data.data;
  },

  async uploadCouncilOfficerPhoto(parishId: string, memberId: string, file: File): Promise<{ memberId: string; photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post<ApiResponseEnvelope<{ memberId: string; photoUrl: string }>>(
      `/parishes/${parishId}/councils/members/${memberId}/photo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  async removeCouncilOfficerPhoto(parishId: string, memberId: string): Promise<{ memberId: string; photoUrl: null }> {
    const response = await api.delete<ApiResponseEnvelope<{ memberId: string; photoUrl: null }>>(
      `/parishes/${parishId}/councils/members/${memberId}/photo`
    );
    return response.data.data;
  },
};
