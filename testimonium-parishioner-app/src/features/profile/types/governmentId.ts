export type GovernmentIdVerificationStatus =
  | 'NOT_SUBMITTED'
  | 'VERIFIED'
  | 'REJECTED';

export type GovernmentIdType =
  | 'PHIL_SYS'
  | 'DRIVERS_LICENSE'
  | 'UMID'
  | 'VOTER_ID'
  | 'POSTAL_ID';

export type GovernmentIdRejectionReason =
  | 'IMAGE_BLURRY'
  | 'FRONT_BACK_INCOMPLETE'
  | 'NAME_MISMATCH'
  | 'ID_EXPIRED'
  | 'UNSUPPORTED_OR_INVALID_DOCUMENT';

export interface GovernmentIdVerificationStatusResponse {
  status: GovernmentIdVerificationStatus;
  rejectionReason: GovernmentIdRejectionReason | null;
  rejectionMessage: string | null;
  /** Server detail retained for diagnostics only; never render this directly. */
  message?: string | null;
  /** Optional future-safe targeting hint; current backend may omit it. */
  failedSide?: 'front' | 'back' | 'both' | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  idType: string | null;
  isGovernmentIdVerified: boolean;
}

export const ID_TYPE_LABELS: Record<string, string> = {
  PHIL_SYS: 'Philippine Identification (PhilSys / National ID)',
  DRIVERS_LICENSE: "Driver's License (LTO)",
  UMID: 'Unified Multi-Purpose ID (UMID)',
  VOTER_ID: 'Voter ID (COMELEC)',
  POSTAL_ID: 'Postal ID (PhilPost)',
};

export const REJECTION_REASON_MESSAGES: Record<string, string> = {
  IMAGE_BLURRY:
    'The ID photo is too blurry or low quality. Please retake the photo in good lighting with clear focus.',
  FRONT_BACK_INCOMPLETE:
    'Both the front and back of the ID card are required and must be distinct sides.',
  NAME_MISMATCH:
    'The name on the ID does not match your registered TESTIMONIUM profile name.',
  ID_EXPIRED:
    'The submitted Government ID has expired. Please provide a currently valid ID.',
  UNSUPPORTED_OR_INVALID_DOCUMENT:
    'The document provided is not an accepted Philippine Government-issued card ID (PhilSys, Driver\'s License, UMID, Voter ID, or Postal ID).',
};
