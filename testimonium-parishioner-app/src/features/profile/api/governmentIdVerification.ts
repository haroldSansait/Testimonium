import { apiClient } from "@/services/api/client";
import {
  REJECTION_REASON_MESSAGES,
  type GovernmentIdRejectionReason,
  type GovernmentIdSideIssue,
  type GovernmentIdVerificationStatusResponse,
} from "../types/governmentId";

export type GovernmentIdFailureKind =
  | "BUSINESS_REJECTION"
  | "CONNECTION"
  | "TEMPORARY"
  | "IN_PROGRESS"
  | "RATE_LIMIT"
  | "UNKNOWN";

export interface GovernmentIdFailurePresentation {
  kind: GovernmentIdFailureKind;
  title: string;
  message: string;
  action: "retake" | "retry" | "none" | "dismiss";
  retakeTarget?: "front" | "back" | "both";
}

const BUSINESS_REJECTION_TITLES: Record<GovernmentIdRejectionReason, string> = {
  IMAGE_BLURRY: "ID Photo Unclear",
  FRONT_BACK_INCOMPLETE: "Front and Back Required",
  NAME_MISMATCH: "Name Does Not Match",
  ID_EXPIRED: "ID Appears Expired",
  UNSUPPORTED_OR_INVALID_DOCUMENT: "ID Could Not Be Recognized",
};

const SIDE_ISSUE_PRESENTATIONS: Record<
  GovernmentIdSideIssue,
  Pick<GovernmentIdFailurePresentation, "title" | "message" | "retakeTarget">
> = {
  BOTH_APPEAR_FRONT: {
    title: "Back Side Needed",
    message:
      "Both photos appear to show the front of the ID. Retake the back side of your Government ID.",
    retakeTarget: "back",
  },
  BOTH_APPEAR_BACK: {
    title: "Front Side Needed",
    message:
      "Both photos appear to show the back of the ID. Retake the front side of your Government ID.",
    retakeTarget: "front",
  },
  FRONT_IS_BACK: {
    title: "Front Side Needed",
    message: "The photo submitted as the front appears to show the back of the ID.",
    retakeTarget: "front",
  },
  BACK_IS_FRONT: {
    title: "Back Side Needed",
    message: "The photo submitted as the back appears to show the front of the ID.",
    retakeTarget: "back",
  },
  SIDES_SWAPPED: {
    title: "Front and Back Are Reversed",
    message:
      "The front and back photos appear to be reversed. Retake them in the correct order.",
    retakeTarget: "both",
  },
};

const TEMPORARY_ERROR_CODES = new Set([
  "OCR_SERVICE_UNAVAILABLE",
  "OCR_PROVIDER_UNAVAILABLE",
  "OCR_UPSTREAM_ERROR",
  "OCR_TIMEOUT_OR_UNAVAILABLE",
  "IDENTITY_STORAGE_UNAVAILABLE",
  "STORAGE_ERROR",
  "IDENTITY_PERSISTENCE_ERROR",
  "API_REQUEST_TIMEOUT",
]);

const unknownFailure = (): GovernmentIdFailurePresentation => ({
  kind: "UNKNOWN",
  title: "Unable to Verify ID",
  message: "Something went wrong while verifying your ID. Please try again.",
  action: "retry",
});

export const getGovernmentIdRejectionPresentation = (
  reason: string | null | undefined,
  failedSide?: "front" | "back" | "both" | null,
  sideIssue?: GovernmentIdSideIssue | null
): GovernmentIdFailurePresentation => {
  if (!reason || !Object.hasOwn(BUSINESS_REJECTION_TITLES, reason)) {
    return unknownFailure();
  }

  if (
    reason === "FRONT_BACK_INCOMPLETE" &&
    sideIssue &&
    Object.hasOwn(SIDE_ISSUE_PRESENTATIONS, sideIssue)
  ) {
    return {
      kind: "BUSINESS_REJECTION",
      ...SIDE_ISSUE_PRESENTATIONS[sideIssue],
      action: "retake",
    };
  }

  const canonicalReason = reason as GovernmentIdRejectionReason;
  return {
    kind: "BUSINESS_REJECTION",
    title: BUSINESS_REJECTION_TITLES[canonicalReason],
    message: REJECTION_REASON_MESSAGES[canonicalReason],
    action: "retake",
    retakeTarget:
      failedSide === "front" || failedSide === "back" ? failedSide : "both",
  };
};

export const getGovernmentIdErrorPresentation = (
  error: unknown
): GovernmentIdFailurePresentation => {
  const candidate = error as { code?: unknown; status?: unknown; kind?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";

  if (Object.hasOwn(BUSINESS_REJECTION_TITLES, code)) {
    return getGovernmentIdRejectionPresentation(code);
  }

  if (code === "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS") {
    return {
      kind: "IN_PROGRESS",
      title: "Verification Already in Progress",
      message:
        "Your Government ID is already being checked. Please wait for the current attempt to finish.",
      action: "none",
    };
  }

  if (
    candidate?.status === 429 ||
    candidate?.status === "429" ||
    candidate?.kind === "RATE_LIMIT" ||
    code === "RATE_LIMIT_EXCEEDED" ||
    code === "auth/too-many-requests"
  ) {
    return {
      kind: "RATE_LIMIT",
      title: "Too Many Verification Attempts",
      message:
        "You've reached the Government ID verification attempt limit. Please wait a few minutes before trying again.",
      action: "dismiss",
    };
  }

  if (code === "API_CONNECTION_FAILED" || candidate?.kind === "NETWORK") {
    return {
      kind: "CONNECTION",
      title: "Connection Problem",
      message:
        "Unable to connect to TESTIMONIUM. Check your internet connection and try again.",
      action: "retry",
    };
  }

  if (
    candidate?.status === 503 ||
    candidate?.kind === "TIMEOUT" ||
    TEMPORARY_ERROR_CODES.has(code)
  ) {
    return {
      kind: "TEMPORARY",
      title: "Verification Temporarily Unavailable",
      message:
        "We couldn't process your ID right now. Your ID was not rejected. Please try again.",
      action: "retry",
    };
  }

  return unknownFailure();
};

export const getSafeVerificationErrorMessage = (error: unknown): string =>
  getGovernmentIdErrorPresentation(error).message;

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
