import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "@react-native-firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { queryClient } from "@/services/queryClient";
import { authApi } from "@/services/api/endpoints/auth";
import { firebaseErrorToAppError } from "@/services/api/errors";
import { firebaseAuth } from "@/services/firebase";
import { onSessionExpired } from "@/services/auth/sessionEvents";
import type { AuthBootstrapState, BackendUserProfile } from "@/types/auth";
import { evaluateBootstrapState } from "@/types/auth";

interface AuthContextValue {
  state: AuthBootstrapState;
  user: User | null;
  profile: BackendUserProfile | null;
  error: string | null;
  isSigningIn: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<BackendUserProfile | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isCurrent = (generation: number, uid: string | null, currentGeneration: number, currentUid: string | null) =>
  generation === currentGeneration && uid === currentUid;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthBootstrapState>("BOOTING");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BackendUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const generationRef = useRef(0);
  const uidRef = useRef<string | null>(null);
  const interactiveUidRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const resetLocalState = useCallback(async () => {
    generationRef.current += 1;
    uidRef.current = null;
    interactiveUidRef.current = null;
    await queryClient.cancelQueries();
    queryClient.clear();
    if (mountedRef.current) {
      setUser(null);
      setProfile(null);
      setState("NO_FIREBASE_USER");
    }
  }, []);

  const commitProfile = useCallback((nextProfile: BackendUserProfile, firebaseUser: User, generation: number) => {
    if (!isCurrent(generation, firebaseUser.uid, generationRef.current, uidRef.current) || firebaseAuth.currentUser?.uid !== firebaseUser.uid) return false;
    const nextState = evaluateBootstrapState(nextProfile, firebaseUser.emailVerified);
    setUser(firebaseUser);
    setProfile(nextState === "SESSION_ERROR" ? null : nextProfile);
    setError(nextState === "SESSION_ERROR" ? "This mobile app is available only to active Parishioner accounts." : null);
    setState(nextState);
    return true;
  }, []);

  const bootstrapRestoredUser = useCallback(async (firebaseUser: User) => {
    if (interactiveUidRef.current === firebaseUser.uid) return;
    if (uidRef.current !== firebaseUser.uid) {
      generationRef.current += 1;
      uidRef.current = firebaseUser.uid;
    }
    const generation = generationRef.current;
    setUser(firebaseUser);
    setState("FIREBASE_USER_PENDING_BACKEND");
    try {
      const nextProfile = await authApi.profile();
      commitProfile(nextProfile, firebaseUser, generation);
    } catch {
      if (isCurrent(generation, firebaseUser.uid, generationRef.current, uidRef.current)) {
        setProfile(null);
        setState("SESSION_ERROR");
        setError("We could not restore your TESTIMONIUM session. Please retry or sign out.");
      }
    }
  }, [commitProfile]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!mountedRef.current) return;
      if (!nextUser) {
        void resetLocalState();
        return;
      }
      if (interactiveUidRef.current === nextUser.uid) return;
      void bootstrapRestoredUser(nextUser);
    });
    const unsubscribeExpired = onSessionExpired(() => { void resetLocalState().then(() => signOut(firebaseAuth)); });
    return () => { mountedRef.current = false; unsubscribe(); unsubscribeExpired(); };
  }, [bootstrapRestoredUser, resetLocalState]);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) return null;
    const generation = generationRef.current;
    const nextProfile = await authApi.profile();
    return commitProfile(nextProfile, firebaseUser, generation) ? nextProfile : null;
  }, [commitProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (interactiveUidRef.current) throw new Error("A sign-in request is already in progress.");
    setIsSigningIn(true);
    setError(null);
    interactiveUidRef.current = "pending";
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const firebaseUser = credential.user;
      interactiveUidRef.current = firebaseUser.uid;
      generationRef.current += 1;
      uidRef.current = firebaseUser.uid;
      setUser(firebaseUser);
      setState("FIREBASE_USER_PENDING_BACKEND");
      const loginResponse = await authApi.login();
      if (!commitProfile(loginResponse.user, firebaseUser, generationRef.current)) throw new Error("Sign-in session changed before it could be completed.");
    } catch (cause) {
      await resetLocalState();
      try { await signOut(firebaseAuth); } catch { /* Local reset remains authoritative. */ }
      throw firebaseErrorToAppError(cause);
    } finally {
      interactiveUidRef.current = null;
      if (mountedRef.current) setIsSigningIn(false);
    }
  }, [commitProfile, resetLocalState]);

  const logout = useCallback(async () => {
    await resetLocalState();
    try { await signOut(firebaseAuth); } catch { /* The local logout is already complete and safe. */ }
  }, [resetLocalState]);

  const value = useMemo(() => ({ state, user, profile, error, isSigningIn, signInWithEmail, refreshProfile, logout }), [state, user, profile, error, isSigningIn, signInWithEmail, refreshProfile, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
};