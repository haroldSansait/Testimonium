import { providerFactory } from '@/providers/providerFactory';
import type { ManagedUser } from '@/types';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  assignableForParishId?: string;
}

export interface AddUserPayload {
  name: string;
  email: string;
  role: ManagedUser['role'];
  parish: string;
}

export const UserManagementService = {
  async getUsers(filters: UserFilters = {}): Promise<ManagedUser[]> {
    return providerFactory.getUserProvider().getUsers(filters);
  },

  async addUser(payload: AddUserPayload): Promise<{ user: ManagedUser; setupLink?: string }> {
    return providerFactory.getUserProvider().addUser(payload);
  },

  async editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser> {
    return providerFactory.getUserProvider().editUser(id, data);
  },

  async disableUser(id: string): Promise<void> {
    return providerFactory.getUserProvider().disableUser(id);
  },

  async enableUser(id: string): Promise<void> {
    return providerFactory.getUserProvider().enableUser(id);
  },

  async resetPassword(id: string): Promise<string> {
    return providerFactory.getUserProvider().resetPassword(id);
  },
};
