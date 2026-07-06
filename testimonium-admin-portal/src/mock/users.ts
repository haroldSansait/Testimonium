import type { AdminUser } from '@/types';

export const currentUser: AdminUser = {
  id: 'user-1',
  name: 'Admin',
  email: 'admin@parish.org',
  role: 'admin',
  parish: 'Parish Admin Portal',
  avatarInitials: 'AD',
  avatarColor: '#7B1C2A',
};

export const personnel: AdminUser[] = [
  {
    id: 'user-2',
    name: 'Father Michael',
    email: 'frmichael@parish.org',
    role: 'priest',
    parish: 'Parish Admin Portal',
    avatarInitials: 'FM',
    avatarColor: '#7B1C2A',
  },
  {
    id: 'user-3',
    name: 'Sister Theresa',
    email: 'srtheresa@parish.org',
    role: 'secretary',
    parish: 'Parish Admin Portal',
    avatarInitials: 'ST',
    avatarColor: '#B45309',
  },
  {
    id: 'user-4',
    name: 'John Doe',
    email: 'johndoe@parish.org',
    role: 'secretary',
    parish: 'Parish Admin Portal',
    avatarInitials: 'JD',
    avatarColor: '#6B7280',
  },
];
