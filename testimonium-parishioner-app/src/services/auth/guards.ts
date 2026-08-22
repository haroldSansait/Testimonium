import type { AuthBootstrapState, InteractiveAuthOperation } from '@/types/auth';

export interface ProtectedRouteGuards {
  auth: boolean;
  onboarding: boolean;
  app: boolean;
}

export const getProtectedRouteGuards = (state: AuthBootstrapState): ProtectedRouteGuards => ({
  // Keep the current auth screen mounted while an interactive Firebase user is
  // being verified by the backend. The committed profile state selects the
  // onboarding or app destination once that operation finishes.
  auth:
    state === 'NO_FIREBASE_USER' ||
    state === 'FIREBASE_USER_PENDING_BACKEND' ||
    state === 'SESSION_ERROR',
  onboarding:
    state === 'EMAIL_VERIFICATION_REQUIRED' ||
    state === 'LEGAL_REQUIRED' ||
    state === 'PROFILE_COMPLETION_REQUIRED',
  app: state === 'AUTHENTICATED_READY',
});

export const observerShouldBootstrap = (
  interactiveOperation: InteractiveAuthOperation | null,
  interactiveUid: string | null,
  observedUid: string
): boolean => {
  if (interactiveOperation !== null) return false;
  return interactiveUid !== observedUid;
};

export const isCurrentAuthOperation = (
  operationGeneration: number,
  operationUid: string,
  currentGeneration: number,
  currentUid: string | null
): boolean => {
  return operationGeneration === currentGeneration && operationUid === currentUid;
};
