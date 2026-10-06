import {
  createUserWithEmailAndPassword,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "@react-native-firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { authApi } from "@/services/api/endpoints/auth";
import { firebaseErrorToAppError, isAppError, AppError } from "@/services/api/errors";
import { signInWithGoogleNative, signOutGoogleNative } from "@/services/auth/googleAuth";
import { onSessionExpired } from "@/services/auth/sessionEvents";
import { firebaseAuth } from "@/services/firebase";
import { queryClient } from "@/services/queryClient";
import { devDiagnostic, safeErrorDetails } from "@/services/devDiagnostics";
import { clearCaloyStorage } from "@/features/caloy/caloyStorage";
import type {
  AuthBootstrapState,
  BackendUserProfile,
  InteractiveAuthOperation,
  LegalAcceptancePayload,
  PendingLegalAction,
  RegisterRequestPayload,
  RegistrationProfilePayload,
  ResendVerificationResponse,
  SessionIssue,
  UpdateProfilePayload,
} from "@/types/auth";
import { evaluateBootstrapState } from "@/types/auth";

interface AuthContextValue {
  state: AuthBootstrapState;
  user: User | null;
  profile: BackendUserProfile | null;
  error: string | null;
  sessionIssue: SessionIssue | null;
  pendingLegalAction: PendingLegalAction | null;
  isSigningIn: boolean;
  isRegistering: boolean;
  isCheckingVerification: boolean;
  isUpdatingProfile: boolean;
  isAcceptingLegal: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    registrationProfile: RegistrationProfilePayload,
    legal: LegalAcceptancePayload
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  checkEmailVerification: (isAutoCheck?: boolean) => Promise<boolean>;
  resendVerification: () => Promise<ResendVerificationResponse>;
  acceptLegal: (legal: LegalAcceptancePayload) => Promise<void>;
  cancelGoogleJitLegal: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<BackendUserProfile>;
  refreshProfile: () => Promise<BackendUserProfile | null>;
  retryBootstrap: () => Promise<void>;
  isRegistrationSession: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isCurrent = (
  generation: number,
  uid: string | null,
  currentGeneration: number,
  currentUid: string | null
) => generation === currentGeneration && uid === currentUid;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthBootstrapState>("BOOTING");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BackendUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionIssue, setSessionIssue] = useState<SessionIssue | null>(null);
  const [pendingLegalAction, setPendingLegalAction] = useState<PendingLegalAction | null>(null);
  const [isRegistrationSession, setIsRegistrationSession] = useState(false);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isAcceptingLegal, setIsAcceptingLegal] = useState(false);

  const generationRef = useRef(0);
  const uidRef = useRef<string | null>(null);
  const interactiveOperationRef = useRef<InteractiveAuthOperation | null>(null);
  const interactiveUidRef = useRef<string | null>(null);
  const verificationPromiseRef = useRef<Promise<boolean> | null>(null);
  const refreshPromiseRef = useRef<Promise<BackendUserProfile | null> | null>(null);
  const mountedRef = useRef(true);

  const resetLocalState = useCallback(async () => {
    const priorUid = uidRef.current;
    if (priorUid) {
      await clearCaloyStorage(priorUid);
    }
    generationRef.current += 1;
    uidRef.current = null;
    interactiveOperationRef.current = null;
    interactiveUidRef.current = null;
    await queryClient.cancelQueries();
    queryClient.clear();
    if (mountedRef.current) {
      setUser(null);
      setProfile(null);
      setError(null);
      setSessionIssue(null);
      setPendingLegalAction(null);
      setIsRegistrationSession(false);
      setState("NO_FIREBASE_USER");
    }
  }, []);

  const commitProfile = useCallback(
    (nextProfile: BackendUserProfile, firebaseUser: User, generation: number) => {
      if (
        !isCurrent(generation, firebaseUser.uid, generationRef.current, uidRef.current) ||
        firebaseAuth.currentUser?.uid !== firebaseUser.uid
      ) {
        devDiagnostic("Auth", "Backend profile commit skipped because the session changed");
        return false;
      }
      const nextState = evaluateBootstrapState(nextProfile, firebaseUser.emailVerified);
      setUser(firebaseUser);

      if (nextState === "SESSION_ERROR") {
        const isAccountUnavailable =
          nextProfile.role !== "PARISHIONER" || nextProfile.status !== "ACTIVE";
        setProfile(null);
        setSessionIssue({
          kind: isAccountUnavailable ? "ACCOUNT_UNAVAILABLE" : "TRANSIENT_BOOTSTRAP",
          message: isAccountUnavailable
            ? "This mobile app is available only to active Parishioner accounts."
            : "We could not verify your TESTIMONIUM session. Please retry or sign out.",
          retryable: !isAccountUnavailable,
        });
        setError(
          isAccountUnavailable
            ? "This mobile app is available only to active Parishioner accounts."
            : "Session verification failed."
        );
      } else {
        setProfile(nextProfile);
        setSessionIssue(null);
        setError(null);
      }

      setState(nextState);
      devDiagnostic("Auth", "Backend profile committed", { state: nextState });
      return true;
    },
    []
  );

  const bootstrapRestoredUser = useCallback(
    async (firebaseUser: User) => {
      if (interactiveOperationRef.current !== null || interactiveUidRef.current === firebaseUser.uid) {
        return;
      }
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
      } catch (cause) {
        if (isCurrent(generation, firebaseUser.uid, generationRef.current, uidRef.current)) {
          setProfile(null);
          setState("SESSION_ERROR");
          setSessionIssue({
            kind: "TRANSIENT_BOOTSTRAP",
            message: "We could not restore your TESTIMONIUM session. Please retry or sign out.",
            retryable: true,
          });
          setError(
            isAppError(cause)
              ? cause.message
              : "We could not restore your TESTIMONIUM session. Please retry or sign out."
          );
        }
      }
    },
    [commitProfile]
  );

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!mountedRef.current) return;
      if (!nextUser) {
        void resetLocalState();
        return;
      }
      if (
        interactiveOperationRef.current !== null ||
        interactiveUidRef.current === nextUser.uid
      ) {
        return;
      }
      void bootstrapRestoredUser(nextUser);
    });

    const unsubscribeExpired = onSessionExpired(() => {
      void resetLocalState().then(() => {
        void signOut(firebaseAuth);
        void signOutGoogleNative();
      });
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      unsubscribeExpired();
    };
  }, [bootstrapRestoredUser, resetLocalState]);

  const refreshProfile = useCallback(async (): Promise<BackendUserProfile | null> => {
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) return null;

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const generation = generationRef.current;
    const uid = firebaseUser.uid;

    refreshPromiseRef.current = (async () => {
      try {
        const nextProfile = await authApi.profile();
        if (!isCurrent(generation, uid, generationRef.current, uidRef.current)) {
          return null;
        }
        return commitProfile(nextProfile, firebaseUser, generation) ? nextProfile : null;
      } catch (err) {
        devDiagnostic("Auth", "Transient background profile refresh failure", safeErrorDetails(err));
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [commitProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (interactiveOperationRef.current) {
        throw new AppError({
          kind: "AUTH",
          message: "An authentication request is already in progress.",
        });
      }
      setIsSigningIn(true);
      setError(null);
      interactiveOperationRef.current = "LOGIN";
      interactiveUidRef.current = "pending";

      try {
        devDiagnostic("Auth", "Firebase email/password sign-in started");
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        devDiagnostic("Auth", "Firebase email/password sign-in succeeded");
        const firebaseUser = credential.user;
        interactiveUidRef.current = firebaseUser.uid;
        generationRef.current += 1;
        uidRef.current = firebaseUser.uid;
        setUser(firebaseUser);
        setState("FIREBASE_USER_PENDING_BACKEND");

        devDiagnostic("Auth", "Backend login bootstrap started", {
          method: "POST",
          path: "/auth/login",
        });
        const loginResponse = await authApi.login();
        devDiagnostic("Auth", "Backend login bootstrap succeeded");
        setIsRegistrationSession(false);
        if (!commitProfile(loginResponse.user, firebaseUser, generationRef.current)) {
          throw new AppError({
            kind: "AUTH",
            message: "Sign-in session changed before it could be completed.",
          });
        }
      } catch (cause) {
        const normalized = isAppError(cause) ? cause : firebaseErrorToAppError(cause);
        devDiagnostic("Auth", "Email/password login failed", safeErrorDetails(normalized));
        await resetLocalState();
        try {
          await signOut(firebaseAuth);
        } catch {
          // Local reset remains authoritative.
        }
        throw normalized;
      } finally {
        interactiveOperationRef.current = null;
        interactiveUidRef.current = null;
        if (mountedRef.current) setIsSigningIn(false);
      }
    },
    [commitProfile, resetLocalState]
  );

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      registrationProfile: RegistrationProfilePayload,
      legal: LegalAcceptancePayload
    ) => {
      if (interactiveOperationRef.current) {
        throw new AppError({
          kind: "AUTH",
          message: "A registration request is already in progress.",
        });
      }
      setIsRegistering(true);
      setError(null);
      interactiveOperationRef.current = "REGISTER";
      interactiveUidRef.current = "pending";

      try {
        const existingPendingUser = firebaseAuth.currentUser?.email?.toLowerCase() === email.trim().toLowerCase()
          ? firebaseAuth.currentUser
          : null;
        const firebaseUser = existingPendingUser ||
          (await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)).user;
        interactiveUidRef.current = firebaseUser.uid;
        generationRef.current += 1;
        uidRef.current = firebaseUser.uid;
        setUser(firebaseUser);
        setState("FIREBASE_USER_PENDING_BACKEND");

        let registeredProfile: BackendUserProfile;
        const registerPayload: RegisterRequestPayload = {
          termsAccepted: Boolean(legal.termsAccepted),
          privacyAccepted: Boolean(legal.privacyAccepted),
          termsVersion: legal.termsVersion || "",
          privacyVersion: legal.privacyVersion || "",
          registrationProfile,
        };

        try {
          registeredProfile = await authApi.register(registerPayload);
        } catch (backendError) {
          if (isAppError(backendError) && backendError.code === "LEGAL_ACCEPTANCE_VERSION_CONFLICT") {
            // Keep the just-created Firebase identity available for an immediate retry
            // after the UI reloads the authoritative policy versions.
            await resetLocalState();
            throw backendError;
          }
          // Ambiguous/network failure reconciliation: check if user was created before failing
          try {
            registeredProfile = await authApi.profile();
          } catch {
            // Both register and profile failed. Roll back local state without deleting Firebase identity
            await resetLocalState();
            try {
              await signOut(firebaseAuth);
            } catch {
              // Local reset remains authoritative
            }
            throw isAppError(backendError) ? backendError : firebaseErrorToAppError(backendError);
          }
        }

        setIsRegistrationSession(true);
        commitProfile(registeredProfile, firebaseUser, generationRef.current);

        // Attempt initial verification email send using modular function
        try {
          if (!existingPendingUser) await sendEmailVerification(firebaseUser);
        } catch {
          // Initial verification send failure does not invalidate registration; user can resend from verify screen
        }
      } catch (cause) {
        throw isAppError(cause) ? cause : firebaseErrorToAppError(cause);
      } finally {
        interactiveOperationRef.current = null;
        interactiveUidRef.current = null;
        if (mountedRef.current) setIsRegistering(false);
      }
    },
    [commitProfile, resetLocalState]
  );

  const signInWithGoogle = useCallback(async () => {
    if (interactiveOperationRef.current) {
      throw new AppError({
        kind: "AUTH",
        message: "An authentication request is already in progress.",
      });
    }
    setIsSigningIn(true);
    setError(null);
    interactiveOperationRef.current = "GOOGLE_LOGIN";
    interactiveUidRef.current = "pending";

    try {
      devDiagnostic("GoogleAuth", "Firebase Google credential sign-in started");
      const idToken = await signInWithGoogleNative();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(firebaseAuth, credential);
      devDiagnostic("GoogleAuth", "Firebase Google credential sign-in succeeded");
      const firebaseUser = userCredential.user;

      interactiveUidRef.current = firebaseUser.uid;
      generationRef.current += 1;
      uidRef.current = firebaseUser.uid;
      setUser(firebaseUser);
      setState("FIREBASE_USER_PENDING_BACKEND");

      try {
        devDiagnostic("GoogleAuth", "Google backend login started", {
          method: "POST",
          path: "/auth/login",
        });
        const loginResponse = await authApi.login();
        devDiagnostic("GoogleAuth", "Google backend login succeeded");
        const isNew = Boolean(loginResponse.user?.isNewUser ?? (loginResponse as any).isNewUser);
        setIsRegistrationSession(isNew);
        commitProfile(loginResponse.user, firebaseUser, generationRef.current);
      } catch (loginError) {
        if (isAppError(loginError) && loginError.code === "LEGAL_ACCEPTANCE_REQUIRED") {
          devDiagnostic("GoogleAuth", "Google backend login requires JIT legal acceptance");
          // First-time Google user requires legal challenge
          setPendingLegalAction({
            kind: "GOOGLE_JIT_LOGIN",
            uid: firebaseUser.uid,
            generation: generationRef.current,
          });
          setState("LEGAL_REQUIRED");
          return;
        }

        if (isAppError(loginError) && loginError.code === "ACCOUNT_EXISTS_WITH_PASSWORD") {
          devDiagnostic("GoogleAuth", "Google backend login rejected due to password account", safeErrorDetails(loginError));
          // Same email has password account: clean up temporary Google Firebase state
          await resetLocalState();
          try {
            await signOut(firebaseAuth);
          } catch {}
          try {
            await signOutGoogleNative();
          } catch {}
          throw loginError;
        }

        await resetLocalState();
        try {
          await signOut(firebaseAuth);
        } catch {}
        try {
          await signOutGoogleNative();
        } catch {}
        throw loginError;
      }
    } catch (cause) {
      if (isAppError(cause) && cause.kind === "CANCELLED") {
        // User cancelled account chooser: cleanly release state
        return;
      }
      const normalized = isAppError(cause) ? cause : firebaseErrorToAppError(cause);
      devDiagnostic("GoogleAuth", "Google sign-in flow failed", safeErrorDetails(normalized));
      throw normalized;
    } finally {
      interactiveOperationRef.current = null;
      interactiveUidRef.current = null;
      if (mountedRef.current) setIsSigningIn(false);
    }
  }, [commitProfile, resetLocalState]);

  const checkEmailVerification = useCallback(
    async (isAutoCheck = false): Promise<boolean> => {
      if (verificationPromiseRef.current) {
        return verificationPromiseRef.current;
      }

      const checkPromise = (async () => {
        const firebaseUser = firebaseAuth.currentUser;
        if (!firebaseUser) return false;

        const generation = generationRef.current;
        const uid = firebaseUser.uid;

        if (!isAutoCheck) {
          setIsCheckingVerification(true);
          setError(null);
        }

        try {
          await reload(firebaseUser);
          const freshUser = firebaseAuth.currentUser;
          if (
            !isCurrent(generation, uid, generationRef.current, uidRef.current) ||
            !freshUser
          ) {
            return false;
          }

          if (freshUser.emailVerified) {
            await getIdToken(freshUser, true);
            const nextProfile = await authApi.profile();
            return commitProfile(nextProfile, freshUser, generation);
          }
          return false;
        } catch (cause) {
          if (!isAutoCheck && mountedRef.current) {
            setError(
              isAppError(cause)
                ? cause.message
                : "Could not verify email status. Please try again."
            );
          }
          return false;
        } finally {
          if (!isAutoCheck && mountedRef.current) {
            setIsCheckingVerification(false);
          }
        }
      })();

      verificationPromiseRef.current = checkPromise;
      try {
        return await checkPromise;
      } finally {
        verificationPromiseRef.current = null;
      }
    },
    [commitProfile]
  );

  const resendVerification = useCallback(async (): Promise<ResendVerificationResponse> => {
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser?.email) {
      throw new AppError({
        kind: "AUTH",
        message: "No active email address found to send verification to.",
      });
    }

    const response = await authApi.resendVerification(firebaseUser.email);
    try {
      await sendEmailVerification(firebaseUser);
    } catch (cause) {
      throw firebaseErrorToAppError(cause);
    }
    return response;
  }, []);

  const acceptLegal = useCallback(
    async (legal: LegalAcceptancePayload) => {
      setIsAcceptingLegal(true);
      setError(null);

      try {
        if (pendingLegalAction?.kind === "GOOGLE_JIT_LOGIN") {
          const generation = pendingLegalAction.generation;
          const firebaseUser = firebaseAuth.currentUser;
          if (!firebaseUser) {
            throw new AppError({
              kind: "AUTH",
              message: "Google sign-in session expired. Please sign in again.",
            });
          }
          const loginResponse = await authApi.login(legal);
          const isNew = Boolean(loginResponse.user?.isNewUser ?? loginResponse.isNewUser);
          setIsRegistrationSession(isNew);
          setPendingLegalAction(null);
          commitProfile(loginResponse.user, firebaseUser, generation);
        } else {
          const generation = generationRef.current;
          const firebaseUser = firebaseAuth.currentUser;
          if (!firebaseUser) {
            throw new AppError({
              kind: "AUTH",
              message: "Please sign in to accept terms.",
            });
          }
          const updatedProfile = await authApi.acceptLegal(legal);
          setIsRegistrationSession(false);
          commitProfile(updatedProfile, firebaseUser, generation);
        }
      } catch (cause) {
        throw isAppError(cause) ? cause : firebaseErrorToAppError(cause);
      } finally {
        if (mountedRef.current) setIsAcceptingLegal(false);
      }
    },
    [commitProfile, pendingLegalAction]
  );

  const cancelGoogleJitLegal = useCallback(async () => {
    setPendingLegalAction(null);
    await resetLocalState();
    try {
      await signOut(firebaseAuth);
    } catch {}
    try {
      await signOutGoogleNative();
    } catch {}
  }, [resetLocalState]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload): Promise<BackendUserProfile> => {
      setIsUpdatingProfile(true);
      setError(null);
      try {
        const generation = generationRef.current;
        const firebaseUser = firebaseAuth.currentUser;
        if (!firebaseUser) {
          throw new AppError({
            kind: "AUTH",
            message: "Please sign in to update your profile.",
          });
        }
        const updatedProfile = await authApi.updateProfile(payload);
        commitProfile(updatedProfile, firebaseUser, generation);
        return updatedProfile;
      } catch (cause) {
        throw isAppError(cause) ? cause : firebaseErrorToAppError(cause);
      } finally {
        if (mountedRef.current) setIsUpdatingProfile(false);
      }
    },
    [commitProfile]
  );

  const retryBootstrap = useCallback(async () => {
    if (user) {
      setState("FIREBASE_USER_PENDING_BACKEND");
      await bootstrapRestoredUser(user);
    } else {
      await resetLocalState();
    }
  }, [bootstrapRestoredUser, resetLocalState, user]);

  const logout = useCallback(async () => {
    await resetLocalState();
    try {
      await signOut(firebaseAuth);
    } catch {}
    try {
      await signOutGoogleNative();
    } catch {}
  }, [resetLocalState]);

  // AppState foreground email-verification re-check & authoritative profile refresh
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        if (state === "EMAIL_VERIFICATION_REQUIRED") {
          void checkEmailVerification(true);
        } else if (state === "AUTHENTICATED_READY") {
          void refreshProfile();
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [checkEmailVerification, refreshProfile, state]);

  const value = useMemo(
    () => ({
      state,
      user,
      profile,
      error,
      sessionIssue,
      pendingLegalAction,
      isRegistrationSession,
      isSigningIn,
      isRegistering,
      isCheckingVerification,
      isUpdatingProfile,
      isAcceptingLegal,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      checkEmailVerification,
      resendVerification,
      acceptLegal,
      cancelGoogleJitLegal,
      updateProfile,
      refreshProfile,
      retryBootstrap,
      logout,
    }),
    [
      state,
      user,
      profile,
      error,
      sessionIssue,
      pendingLegalAction,
      isRegistrationSession,
      isSigningIn,
      isRegistering,
      isCheckingVerification,
      isUpdatingProfile,
      isAcceptingLegal,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      checkEmailVerification,
      resendVerification,
      acceptLegal,
      cancelGoogleJitLegal,
      updateProfile,
      refreshProfile,
      retryBootstrap,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
};
