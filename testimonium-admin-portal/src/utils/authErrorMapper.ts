import type { ApiError } from '@/types/api';

/**
 * Maps raw Firebase authentication errors and backend API errors
 * to user-friendly, consistent display messages.
 * Never exposes raw Firebase error codes, stack traces, or internal exceptions.
 */
const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account exists with this email.',
  'auth/email-already-in-use': 'An account already exists using this email.',
  'auth/weak-password': 'Your password must be at least 8 characters long.',
  'auth/network-request-failed': 'Unable to connect. Please check your internet connection.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/popup-closed-by-user': 'Sign-in cancelled. Please try again.',
  'auth/cancelled-popup-request': 'Sign-in cancelled. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/requires-recent-login': 'Please sign in again to complete this sensitive action.',
  'auth/quota-exceeded': 'Service temporarily unavailable. Please try again later.',
};

const BACKEND_ERROR_MAP: Record<string, string> = {
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  ACCOUNT_EXISTS_WITH_GOOGLE: 'This email is registered with Google Sign-In. Please sign in using Google.',
  ACCOUNT_EXISTS_WITH_PASSWORD: 'This email already has a password account. Please sign in using your password.',
  LEGAL_ACCEPTANCE_REQUIRED: 'Acceptance of Terms of Service and Privacy Policy is required.',
  ACCOUNT_DISABLED: 'This account has been disabled. Please contact your coordinator.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Your account does not have access to this resource.',
};

export function mapAuthError(err: unknown, defaultMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return defaultMessage;

  // 1. Firebase Auth Errors (code property: 'auth/...')
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (FIREBASE_ERROR_MAP[code]) {
      return FIREBASE_ERROR_MAP[code];
    }
  }

  // 2. Backend API Error Envelope / Axios Error with status/code
  if (typeof err === 'object' && err !== null) {
    const apiErr = err as ApiError & { code?: string; message?: string; status?: number; response?: { data?: { code?: string; message?: string } } };
    
    // Check nested response data code or top-level code
    const backendCode = apiErr.response?.data?.code || apiErr.code;
    if (backendCode && BACKEND_ERROR_MAP[backendCode]) {
      return BACKEND_ERROR_MAP[backendCode];
    }

    // Check HTTP status code
    if (apiErr.status === 403 || apiErr.response?.data?.message?.includes('access to the Admin Portal')) {
      return apiErr.response?.data?.message || apiErr.message || 'Your account does not have access to the Admin Portal.';
    }

    if (apiErr.status === 401) {
      return 'Incorrect email or password.';
    }

    // Clean user-facing message if provided by backend (excluding internal exceptions)
    const rawMsg = apiErr.response?.data?.message || apiErr.message;
    if (rawMsg && typeof rawMsg === 'string') {
      // Don't leak raw Firebase strings that slipped into message
      if (rawMsg.startsWith('Firebase:')) {
        for (const [code, msg] of Object.entries(FIREBASE_ERROR_MAP)) {
          if (rawMsg.includes(code)) return msg;
        }
        return 'Authentication failed. Please check your credentials.';
      }
      return rawMsg;
    }
  }

  // 3. Standard JS Error
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.startsWith('Firebase:')) {
      for (const [code, displayMsg] of Object.entries(FIREBASE_ERROR_MAP)) {
        if (msg.includes(code)) return displayMsg;
      }
      return 'Authentication failed. Please check your credentials.';
    }
    return msg;
  }

  return defaultMessage;
}
