import type { UserProvider, UserFilters, AddUserPayload } from '../interfaces';
import type { ManagedUser } from '@/types';
import { managedUsers as mockUsers } from '@/mock/managedUsers';
import { parishes as mockParishes } from '@/mock/parishes';

let store: ManagedUser[] = [...mockUsers];

export const DemoUserProvider: UserProvider = {
  async getUsers(filters: UserFilters = {}): Promise<ManagedUser[]> {
    const { search = '', role = 'all', status = 'all', assignableForParishId, parishId } = filters;
    let result = [...store];

    if (role !== 'all') {
      if (role === 'staff') {
        result = result.filter((u) => u.role !== 'PARISHIONER');
      } else {
        result = result.filter((u) => u.role === role);
      }
    }

    if (parishId) {
      result = result.filter((u) => u.parishId === parishId);
    }

    if (assignableForParishId !== undefined) {
      const targetParish = mockParishes.find(p => p.id === assignableForParishId);
      const targetParishName = targetParish ? targetParish.name : '';

      result = result.filter((u) => {
        const isActiveAndUnassigned = u.status === 'Active' && (!u.parish || u.parish === 'None' || u.parish === '');
        const isCurrentlyAssigned = Boolean(targetParishName && u.parish === targetParishName);
        return isActiveAndUnassigned || isCurrentlyAssigned;
      });
    } else {
      if (status !== 'all') {
        result = result.filter((u) => u.status === status);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.parish.toLowerCase().includes(q)
      );
    }

    return result;
  },

  async addUser(payload: AddUserPayload): Promise<{ user: ManagedUser; setupLink?: string }> {
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
    return {
      user: newUser,
      setupLink: `https://demo.testimonium.org/__/auth/action?mode=resetPassword&oobCode=demo-setup-${newUser.email}`,
    };
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

  async resetPassword(id: string): Promise<string> {
    return Promise.resolve(`https://demo.testimonium.org/__/auth/action?mode=resetPassword&oobCode=demo-reset-code-${id}`);
  },

  async updateUserColor(id: string, color: string | null): Promise<ManagedUser> {
    store = store.map((u) => (u.id === id ? { ...u, color: color || null } : u));
    const updated = store.find((u) => u.id === id);
    if (!updated) throw new Error(`User ${id} not found`);
    return updated;
  },
};
