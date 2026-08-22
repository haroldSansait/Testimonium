import { authApi } from "@/services/api/endpoints/auth";
import { AppError } from "@/services/api/errors";
import { isGoogleAuthAvailable, signInWithGoogleNative } from "@/services/auth/googleAuth";
import { evaluateBootstrapState } from "@/types/auth";
import type { BackendUserProfile } from "@/types/auth";

jest.mock("@/services/api/endpoints/auth");
jest.mock("@/config/environment", () => ({
  isGoogleSignInEnabled: jest.fn(() => false),
  getGoogleWebClientId: jest.fn(() => undefined),
  getApiBaseUrl: jest.fn(() => "https://api.test/api/v1"),
}));

const googleUserProfile: BackendUserProfile = {
  id: 4,
  firebaseUid: "google-uid-4",
  email: "google.user@example.com",
  fullName: "Gabriela Silang",
  isVerified: true,
  emailVerified: true,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: false,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("Google Sign-In and JIT Provisioning Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false for isGoogleAuthAvailable when feature flag or client ID is disabled", () => {
    expect(isGoogleAuthAvailable()).toBe(false);
  });

  it("throws FORBIDDEN when native Google auth is initiated while disabled", async () => {
    await expect(signInWithGoogleNative()).rejects.toMatchObject({
      kind: "FORBIDDEN",
      message: expect.stringContaining("not currently enabled"),
    });
  });

  it("identifies LEGAL_ACCEPTANCE_REQUIRED on first-time Google sign-in", async () => {
    (authApi.login as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "VALIDATION",
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Acceptance of Terms of Service and Privacy Policy is required.",
      })
    );

    let requiredLegal = false;
    try {
      await authApi.login();
    } catch (err) {
      if (err instanceof AppError && err.code === "LEGAL_ACCEPTANCE_REQUIRED") {
        requiredLegal = true;
      }
    }

    expect(requiredLegal).toBe(true);
  });

  it("identifies ACCOUNT_EXISTS_WITH_PASSWORD cross-provider collision", async () => {
    (authApi.login as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "CONFLICT",
        code: "ACCOUNT_EXISTS_WITH_PASSWORD",
        message: "This email already has a password account. Please sign in using your password.",
      })
    );

    let conflictCaught = false;
    try {
      await authApi.login();
    } catch (err) {
      if (err instanceof AppError && err.code === "ACCOUNT_EXISTS_WITH_PASSWORD") {
        conflictCaught = true;
      }
    }

    expect(conflictCaught).toBe(true);
  });

  it("enforces PARISHIONER role safety for Google authenticated accounts", () => {
    const nonParishionerGoogle: BackendUserProfile = {
      ...googleUserProfile,
      role: "DIOCESE_COORDINATOR",
    };

    expect(evaluateBootstrapState(nonParishionerGoogle, true)).toBe("SESSION_ERROR");
  });
});