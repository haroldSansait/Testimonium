import { client } from './client';
import type {
  GovernmentIdFailedSide,
  GovernmentIdRejectionReason,
  GovernmentIdSideIssue,
  GovernmentIdType,
  GovernmentIdVerificationStatus,
} from '../utils/governmentIdVerificationPresentation';

export interface GovernmentIdVerificationStatusResponse {
  status: GovernmentIdVerificationStatus;
  isGovernmentIdVerified: boolean;
  rejectionReason?: GovernmentIdRejectionReason | null;
  rejectionMessage?: string | null;
  message?: string | null;
  failedSide?: GovernmentIdFailedSide | null;
  sideIssue?: GovernmentIdSideIssue | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  idType?: GovernmentIdType | null;
  lastAttemptAt?: string | null;
}

export const ID_TYPE_LABELS: Record<string, string> = {
  PHIL_SYS: "PhilSys / National ID",
  DRIVERS_LICENSE: "Driver's License",
  UMID: "Unified Multi-Purpose ID (UMID)",
  VOTER_ID: "Voter's ID",
  POSTAL_ID: "Postal ID",
};

export const submitGovernmentIdVerification = async (
  frontFile: File,
  backFile: File,
  options?: { signal?: AbortSignal }
): Promise<GovernmentIdVerificationStatusResponse> => {
  const formData = new FormData();
  formData.append("front", frontFile);
  formData.append("back", backFile);

  return client.post<GovernmentIdVerificationStatusResponse>(
    "/identity-verification/submit",
    formData,
    { signal: options?.signal }
  );
};

export const getGovernmentIdVerificationStatus = async (): Promise<GovernmentIdVerificationStatusResponse> => {
  return client.get<GovernmentIdVerificationStatusResponse>(
    "/identity-verification/status"
  );
};
