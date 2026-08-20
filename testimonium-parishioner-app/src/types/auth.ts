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
  status: string;
  role: string;
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

export const evaluateBootstrapState = (profile: BackendUserProfile, firebaseEmailVerified: boolean): AuthBootstrapState => {
  if (profile.role !== "PARISHIONER" || profile.status !== "ACTIVE") return "SESSION_ERROR";
  if (!firebaseEmailVerified || !profile.emailVerified) return "EMAIL_VERIFICATION_REQUIRED";
  if (!profile.termsAccepted || !profile.privacyAccepted) return "LEGAL_REQUIRED";
  if (profile.needsProfileCompletion) return "PROFILE_COMPLETION_REQUIRED";
  return "AUTHENTICATED_READY";
};