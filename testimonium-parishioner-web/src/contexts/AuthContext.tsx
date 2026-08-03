import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { SessionService } from '../services/SessionService';
import { type SessionState, SESSION_CONFIG } from '../config/sessionConfig';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useSubmissionProtection } from './SubmissionProtectionContext';
import { logSessionEvent } from '../utils/sessionLogger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionState: SessionState;
  isWarningModalOpen: boolean;
  secondsRemaining: number;
  staySignedIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: (reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState<SessionState>(SessionService.getState());
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  const { isBusy } = useSubmissionProtection();

  // Enforce parishioner local persistence on mount
  useEffect(() => {
    SessionService.enforceSessionPersistence();
  }, []);

  // Listen to FSM state updates
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !localStorage.getItem(SESSION_CONFIG.SESSION_START_KEY)) {
        localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Idle timeout monitoring
  const { secondsRemaining, resetTimer } = useIdleTimeout({
    enabled: Boolean(user),
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

  const staySignedIn = useCallback(async (): Promise<void> => {
    const success = await SessionService.refreshToken(true);
    if (success) {
      resetTimer();
      setIsWarningModalOpen(false);
    }
  }, [resetTimer]);

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await SessionService.enforceSessionPersistence();
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { email });
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      await SessionService.enforceSessionPersistence();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { email });
      setUser({ ...userCredential.user, displayName } as User);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await SessionService.enforceSessionPersistence();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { provider: 'google' });
    } finally {
      setLoading(false);
    }
  };

  const logout = async (reason = 'manual') => {
    setLoading(true);
    try {
      await SessionService.logout(reason as any);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionState,
        isWarningModalOpen,
        secondsRemaining,
        staySignedIn,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
