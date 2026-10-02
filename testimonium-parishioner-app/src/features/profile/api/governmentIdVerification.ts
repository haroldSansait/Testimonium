import { apiClient } from "@/services/api/client";
import type { GovernmentIdVerificationStatusResponse } from "../types/governmentId";

const SAFE_ERROR_BY_CODE: Record<string, string> = {
  IMAGE_BLURRY: "The image is too blurry. Please retake this side in better lighting.",
  FRONT_BACK_INCOMPLETE: "We couldn't clearly read both sides of your ID.",
  NAME_MISMATCH: "The name on your ID does not match your profile name.",
  ID_EXPIRED: "This ID appears to be expired.",
  UNSUPPORTED_ID: "We couldn't recognize this as one of the supported Philippine IDs.",
  UNSUPPORTED_OR_INVALID_DOCUMENT:
    "We couldn't recognize this as one of the supported Philippine IDs.",
};

export const getSafeVerificationErrorMessage = (error: unknown): string => {
  const candidate = error as { code?: unknown; status?: unknown; kind?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  if (SAFE_ERROR_BY_CODE[code]) return SAFE_ERROR_BY_CODE[code];

  if (
    candidate?.status === 503 ||
    candidate?.kind === "NETWORK" ||
    candidate?.kind === "TIMEOUT" ||
    code === "OCR_PROVIDER_UNAVAILABLE" ||
    code === "API_CONNECTION_FAILED" ||
    code === "API_REQUEST_TIMEOUT"
  ) {
    return "We couldn't verify your ID right now. Please try again.";
  }

  return "We couldn't verify this ID. Please retake the photos and try again.";
};

export const submitGovernmentIdVerification = async (
  frontUri: string,
  backUri: string
): Promise<GovernmentIdVerificationStatusResponse> => {
  const formData = new FormData();

  formData.append(
    "front",
    {
      uri: frontUri,
      name: "front.jpg",
      type: "image/jpeg",
    } as unknown as Blob
  );

  formData.append(
    "back",
    {
      uri: backUri,
      name: "back.jpg",
      type: "image/jpeg",
    } as unknown as Blob
  );

  return apiClient.request<GovernmentIdVerificationStatusResponse>({
    method: "POST",
    // getApiBaseUrl() owns the canonical /api/v1 prefix.
    path: "/identity-verification/submit",
    body: formData,
    isMultipart: true,
    timeoutMs: 60000,
  });
};

export const getGovernmentIdVerificationStatus = async (): Promise<GovernmentIdVerificationStatusResponse> => {
  return apiClient.request<GovernmentIdVerificationStatusResponse>({
    method: "GET",
    path: "/identity-verification/status",
  });
};
