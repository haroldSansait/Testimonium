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

  requestVerificationOtp: () =>
    apiClient.request<{
      alreadyVerified?: boolean;
      success: boolean;
      message: string;
      cooldownSeconds?: number;
      expiresInMinutes?: number;
    }>({
      method: "POST",
      path: "/auth/otp/verification/request",
      timeoutMs: 100_000,
    }),

  confirmVerificationOtp: (code: string) =>
    apiClient.request<BackendUserProfile>({
      method: "POST",
      path: "/auth/otp/verification/confirm",
      timeoutMs: 100_000,
      body: { code },
    }),

  requestPasswordResetOtp: (email: string) =>
    apiClient.request<{
      success: boolean;
      message: string;
      cooldownSeconds?: number;
      expiresInMinutes?: number;
    }>({
      method: "POST",
      path: "/auth/password-reset/request",
      auth: false,
      timeoutMs: 100_000,
      body: { email },
    }),

  verifyPasswordResetOtp: (email: string, code: string) =>
    apiClient.request<{
      success: boolean;
      message?: string;
      resetToken: string;
      expiresInMinutes?: number;
    }>({
      method: "POST",
      path: "/auth/password-reset/verify",
      auth: false,
      timeoutMs: 100_000,
      body: { email, code },
    }),

  completePasswordReset: (payload: { email: string; resetToken: string; newPassword: string }) =>
    apiClient.request<{ success: boolean; message: string }>({
      method: "POST",
      path: "/auth/password-reset/complete",
      auth: false,
      timeoutMs: 100_000,
      body: payload,
    }),
};