import { authApi } from "@/services/api/endpoints/auth";
import { AppError } from "@/services/api/errors";
import { evaluateBootstrapState } from "@/types/auth";
import type { BackendUserProfile } from "@/types/auth";

jest.mock("@/services/api/endpoints/auth");

const unverifiedProfile: BackendUserProfile = {
  id: 1,
  firebaseUid: "user-1",
  email: "verify.me@example.com",
  fullName: "Jose Rizal",
  isVerified: false,
  emailVerified: false,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: false,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("Email Verification and Resend Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("evaluates to EMAIL_VERIFICATION_REQUIRED when user is unverified", () => {
    expect(evaluateBootstrapState(unverifiedProfile, false)).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(evaluateBootstrapState({ ...unverifiedProfile, isVerified: false }, false)).toBe(
      "EMAIL_VERIFICATION_REQUIRED"
    );
  });

  it("transitions to AUTHENTICATED_READY once email is verified", () => {
    const verifiedProfile: BackendUserProfile = {
      ...unverifiedProfile,
      isVerified: true,
      emailVerified: true,
    };
    expect(evaluateBootstrapState(verifiedProfile, true)).toBe("AUTHENTICATED_READY");
  });

  it("calls POST /auth/resend-verification and returns cooldown info", async () => {
    (authApi.resendVerification as jest.Mock).mockResolvedValueOnce({
      message: "Verification email sent.",
      retryAfter: 60,
    });

    const response = await authApi.resendVerification("verify.me@example.com");
    expect(response.message).toBe("Verification email sent.");
    expect(response.retryAfter).toBe(60);
    expect(authApi.resendVerification).toHaveBeenCalledWith("verify.me@example.com");
  });

  it("propagates 429 rate limit errors with retryAfter info", async () => {
    (authApi.resendVerification as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "RATE_LIMIT",
        message: "Please wait 45 seconds before requesting another verification email.",
        status: 429,
        retryAfterMs: 45000,
        retryable: true,
      })
    );

    await expect(authApi.resendVerification("verify.me@example.com")).rejects.toMatchObject({
      kind: "RATE_LIMIT",
      retryAfterMs: 45000,
    });
  });

  it("shares in-flight verification checks across simultaneous triggers", async () => {
    let callCount = 0;
    const fetchProfileOnce = async () => {
      callCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ...unverifiedProfile, emailVerified: true };
    };

    let activePromise: Promise<BackendUserProfile> | null = null;
    const checkVerificationSingleFlight = () => {
      if (activePromise) return activePromise;
      activePromise = fetchProfileOnce().finally(() => {
        activePromise = null;
      });
      return activePromise;
    };

    const [result1, result2] = await Promise.all([
      checkVerificationSingleFlight(),
      checkVerificationSingleFlight(),
    ]);

    expect(result1.emailVerified).toBe(true);
    expect(result2.emailVerified).toBe(true);
    expect(callCount).toBe(1);
  });
});