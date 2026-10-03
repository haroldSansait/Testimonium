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

export type GovernmentIdFailedSide = 'front' | 'back' | 'both';

export type GovernmentIdSideIssue =
  | 'FRONT_IS_BACK'
  | 'BACK_IS_FRONT'
  | 'BOTH_APPEAR_FRONT'
  | 'BOTH_APPEAR_BACK'
  | 'SIDES_SWAPPED';

export type GovernmentIdFailureKind =
  | 'BUSINESS_REJECTION'
  | 'CONNECTION'
  | 'TEMPORARY'
  | 'IN_PROGRESS'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface GovernmentIdFailurePresentation {
  kind: GovernmentIdFailureKind;
  title: string;
  message: string;
  action: 'retake' | 'retry' | 'none' | 'dismiss';
  retakeTarget?: GovernmentIdFailedSide;
}

const BUSINESS_REJECTION_PRESENTATIONS: Record<
  GovernmentIdRejectionReason,
  Pick<GovernmentIdFailurePresentation, 'title' | 'message'>
> = {
  IMAGE_BLURRY: {
    title: 'ID Photo Unclear',
    message:
      'We couldn\'t read the ID clearly. Retake the affected photo with the card flat, fully visible, and in clear lighting.',
  },
  FRONT_BACK_INCOMPLETE: {
    title: 'Front and Back Required',
    message:
      'We couldn\'t verify both sides of the ID. Make sure the front and back photos are different and clearly show both sides of the same ID.',
  },
  NAME_MISMATCH: {
    title: 'Name Does Not Match',
    message:
      'The name on the ID does not match your registered TESTIMONIUM profile name.',
  },
  ID_EXPIRED: {
    title: 'ID Appears Expired',
    message:
      'This ID appears to be expired. Please use a valid, unexpired supported ID.',
  },
  UNSUPPORTED_OR_INVALID_DOCUMENT: {
    title: 'ID Could Not Be Recognized',
    message:
      'We couldn\'t recognize this as one of the supported Government IDs. Please use a PhilSys / National ID, Driver\'s License, UMID, Voter ID, or Postal ID and make sure the document is clearly visible.',
  },
};

const SIDE_ISSUE_PRESENTATIONS: Record<
  GovernmentIdSideIssue,
  Pick<GovernmentIdFailurePresentation, 'title' | 'message' | 'retakeTarget'>
> = {
  BOTH_APPEAR_FRONT: {
    title: 'Back Side Needed',
    message:
      'Both photos appear to show the front of the ID. Retake the back side of your Government ID.',
    retakeTarget: 'back',
  },
  BOTH_APPEAR_BACK: {
    title: 'Front Side Needed',
    message:
      'Both photos appear to show the back of the ID. Retake the front side of your Government ID.',
    retakeTarget: 'front',
  },
  FRONT_IS_BACK: {
    title: 'Front Side Needed',
    message:
      'The photo submitted as the front appears to show the back of the ID.',
    retakeTarget: 'front',
  },
  BACK_IS_FRONT: {
    title: 'Back Side Needed',
    message:
      'The photo submitted as the back appears to show the front of the ID.',
    retakeTarget: 'back',
  },
  SIDES_SWAPPED: {
    title: 'Front and Back Are Reversed',
    message:
      'The front and back photos appear to be reversed. Retake them in the correct order.',
    retakeTarget: 'both',
  },
};

const TEMPORARY_ERROR_CODES = new Set([
  'OCR_SERVICE_UNAVAILABLE',
  'OCR_PROVIDER_UNAVAILABLE',
  'OCR_UPSTREAM_ERROR',
  'OCR_TIMEOUT_OR_UNAVAILABLE',
  'IDENTITY_STORAGE_UNAVAILABLE',
  'STORAGE_ERROR',
  'IDENTITY_PERSISTENCE_ERROR',
  'GOVERNMENT_ID_REQUEST_TIMEOUT',
]);

const unknownFailure = (): GovernmentIdFailurePresentation => ({
  kind: 'UNKNOWN',
  title: 'Unable to Verify ID',
  message: 'Something went wrong while verifying your ID. Please try again.',
  action: 'retry',
});

const isRejectionReason = (
  value: unknown
): value is GovernmentIdRejectionReason =>
  typeof value === 'string' && value in BUSINESS_REJECTION_PRESENTATIONS;

const isSideIssue = (value: unknown): value is GovernmentIdSideIssue =>
  typeof value === 'string' && value in SIDE_ISSUE_PRESENTATIONS;

export const getGovernmentIdRejectionPresentation = (
  reason: string | null | undefined,
  failedSide?: GovernmentIdFailedSide | null,
  sideIssue?: GovernmentIdSideIssue | null
): GovernmentIdFailurePresentation => {
  if (!isRejectionReason(reason)) return unknownFailure();

  if (reason === 'FRONT_BACK_INCOMPLETE' && isSideIssue(sideIssue)) {
    return {
      kind: 'BUSINESS_REJECTION',
      ...SIDE_ISSUE_PRESENTATIONS[sideIssue],
      action: 'retake',
    };
  }

  return {
    kind: 'BUSINESS_REJECTION',
    ...BUSINESS_REJECTION_PRESENTATIONS[reason],
    action: 'retake',
    retakeTarget:
      failedSide === 'front' || failedSide === 'back' ? failedSide : 'both',
  };
};

interface WebApiErrorShape {
  code?: unknown;
  statusCode?: unknown;
  kind?: unknown;
}

export const getGovernmentIdErrorPresentation = (
  error: unknown
): GovernmentIdFailurePresentation => {
  const candidate = error as WebApiErrorShape | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';

  if (isRejectionReason(code)) {
    return getGovernmentIdRejectionPresentation(code);
  }

  if (code === 'GOVERNMENT_ID_VERIFICATION_IN_PROGRESS') {
    return {
      kind: 'IN_PROGRESS',
      title: 'Verification Already in Progress',
      message:
        'Your Government ID is already being checked. Please wait for the current attempt to finish.',
      action: 'none',
    };
  }

  if (candidate?.statusCode === 429 || candidate?.kind === 'RATE_LIMIT') {
    return {
      kind: 'RATE_LIMIT',
      title: 'Too Many Verification Attempts',
      message:
        'You\'ve reached the Government ID verification attempt limit. Please wait a few minutes before trying again.',
      action: 'dismiss',
    };
  }

  if (error instanceof TypeError || candidate?.kind === 'NETWORK') {
    return {
      kind: 'CONNECTION',
      title: 'Connection Problem',
      message:
        'Unable to connect to TESTIMONIUM. Check your internet connection and try again.',
      action: 'retry',
    };
  }

  if (
    candidate?.statusCode === 503 ||
    candidate?.kind === 'TIMEOUT' ||
    TEMPORARY_ERROR_CODES.has(code)
  ) {
    return {
      kind: 'TEMPORARY',
      title: 'Verification Temporarily Unavailable',
      message:
        'We couldn\'t process your ID right now. Your ID was not rejected. Please try again.',
      action: 'retry',
    };
  }

  return unknownFailure();
};

export const getRetakeSides = (
  target: GovernmentIdFailedSide
): readonly ('front' | 'back')[] => {
  if (target === 'front') return ['front'];
  if (target === 'back') return ['back'];
  return ['front', 'back'];
};

const MAX_GOVERNMENT_ID_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_GOVERNMENT_ID_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
]);

export const validateGovernmentIdFile = (
  file: { type: string; size: number },
  side: 'Front' | 'Back'
): string | null => {
  if (file.size === 0) return `${side} ID image cannot be empty.`;
  if (!ACCEPTED_GOVERNMENT_ID_MIME_TYPES.has(file.type)) {
    return 'Invalid file type. Only JPEG and PNG images are accepted.';
  }
  if (file.size > MAX_GOVERNMENT_ID_FILE_SIZE) {
    return `${side} ID image must be 10MB or smaller.`;
  }
  return null;
};

export class GovernmentIdAttemptTracker {
  private generation = 0;
  private active = false;
  private mounted = true;

  mount(): void {
    this.mounted = true;
  }

  start(): number | null {
    if (!this.mounted || this.active) return null;
    this.active = true;
    this.generation += 1;
    return this.generation;
  }

  finish(attemptId: number): void {
    if (this.generation === attemptId) this.active = false;
  }

  invalidate(): void {
    this.generation += 1;
    this.active = false;
  }

  unmount(): void {
    this.mounted = false;
    this.invalidate();
  }

  isCurrent(attemptId: number): boolean {
    return this.mounted && this.generation === attemptId;
  }
}
