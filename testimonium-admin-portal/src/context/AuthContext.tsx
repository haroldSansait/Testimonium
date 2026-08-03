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
import { SessionService } from '@/services/SessionService';
import type { ApplicationUser, UserRole } from '@/types/auth';
import { type SessionState } from '@/config/sessionConfig';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useSubmissionProtection } from '@/context/SubmissionProtectionContext';

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
  /** Finite state machine state */
  sessionState: SessionState;
  /** Warning modal open status */
  isWarningModalOpen: boolean;
  /** Seconds remaining until idle logout */
  secondsRemaining: number;
  /** Refresh token and dismiss warning modal */
  staySignedIn: () => Promise<void>;
  /** Sign in with Firebase email/password and fetch backend profile */
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  /** Sign out from Firebase and clear all local state */
  logout: (reason?: string) => Promise<void>;
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
  const [sessionState, setSessionState] = useState<SessionState>(SessionService.getState());
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  const { isBusy } = useSubmissionProtection();

  // Enforce session persistence on startup
  useEffect(() => {
    SessionService.enforceSessionPersistence();
  }, []);

  // Listen to Session FSM changes
  useEffect(() => {
    const unsubscribe = SessionService.subscribeState((newState) => {
      setSessionState(newState);
      if (newState === 'WARNING') {
        setIsWarningModalOpen(true);
      } else if (newState === 'ACTIVE' || newState === 'LOGGING_OUT' || newState === 'LOGGED_OUT') {
        setIsWarningModalOpen(false);
      }
    });
    return unsubscribe;
  }, []);

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

  // ── Idle Timeout Hook ────────────────────────────────────────────────────
  const { secondsRemaining, resetTimer } = useIdleTimeout({
    enabled: Boolean(currentUser),
    isBusy,
    onWarning: () => {
      SessionService.transitionTo('WARNING');
    },
    onTimeout: () => {
      SessionService.logout('idle');
    },
    onAbsoluteTimeout: () => {
      SessionService.logout('absolute');
    },
  });

  // ── Auth actions ────────────────────────────────────────────────────────
  const staySignedIn = useCallback(async (): Promise<void> => {
    const success = await SessionService.refreshToken(true);
    if (success) {
      resetTimer();
      setIsWarningModalOpen(false);
    }
  }, [resetTimer]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<void> => {
      const profile = await AuthService.signIn(email, password, rememberMe);
      setApplicationUser(profile);
    },
    []
  );

  const logout = useCallback(async (reason = 'manual'): Promise<void> => {
    await SessionService.logout(reason as any);
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
    sessionState,
    isWarningModalOpen,
    secondsRemaining,
    staySignedIn,
    signIn,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
