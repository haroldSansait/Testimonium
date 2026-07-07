import type { UserProvider, UserFilters, AddUserPayload } from '../interfaces';
import type { ManagedUser } from '@/types';
import { managedUsers as mockUsers } from '@/mock/managedUsers';

let store: ManagedUser[] = [...mockUsers];

export const DemoUserProvider: UserProvider = {
  async getUsers(filters: UserFilters = {}): Promise<ManagedUser[]> {
    const { search = '', role = 'all', status = 'all' } = filters;
    let result = [...store];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.parish.toLowerCase().includes(q)
      );
    }
    if (role !== 'all') {
      result = result.filter((u) => u.role === role);
    }
    if (status !== 'all') {
      result = result.filter((u) => u.status === status);
    }

    return result;
  },

  async addUser(payload: AddUserPayload): Promise<ManagedUser> {
    const initials = payload.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    const colors = ['#7B1C2A', '#1D4ED8', '#065F46', '#B45309', '#6D28D9', '#0E7490'];
    const avatarColor = colors[store.length % colors.length];

    const newUser: ManagedUser = {
      id: `mu-${Date.now()}`,
      ...payload,
      status: 'Active',
      avatarInitials: initials,
      avatarColor,
    };
    store = [newUser, ...store];
    return newUser;
  },

  async editUser(id: string, data: Partial<ManagedUser>): Promise<ManagedUser> {
    store = store.map((u) => (u.id === id ? { ...u, ...data } : u));
    const updated = store.find((u) => u.id === id);
    if (!updated) throw new Error(`User ${id} not found`);
    return updated;
  },

  async disableUser(id: string): Promise<void> {
    store = store.map((u) => (u.id === id ? { ...u, status: 'Disabled' } : u));
    return Promise.resolve();
  },

  async enableUser(id: string): Promise<void> {
    store = store.map((u) => (u.id === id ? { ...u, status: 'Active' } : u));
    return Promise.resolve();
  },

  async resetPassword(id: string): Promise<void> {
    console.log(`[DemoUserProvider] Password reset triggered for user ${id}`);
    return Promise.resolve();
  },
};
