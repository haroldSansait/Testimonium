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

export type GovernmentIdSideIssue =
  | 'FRONT_IS_BACK'
  | 'BACK_IS_FRONT'
  | 'BOTH_APPEAR_FRONT'
  | 'BOTH_APPEAR_BACK'
  | 'SIDES_SWAPPED';

export interface GovernmentIdVerificationStatusResponse {
  status: GovernmentIdVerificationStatus;
  rejectionReason: GovernmentIdRejectionReason | null;
  rejectionMessage: string | null;
  /** Server detail retained for diagnostics only; never render this directly. */
  message?: string | null;
  /** Optional future-safe targeting hint; current backend may omit it. */
  failedSide?: 'front' | 'back' | 'both' | null;
  /** Non-persisted diagnostic emitted only for strong backend OCR side evidence. */
  sideIssue?: GovernmentIdSideIssue | null;
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
    'We couldn\'t read the ID clearly. Retake the affected photo with the card flat, fully visible, and in clear lighting.',
  FRONT_BACK_INCOMPLETE:
    'We couldn\'t verify both sides of the ID. Make sure the front and back photos are different and clearly show both sides of the same ID.',
  NAME_MISMATCH:
    'The name on the ID does not match your registered TESTIMONIUM profile name.',
  ID_EXPIRED:
    'This ID appears to be expired. Please use a valid, unexpired supported ID.',
  UNSUPPORTED_OR_INVALID_DOCUMENT:
    'We couldn\'t recognize this as one of the supported Government IDs. Please use a PhilSys / National ID, Driver\'s License, UMID, Voter ID, or Postal ID and make sure the document is clearly visible.',
};
