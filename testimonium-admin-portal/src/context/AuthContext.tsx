import {
  createContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { AuthService } from '@/services/AuthService';
import type { ApplicationUser, UserRole } from '@/types/auth';

// ─── Context Shape ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** Raw Firebase user — available immediately from onAuthStateChanged */
  currentUser: FirebaseUser | null;
  /** Backend application profile — fetched after Firebase auth resolves */
  applicationUser: ApplicationUser | null;
  /** Shortcut to the backend role */
  role: UserRole | null;
  /** True while the initial auth state is being resolved */
  loading: boolean;
  /** Sign in with Firebase email/password and fetch backend profile */
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  /** Sign out from Firebase and clear all local state */
  logout: () => Promise<void>;
  /** Re-fetch the backend profile (e.g. after role changes) */
  refreshUser: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [applicationUser, setApplicationUser] = useState<ApplicationUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch backend profile ────────────────────────────────────────────────
  const fetchApplicationUser = useCallback(async () => {
    try {
      const profile = await AuthService.getApplicationUser();
      setApplicationUser(profile);
    } catch {
      // Backend profile unavailable — clear app user but keep Firebase user
      setApplicationUser(null);
    }
  }, []);

  // ── Observe Firebase auth state ──────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        await fetchApplicationUser();
      } else {
        setApplicationUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [fetchApplicationUser]);

  // ── Auth actions ────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<void> => {
      const profile = await AuthService.signIn(email, password, rememberMe);
      setApplicationUser(profile);
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await AuthService.logout();
    setApplicationUser(null);
    setCurrentUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    await fetchApplicationUser();
  }, [fetchApplicationUser]);

  const value: AuthContextValue = {
    currentUser,
    applicationUser,
    role: applicationUser?.role ?? null,
    loading,
    signIn,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
