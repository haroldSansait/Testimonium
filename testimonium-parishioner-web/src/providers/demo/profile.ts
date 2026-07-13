import type { IProfileProvider } from '../types';
import type { UserProfile } from '../../types';
import { UserRole } from '../../types';

export class DemoProfileProvider implements IProfileProvider {
  private profile: UserProfile = {
    uid: 'demo-user-123',
    email: 'parishioner@testimonium.org',
    emailVerified: true,
    role: UserRole.PARISHIONER,
    displayName: 'Harold Sansait',
    phone: '+63 917 123 4567',
    address: 'Canlaon City, Negros Oriental',
    notificationsEnabled: true,
    parishId: 'p1'
  };

  async getProfile(_uid: string): Promise<UserProfile | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { ...this.profile };
  }

  async updateProfile(_uid: string, profile: Partial<UserProfile>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    this.profile = { ...this.profile, ...profile };
  }
}
