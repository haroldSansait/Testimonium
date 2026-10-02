export type IdentityVerificationStatus = 'NOT_SUBMITTED' | 'VERIFIED' | 'REJECTED';

export interface IdentityStatusData {
  status: IdentityVerificationStatus;
  idType: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  lastAttemptAt: string | null;
  isGovernmentIdVerified: boolean;
}

const VALID_STATUSES = new Set<IdentityVerificationStatus>([
  'NOT_SUBMITTED',
  'VERIFIED',
  'REJECTED',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalNullableString = (
  payload: Record<string, unknown>,
  field: string
): string | null => {
  const value = payload[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Invalid Government ID status response.');
  }
  return value;
};

export const parseIdentityStatusResponse = (body: unknown): IdentityStatusData => {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new Error('Invalid Government ID status response.');
  }

  const payload = body.data;
  if (
    typeof payload.status !== 'string' ||
    !VALID_STATUSES.has(payload.status as IdentityVerificationStatus) ||
    typeof payload.isGovernmentIdVerified !== 'boolean'
  ) {
    throw new Error('Invalid Government ID status response.');
  }

  return {
    status: payload.status as IdentityVerificationStatus,
    isGovernmentIdVerified: payload.isGovernmentIdVerified,
    idType: optionalNullableString(payload, 'idType'),
    verifiedAt: optionalNullableString(payload, 'verifiedAt'),
    expiresAt: optionalNullableString(payload, 'expiresAt'),
    rejectionReason: optionalNullableString(payload, 'rejectionReason'),
    lastAttemptAt: optionalNullableString(payload, 'lastAttemptAt'),
  };
};
