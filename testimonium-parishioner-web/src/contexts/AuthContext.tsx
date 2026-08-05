import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
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

export interface RegistrationProfile {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
}

export interface LegalPayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
}

export interface BackendUserProfile {
  id: number;
  firebaseUid: string;
  email: string;
  fullName: string;
  contactNumber?: string;
  address?: string;
  isVerified: boolean;
  emailVerified: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  needsProfileCompletion: boolean;
  status: string;
  role: string;
  parish?: any;
}

interface AuthContextType {
  user: User | null;
  appProfile: BackendUserProfile | null;
  loading: boolean;
  sessionState: SessionState;
  isWarningModalOpen: boolean;
  secondsRemaining: number;
  staySignedIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ needsProfileCompletion: boolean }>;
  signUpWithEmail: (
    email: string, 
    password: string, 
    registrationProfile: RegistrationProfile, 
    legal: LegalPayload
  ) => Promise<{ needsProfileCompletion: boolean }>;
  signInWithGoogle: (legal?: LegalPayload) => Promise<{ needsProfileCompletion: boolean }>;
  recordLegalAcceptance: (legal: LegalPayload) => Promise<BackendUserProfile | null>;
  logout: (reason?: string) => Promise<void>;
  refreshProfile: () => Promise<BackendUserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appProfile, setAppProfile] = useState<BackendUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState<SessionState>(SessionService.getState());
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  const refreshPromiseRef = useRef<Promise<BackendUserProfile | null> | null>(null);
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

  const fetchBackendProfile = async (currentUser: User, legal?: LegalPayload): Promise<BackendUserProfile | null> => {
    try {
      const idToken = await currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: legal ? JSON.stringify(legal) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.code === 'EMAIL_NOT_VERIFIED') {
          const err = new Error(result?.message || 'Please verify your email address.');
          (err as any).code = 'EMAIL_NOT_VERIFIED';
          throw err;
        }
        if (result?.code) {
          const err = new Error(result?.message || 'Authentication rejected by backend.');
          (err as any).code = result.code;
          throw err;
        }
      }

      const profile = result?.data?.user as BackendUserProfile;
      if (profile) {
        console.debug('[AuthContext] Profile fetched & committed to context:', { email: profile.email, isVerified: profile.emailVerified, needsProfileCompletion: profile.needsProfileCompletion });
        setAppProfile(profile);
        return profile;
      }
      return null;
    } catch (error) {
      throw error;
    }
  };

  const recordLegalAcceptance = async (legal: LegalPayload): Promise<BackendUserProfile | null> => {
    if (!auth.currentUser) return null;
    const idToken = await auth.currentUser.getIdToken();
    const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    const response = await fetch(`${API_URL}/auth/legal-acceptance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(legal),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || 'Failed to record legal acceptance.');
    }
    const profile = result?.data as BackendUserProfile;
    if (profile) {
      setAppProfile(profile);
      return profile;
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (!localStorage.getItem(SESSION_CONFIG.SESSION_START_KEY)) {
          localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
        }
        try {
          await fetchBackendProfile(currentUser);
        } catch (err) {
          // Unverified email or backend rejection
        }
      } else {
        setAppProfile(null);
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const profile = await fetchBackendProfile(userCredential.user);
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { email });

      return { needsProfileCompletion: profile?.needsProfileCompletion ?? false };
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string, 
    password: string, 
    registrationProfile: RegistrationProfile,
    legal: LegalPayload
  ) => {
    setLoading(true);
    try {
      await SessionService.enforceSessionPersistence();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = [registrationProfile.firstName, registrationProfile.lastName].filter(Boolean).join(' ');
      await updateProfile(userCredential.user, { displayName });
      
      // Trigger email verification
      await sendEmailVerification(userCredential.user);

      // Register with backend passing legal compliance and structured registrationProfile
      const idToken = await userCredential.user.getIdToken(true);
      const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      
      console.debug('[AuthContext] Registering user with structured registrationProfile:', registrationProfile);
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...legal,
          registrationProfile,
        }),
      });

      const resData = await response.json();
      if (resData?.data) {
        setAppProfile(resData.data as BackendUserProfile);
      }

      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { email });
      setUser({ ...userCredential.user, displayName } as User);

      return { needsProfileCompletion: true };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (legal?: LegalPayload) => {
    setLoading(true);
    try {
      await SessionService.enforceSessionPersistence();
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);

      const profile = await fetchBackendProfile(userCredential.user, legal);
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { provider: 'google' });

      return { needsProfileCompletion: profile?.needsProfileCompletion ?? false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (reason = 'manual') => {
    setLoading(true);
    try {
      await SessionService.logout(reason as any);
      setUser(null);
      setAppProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async (): Promise<BackendUserProfile | null> => {
    if (!auth.currentUser) return null;

    if (refreshPromiseRef.current) {
      console.debug('[AuthContext] Single-flight refreshProfile reusing existing request promise');
      return refreshPromiseRef.current;
    }

    console.debug('[AuthContext] refreshProfile start');
    refreshPromiseRef.current = (async () => {
      try {
        const profile = await fetchBackendProfile(auth.currentUser!);
        console.debug('[AuthContext] refreshProfile completed cleanly');
        return profile;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appProfile,
        loading,
        sessionState,
        isWarningModalOpen,
        secondsRemaining,
        staySignedIn,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        recordLegalAcceptance,
        logout,
        refreshProfile,
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
