import { authApi } from "@/services/api/endpoints/auth";
import { AppError } from "@/services/api/errors";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import type { BackendUserProfile, PendingLegalAction } from "@/types/auth";

jest.mock("@/services/api/endpoints/auth");

const profileNeedingLegal: BackendUserProfile = {
  id: 2,
  firebaseUid: "user-2",
  email: "legal.user@example.com",
  fullName: "Andres Bonifacio",
  isVerified: true,
  emailVerified: true,
  termsAccepted: false,
  privacyAccepted: false,
  needsProfileCompletion: false,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("Legal Acceptance Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("submits POST /auth/legal-acceptance for normal existing users", async () => {
    const acceptedProfile: BackendUserProfile = {
      ...profileNeedingLegal,
      termsAccepted: true,
      privacyAccepted: true,
    };
    (authApi.acceptLegal as jest.Mock).mockResolvedValueOnce(acceptedProfile);

    const payload = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    };

    const result = await authApi.acceptLegal(payload);
    expect(result.termsAccepted).toBe(true);
    expect(result.privacyAccepted).toBe(true);
    expect(authApi.acceptLegal).toHaveBeenCalledWith(payload);
  });

  it("re-submits POST /auth/login with legal payload for first-time Google JIT users", async () => {
    const pendingAction: PendingLegalAction = {
      kind: "GOOGLE_JIT_LOGIN",
      uid: "google-uid-123",
      generation: 1,
    };

    const jitProfile: BackendUserProfile = {
      ...profileNeedingLegal,
      firebaseUid: "google-uid-123",
      termsAccepted: true,
      privacyAccepted: true,
    };

    (authApi.login as jest.Mock).mockResolvedValueOnce({ user: jitProfile });

    const legalPayload = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    };

    let resultUser: BackendUserProfile | null = null;
    if (pendingAction.kind === "GOOGLE_JIT_LOGIN") {
      const response = await authApi.login(legalPayload);
      resultUser = response.user;
    }

    expect(resultUser).toEqual(jitProfile);
    expect(authApi.login).toHaveBeenCalledWith(legalPayload);
  });

  it("does not modify profile when legal acceptance network call fails", async () => {
    (authApi.acceptLegal as jest.Mock).mockRejectedValueOnce(
      new AppError({ kind: "SERVER", message: "Database temporarily unavailable." })
    );

    await expect(
      authApi.acceptLegal({
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      })
    ).rejects.toMatchObject({
      kind: "SERVER",
    });
  });
});