import { authApi } from "@/services/api/endpoints/auth";
import { evaluateBootstrapState } from "@/types/auth";
import type { BackendUserProfile } from "@/types/auth";

jest.mock("@/services/api/endpoints/auth");

const incompleteProfile: BackendUserProfile = {
  id: 3,
  firebaseUid: "user-3",
  email: "profile.user@example.com",
  fullName: "Emilio Aguinaldo",
  contactNumber: null,
  address: null,
  isVerified: true,
  emailVerified: true,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: true,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("Profile Completion Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("evaluates to PROFILE_COMPLETION_REQUIRED when needsProfileCompletion is true", () => {
    expect(evaluateBootstrapState(incompleteProfile, true)).toBe("PROFILE_COMPLETION_REQUIRED");
  });

  it("commits returned PUT profile directly and enters AUTHENTICATED_READY when completed", async () => {
    const completedProfile: BackendUserProfile = {
      ...incompleteProfile,
      contactNumber: "09123456789",
      address: "Kawit, Cavite",
      needsProfileCompletion: false,
    };

    (authApi.updateProfile as jest.Mock).mockResolvedValueOnce(completedProfile);

    const updatePayload = {
      firstName: "Emilio",
      lastName: "Aguinaldo",
      contactNumber: "09123456789",
      address: "Kawit, Cavite",
    };

    const result = await authApi.updateProfile(updatePayload);
    expect(result.needsProfileCompletion).toBe(false);
    expect(evaluateBootstrapState(result, true)).toBe("AUTHENTICATED_READY");
    // Verify updateProfile was called without an extra GET
    expect(authApi.updateProfile).toHaveBeenCalledWith(updatePayload);
    expect(authApi.profile).not.toHaveBeenCalled();
  });

  it("remains on PROFILE_COMPLETION_REQUIRED if server still marks profile incomplete", async () => {
    const stillIncomplete: BackendUserProfile = {
      ...incompleteProfile,
      contactNumber: "",
      needsProfileCompletion: true,
    };

    (authApi.updateProfile as jest.Mock).mockResolvedValueOnce(stillIncomplete);

    const result = await authApi.updateProfile({
      firstName: "Emilio",
      lastName: "Aguinaldo",
      contactNumber: "",
    });

    expect(result.needsProfileCompletion).toBe(true);
    expect(evaluateBootstrapState(result, true)).toBe("PROFILE_COMPLETION_REQUIRED");
  });
});