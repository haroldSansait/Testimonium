import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
import { setQueryScope } from '../services/queryClient';
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
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
  privacyVersion?: string;
}

export interface SignInOptions {
  keepSignedIn?: boolean;
}

export interface GoogleSignInOptions {
  keepSignedIn?: boolean;
  legal?: LegalPayload;
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
  emailNotificationsEnabled?: boolean;
  parish?: any;
  governmentIdVerificationStatus?: 'NOT_SUBMITTED' | 'VERIFIED' | 'REJECTED';
  governmentIdRejectionReason?: string | null;
  governmentIdVerifiedAt?: string | null;
  governmentIdExpiresAt?: string | null;
  governmentIdType?: string | null;
  isGovernmentIdVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  appProfile: BackendUserProfile | null;
  profileError: Error | null;
  loading: boolean;
  sessionState: SessionState;
  isWarningModalOpen: boolean;
  secondsRemaining: number;
  staySignedIn: () => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
    options?: SignInOptions
  ) => Promise<{ needsProfileCompletion: boolean }>;
  signUpWithEmail: (
    email: string,
    password: string,
    registrationProfile: RegistrationProfile,
    legal: LegalPayload
  ) => Promise<{ needsProfileCompletion: boolean }>;
  signInWithGoogle: (
    options?: GoogleSignInOptions
  ) => Promise<{ needsProfileCompletion: boolean }>;
  recordLegalAcceptance: (legal: LegalPayload) => Promise<BackendUserProfile | null>;
  logout: (reason?: string) => Promise<void>;
  refreshProfile: () => Promise<BackendUserProfile | null>;
  requestEmailVerificationOtp: () => Promise<{ success: boolean; retryAfter?: number; message?: string; alreadyVerified?: boolean }>;
  confirmEmailVerificationOtp: (code: string) => Promise<BackendUserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appProfile, setAppProfile] = useState<BackendUserProfile | null>(null);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const publishProfile = (profile: BackendUserProfile) => {
    if (['LOGGING_OUT', 'LOGGED_OUT'].includes(SessionService.getState())) return;
    setQueryScope(auth.currentUser?.uid ?? null, profile.role, profile.parish?.id);
    setAppProfile(profile);
    setProfileError(null);
  };
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState<SessionState>(SessionService.getState());
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  const refreshPromiseRef = useRef<{ uid: string; promise: Promise<BackendUserProfile | null> } | null>(null);
  const authGenerationRef = useRef(0);
  const { isBusy } = useSubmissionProtection();

  // Listen to FSM state updates
  useEffect(() => {
    const unsubscribe = SessionService.subscribeState((newState) => {
      setSessionState(newState);
      if (newState === 'LOGGING_OUT' || newState === 'LOGGED_OUT') {
        ++authGenerationRef.current;
        setAppProfile(null);
      }
      if (newState === 'WARNING') {
        setIsWarningModalOpen(true);
      } else if (newState === 'ACTIVE' || newState === 'LOGGING_OUT' || newState === 'LOGGED_OUT') {
        setIsWarningModalOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  const performBackendLogin = async (currentUser: User, legal?: LegalPayload): Promise<BackendUserProfile> => {
    const generation = authGenerationRef.current;
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

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      // Non-JSON response body
    }

    if (!response.ok) {
      const message = result?.message || 'Authentication rejected by backend.';
      const err = new Error(message);
      if (result?.code) {
        (err as any).code = result.code;
      }
      (err as any).status = response.status;
      throw err;
    }

    const profile = result?.data?.user as BackendUserProfile;
    if (!profile) {
      throw new Error('Malformed backend login response: user profile missing.');
    }

    const isNewUser = Boolean(result?.data?.isNewUser ?? (profile as any)?.isNewUser);
    if (isNewUser) {
      sessionStorage.setItem('testimonium_registration_session', 'true');
    } else {
      sessionStorage.removeItem('testimonium_registration_session');
    }

    console.debug('[AuthContext] Backend login successful:', { email: profile.email, isVerified: profile.emailVerified, needsProfileCompletion: profile.needsProfileCompletion, isNewUser });
    if (authGenerationRef.current === generation && auth.currentUser?.uid === currentUser.uid) publishProfile(profile);
    return profile;
  };

  const fetchCurrentBackendProfile = async (currentUser: User): Promise<BackendUserProfile> => {
    const idToken = await currentUser.getIdToken();
    const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      // Non-JSON response body
    }

    if (!response.ok) {
      const message = result?.message || 'Failed to fetch user profile.';
      const err = new Error(message);
      if (result?.code) {
        (err as any).code = result.code;
      }
      (err as any).status = response.status;
      throw err;
    }

    const profile = result?.data as BackendUserProfile;
    if (!profile) {
      throw new Error('Malformed backend profile response: user profile missing.');
    }

    console.debug('[AuthContext] Profile fetched:', { email: profile.email, isVerified: profile.emailVerified, needsProfileCompletion: profile.needsProfileCompletion });
    return profile;
  };

  const recordLegalAcceptance = async (legal: LegalPayload): Promise<BackendUserProfile | null> => {
    if (!auth.currentUser) return null;
    const expectedUid = auth.currentUser.uid;
    const generation = authGenerationRef.current;
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

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const err = new Error(result?.message || 'Failed to record legal acceptance.');
      if (result?.code) {
        (err as any).code = result.code;
      }
      (err as any).status = response.status;
      throw err;
    }
    const profile = result?.data as BackendUserProfile;
    if (!profile) throw new Error('Malformed legal acceptance response: user profile missing.');
    if (authGenerationRef.current === generation && auth.currentUser?.uid === expectedUid) publishProfile(profile);
    return profile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !SessionService.startAuthenticatedSession(currentUser.uid)) return;
      const generation = ++authGenerationRef.current;
      setQueryScope(null);
      setLoading(true);
      setUser(currentUser);
      setAppProfile(null);
      setProfileError(null);
      if (currentUser) {
        if (!localStorage.getItem(SESSION_CONFIG.SESSION_START_KEY)) {
          localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
        }
        try {
          const profile = await fetchCurrentBackendProfile(currentUser);
          if (authGenerationRef.current === generation && auth.currentUser?.uid === currentUser.uid) {
            publishProfile(profile);
          }
        } catch (error) {
          if (authGenerationRef.current === generation && auth.currentUser?.uid === currentUser.uid) {
            setProfileError(error instanceof Error ? error : new Error('Failed to load your profile. Please try again.'));
          }
        }
      }
      if (authGenerationRef.current === generation) setLoading(false);
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

  const signInWithEmail = async (
    email: string,
    password: string,
    options?: SignInOptions
  ) => {
    setLoading(true);
    try {
      const keepSignedIn = options?.keepSignedIn ?? false;
      await SessionService.enforceSessionPersistence(keepSignedIn);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const profile = await performBackendLogin(userCredential.user);
      sessionStorage.removeItem('testimonium_registration_session');
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { email, keepSignedIn });

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
      await SessionService.enforceSessionPersistence(true);
      const existingPendingUser = auth.currentUser?.email?.toLowerCase() === email.trim().toLowerCase()
        ? auth.currentUser
        : null;
      const firebaseUser = existingPendingUser || (await createUserWithEmailAndPassword(auth, email, password)).user;
      const generation = authGenerationRef.current;
      const displayName = [registrationProfile.firstName, registrationProfile.lastName].filter(Boolean).join(' ');
      await updateProfile(firebaseUser, { displayName });

      // Register with backend passing legal compliance and structured registrationProfile
      const idToken = await firebaseUser.getIdToken(true);
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

      const resData = await response.json().catch(() => null);
      if (!response.ok) {
        const message = resData?.message || 'Failed to complete registration.';
        const err = new Error(message);
        if (resData?.code) {
          (err as any).code = resData.code;
        }
        (err as any).status = response.status;
        throw err;
      }
      if (!resData?.data || typeof resData.data !== 'object') {
        throw new Error('Malformed registration response: user profile missing.');
      }
      if (authGenerationRef.current === generation && auth.currentUser?.uid === firebaseUser.uid) publishProfile(resData.data as BackendUserProfile);

      // Request email verification OTP from backend (replacing Firebase verification link email)
      try {
        await fetch(`${API_URL}/auth/otp/verification/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
      } catch (otpErr) {
        console.warn('[AuthContext] Failed to send initial OTP during registration:', otpErr);
      }

      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      // Registration journey authoritative establish: new email/password account created
      sessionStorage.setItem('testimonium_registration_session', 'true');
      logSessionEvent('Session Started', { email });
      setUser({ ...firebaseUser, displayName } as User);

      return { needsProfileCompletion: true };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (options?: GoogleSignInOptions) => {
    setLoading(true);
    try {
      const keepSignedIn = options?.keepSignedIn ?? false;
      await SessionService.enforceSessionPersistence(keepSignedIn);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      const userCredential = await signInWithPopup(auth, provider);

      const profile = await performBackendLogin(userCredential.user, options?.legal);
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(Date.now()));
      logSessionEvent('Session Started', { provider: 'google', keepSignedIn });

      return { needsProfileCompletion: profile?.needsProfileCompletion ?? false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (reason = 'manual') => {
    setLoading(true);
    authGenerationRef.current += 1;
    refreshPromiseRef.current = null;
    try {
      sessionStorage.removeItem('testimonium_registration_session');
      await SessionService.logout(reason as any);
      setUser(null);
      setAppProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async (): Promise<BackendUserProfile | null> => {
    if (!auth.currentUser) return null;
    const expectedUser = auth.currentUser;
    const generation = authGenerationRef.current;

    if (refreshPromiseRef.current?.uid === expectedUser.uid) {
      console.debug('[AuthContext] Single-flight refreshProfile reusing existing request promise');
      return refreshPromiseRef.current.promise;
    }

    console.debug('[AuthContext] refreshProfile start');
    const promise = (async () => {
      try {
        setProfileError(null);
        const profile = await fetchCurrentBackendProfile(expectedUser);
        if (authGenerationRef.current === generation && auth.currentUser?.uid === expectedUser.uid) { publishProfile(profile); setUser(expectedUser); }
        console.debug('[AuthContext] refreshProfile completed cleanly');
        return profile;
      } catch (error) {
        if (authGenerationRef.current === generation && auth.currentUser?.uid === expectedUser.uid) {
          setProfileError(error instanceof Error ? error : new Error('Failed to load your profile. Please try again.'));
        }
        throw error;
      } finally {
        if (authGenerationRef.current === generation && refreshPromiseRef.current?.uid === expectedUser.uid) refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = { uid: expectedUser.uid, promise };

    return promise;
  };

  const requestEmailVerificationOtp = async () => {
    if (!auth.currentUser) throw new Error('Authentication required.');
    const idToken = await auth.currentUser.getIdToken();
    const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    const response = await fetch(`${API_URL}/auth/otp/verification/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const err = new Error(data?.message || 'Failed to send verification code.');
      if (data?.code) (err as any).code = data.code;
      if (data?.retryAfter) (err as any).retryAfter = data.retryAfter;
      throw err;
    }
    return data;
  };

  const confirmEmailVerificationOtp = async (code: string): Promise<BackendUserProfile> => {
    if (!auth.currentUser) throw new Error('Authentication required.');
    const currentUser = auth.currentUser;
    let generation = authGenerationRef.current;
    const idToken = await currentUser.getIdToken();
    const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    const response = await fetch(`${API_URL}/auth/otp/verification/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const err = new Error(data?.message || 'Failed to verify code.');
      if (data?.code) (err as any).code = data.code;
      if (data?.remainingAttempts !== undefined) (err as any).remainingAttempts = data.remainingAttempts;
      throw err;
    }

    if (authGenerationRef.current !== generation || auth.currentUser?.uid !== currentUser.uid) throw new Error('Your session changed. Please try again.');

    generation = ++authGenerationRef.current;
    refreshPromiseRef.current = null;
    // Reload Firebase state and force a fresh ID token
    await currentUser.reload();
    await currentUser.getIdToken(true);

    // Refresh the TESTIMONIUM backend profile so isVerified / emailVerified becomes consistent
    const profile = await fetchCurrentBackendProfile(currentUser);
    if (authGenerationRef.current === generation && auth.currentUser?.uid === currentUser.uid) {
      publishProfile(profile);
    }
    return profile;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appProfile,
        profileError,
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
        requestEmailVerificationOtp,
        confirmEmailVerificationOtp,
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
