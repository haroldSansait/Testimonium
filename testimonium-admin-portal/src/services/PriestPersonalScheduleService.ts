import api from '@/api/api';

export interface PriestPersonalScheduleItem {
  id: number;
  priestId: number;
  title: string;
  notes?: string | null;
  startAt: string;
  endAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalSchedulePayload {
  title: string;
  notes?: string | null;
  startAt: string;
  endAt: string;
}

export interface UpdatePersonalSchedulePayload {
  title?: string;
  notes?: string | null;
  startAt?: string;
  endAt?: string;
  expectedVersion: number;
}

export const PriestPersonalScheduleService = {
  async getPersonalSchedules(params?: { startDate?: string; endDate?: string }): Promise<PriestPersonalScheduleItem[]> {
    const response = await api.get<{ data: PriestPersonalScheduleItem[] }>('/priest/personal-schedules', {
      params,
    });
    return response.data.data;
  },

  async createPersonalSchedule(payload: CreatePersonalSchedulePayload): Promise<PriestPersonalScheduleItem> {
    const response = await api.post<{ data: PriestPersonalScheduleItem }>('/priest/personal-schedules', payload);
    return response.data.data;
  },

  async updatePersonalSchedule(id: number, payload: UpdatePersonalSchedulePayload): Promise<PriestPersonalScheduleItem> {
    const response = await api.patch<{ data: PriestPersonalScheduleItem }>(`/priest/personal-schedules/${id}`, payload);
    return response.data.data;
  },

  async deletePersonalSchedule(id: number, expectedVersion: number): Promise<{ success: boolean; id: number }> {
    const response = await api.delete<{ data: { success: boolean; id: number } }>(`/priest/personal-schedules/${id}`, {
      params: { expectedVersion },
    });
    return response.data.data;
  },
};
