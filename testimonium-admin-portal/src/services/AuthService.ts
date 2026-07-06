import {
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import api from '@/api/api';
import type { ApplicationUser, BackendUserDTO } from '@/types/auth';
import type { ApiResponseEnvelope } from '@/types/api';

/**
 * AuthService — all Firebase and backend authentication logic lives here.
 *
 * Rules:
 * - Never perform UI navigation.
 * - Never duplicate Firebase or API logic elsewhere.
 */
export const AuthService = {
  /**
   * Sign in with email/password via Firebase.
   * Then fetches the backend application profile.
   */
  async signIn(email: string, password: string): Promise<ApplicationUser> {
    await signInWithEmailAndPassword(auth, email, password);
    return AuthService.getApplicationUser();
  },

  /**
   * Fetch the backend user profile using the current Firebase ID token.
   * The interceptor in interceptors.ts handles attaching the Bearer token.
   */
  async getApplicationUser(): Promise<ApplicationUser> {
    const response = await api.get<ApiResponseEnvelope<BackendUserDTO>>('/auth/profile');
    const dbUser = response.data.data;
    return {
      id: String(dbUser.id),
      email: dbUser.email,
      name: dbUser.fullName,
      role: dbUser.role,
      parishId: dbUser.parish ? String(dbUser.parish.id) : undefined,
    };
  },

  /**
   * Retrieve the current Firebase ID token.
   * Pass forceRefresh=true to get a fresh token (e.g. after role changes).
   */
  async getIdToken(user: FirebaseUser, forceRefresh = false): Promise<string> {
    return user.getIdToken(forceRefresh);
  },

  /**
   * Sign out from Firebase.
   */
  async logout(): Promise<void> {
    await signOut(auth);
  },
};
