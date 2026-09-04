import { apiClient } from "../client";
import type {
  BackendUserProfile,
  LegalAcceptancePayload,
  RegisterRequestPayload,
  ResendVerificationResponse,
  UpdateProfilePayload,
} from "@/types/auth";

export const authApi = {
  login: (legal?: LegalAcceptancePayload) =>
    apiClient.request<{ user: BackendUserProfile; isNewUser?: boolean }>({
      method: "POST",
      path: "/auth/login",
      body: legal ?? {},
    }),

  profile: () =>
    apiClient.request<BackendUserProfile>({
      path: "/auth/profile",
    }),

  register: (payload: RegisterRequestPayload) =>
    apiClient.request<BackendUserProfile>({
      method: "POST",
      path: "/auth/register",
      body: payload,
    }),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiClient.request<BackendUserProfile>({
      method: "PUT",
      path: "/auth/profile",
      body: payload,
    }),

  acceptLegal: (payload: LegalAcceptancePayload) =>
    apiClient.request<BackendUserProfile>({
      method: "POST",
      path: "/auth/legal-acceptance",
      body: payload,
    }),

  resendVerification: (email: string) =>
    apiClient.request<ResendVerificationResponse>({
      method: "POST",
      path: "/auth/resend-verification",
      body: { email },
    }),
};