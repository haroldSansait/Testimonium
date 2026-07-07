import type { UserProvider, UserFilters, AddUserPayload } from '../interfaces';
import type { ManagedUser } from '@/types';
import { DemoUserProvider } from '../demo/DemoUserProvider';

export const ApiUserProvider: UserProvider = {
  async getUsers(filters: UserFilters = {}): Promise<ManagedUser[]> {
    console.warn('[ApiUserProvider] getUsers is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.getUsers(filters);
  },

  async addUser(payload: AddUserPayload): Promise<ManagedUser> {
    console.warn('[ApiUserProvider] addUser is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.addUser(payload);
  },

  async editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser> {
    console.warn('[ApiUserProvider] editUser is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.editUser(id, data);
  },

  async disableUser(id: string): Promise<void> {
    console.warn('[ApiUserProvider] disableUser is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.disableUser(id);
  },

  async enableUser(id: string): Promise<void> {
    console.warn('[ApiUserProvider] enableUser is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.enableUser(id);
  },

  async resetPassword(id: string): Promise<void> {
    console.warn('[ApiUserProvider] resetPassword is not yet implemented on the backend. Falling back to Demo provider.');
    return DemoUserProvider.resetPassword(id);
  },
};
