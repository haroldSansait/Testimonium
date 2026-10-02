import { client } from "./client";

export interface GovernmentIdVerificationStatusResponse {
  status: 'NOT_SUBMITTED' | 'VERIFIED' | 'REJECTED';
  isGovernmentIdVerified: boolean;
  rejectionReason?: string | null;
  rejectionMessage?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  idType?: string | null;
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
  backFile: File
): Promise<GovernmentIdVerificationStatusResponse> => {
  const formData = new FormData();
  formData.append("front", frontFile);
  formData.append("back", backFile);

  return client.post<GovernmentIdVerificationStatusResponse>(
    "/identity-verification/submit",
    formData
  );
};

export const getGovernmentIdVerificationStatus = async (): Promise<GovernmentIdVerificationStatusResponse> => {
  return client.get<GovernmentIdVerificationStatusResponse>(
    "/identity-verification/status"
  );
};
