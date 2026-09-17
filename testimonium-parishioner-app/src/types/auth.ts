export interface BackendUserProfile {
  id: number;
  firebaseUid: string;
  email: string;
  fullName: string;
  contactNumber?: string | null;
  address?: string | null;
  isVerified: boolean;
  emailVerified: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  needsProfileCompletion: boolean;
  isNewUser?: boolean;
  emailNotificationsEnabled?: boolean;
  status: string;
  role: string;
  parish?: {
    id: number;
    parishName: string;
    type: string;
  } | null;
}

export type AuthBootstrapState =
  | "BOOTING"
  | "NO_FIREBASE_USER"
  | "FIREBASE_USER_PENDING_BACKEND"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "LEGAL_REQUIRED"
  | "PROFILE_COMPLETION_REQUIRED"
  | "AUTHENTICATED_READY"
  | "SESSION_ERROR";

export type InteractiveAuthOperation =
  | "LOGIN"
  | "REGISTER"
  | "GOOGLE_LOGIN"
  | "GOOGLE_JIT_LEGAL";

export type PendingLegalAction =
  | { kind: "EXISTING_PROFILE_LEGAL"; uid: string; generation: number }
  | { kind: "GOOGLE_JIT_LOGIN"; uid: string; generation: number };

export interface SessionIssue {
  kind: "TRANSIENT_BOOTSTRAP" | "ACCOUNT_UNAVAILABLE" | "SESSION_EXPIRED";
  message: string;
  retryable: boolean;
}

export interface RegistrationProfilePayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
}

export interface LegalAcceptancePayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
}

export interface RegisterRequestPayload extends LegalAcceptancePayload {
  registrationProfile?: RegistrationProfilePayload;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  contactNumber?: string;
  address?: string;
  emailNotificationsEnabled?: boolean;
}

export interface ResendVerificationResponse {
  message: string;
  retryAfter?: number;
}

export const evaluateBootstrapState = (
  profile: BackendUserProfile,
  firebaseEmailVerified: boolean
): AuthBootstrapState => {
  if (profile.role !== "PARISHIONER" || profile.status !== "ACTIVE") return "SESSION_ERROR";
  if (!firebaseEmailVerified || !profile.emailVerified) return "EMAIL_VERIFICATION_REQUIRED";
  if (!profile.termsAccepted || !profile.privacyAccepted) return "LEGAL_REQUIRED";
  if (profile.needsProfileCompletion) return "PROFILE_COMPLETION_REQUIRED";
  return "AUTHENTICATED_READY";
};
