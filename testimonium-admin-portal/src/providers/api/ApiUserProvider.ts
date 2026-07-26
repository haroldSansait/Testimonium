import api from '@/api/api';
import type { UserProvider, UserFilters, AddUserPayload } from '../interfaces';
import type { ManagedUser } from '@/types';
import type { ApiResponseEnvelope } from '@/types/api';

export const ApiUserProvider: UserProvider = {
  async getUsers(filters: UserFilters = {}): Promise<ManagedUser[]> {
    const response = await api.get<ApiResponseEnvelope<ManagedUser[]>>('/users', {
      params: filters,
    });
    return response.data.data;
  },

  async addUser(payload: AddUserPayload): Promise<{ user: ManagedUser; setupLink?: string }> {
    const response = await api.post<ApiResponseEnvelope<{ user: ManagedUser; setupLink?: string }>>('/users', payload);
    return response.data.data;
  },

  async editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser> {
    const response = await api.put<ApiResponseEnvelope<ManagedUser>>(`/users/${id}`, data);
    return response.data.data;
  },

  async disableUser(id: string): Promise<void> {
    await api.post(`/users/${id}/disable`);
  },

  async enableUser(id: string): Promise<void> {
    await api.post(`/users/${id}/enable`);
  },

  async resetPassword(id: string): Promise<string> {
    const response = await api.post<ApiResponseEnvelope<{ resetLink: string }>>(`/users/${id}/reset-password`);
    return response.data.data.resetLink;
  },

  async updateUserColor(id: string, color: string | null): Promise<ManagedUser> {
    const response = await api.put<ApiResponseEnvelope<ManagedUser>>(`/users/${id}/color`, { color });
    return response.data.data;
  },
};
