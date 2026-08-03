import { signInWithEmailAndPassword, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import api from '@/api/api';
import type { ApplicationUser, BackendUserDTO } from '@/types/auth';
import type { ApiResponseEnvelope } from '@/types/api';
import { SessionService } from '@/services/SessionService';
import { logSessionEvent } from '@/utils/sessionLogger';
import { SESSION_CONFIG } from '@/config/sessionConfig';

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
   * Enforces role-aware browserSessionPersistence for Staff.
   */
  async signIn(email: string, password: string, rememberMe = false): Promise<ApplicationUser> {
    await SessionService.enforceSessionPersistence();
    await signInWithEmailAndPassword(auth, email, password);

    // Record session start timestamp
    localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));

    // Send login info to the backend
    await api.post('/auth/login', { rememberMe });
    logSessionEvent('Session Started', { email });

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
   * Leverages SessionService for deduplicated token refresh when needed.
   */
  async getIdToken(_user: FirebaseUser, forceRefresh = false): Promise<string> {
    await SessionService.refreshToken(forceRefresh);
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No active user session');
    return token;
  },

  /**
   * Centralized idempotent sign out.
   */
  async logout(reason = 'manual'): Promise<void> {
    await SessionService.logout(reason as any);
  },
};
