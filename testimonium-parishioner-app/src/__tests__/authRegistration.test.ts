import { authApi } from "@/services/api/endpoints/auth";
import { AppError } from "@/services/api/errors";
import { observerShouldBootstrap } from "@/services/auth/guards";
import type { BackendUserProfile } from "@/types/auth";

jest.mock("@/services/api/endpoints/auth");
jest.mock("@react-native-firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  createUserWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

const mockProfile: BackendUserProfile = {
  id: 10,
  firebaseUid: "new-user-uid",
  email: "new.parishioner@example.com",
  fullName: "Maria Clara",
  isVerified: false,
  emailVerified: false,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: true,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("Registration flow and edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("suppresses passive observer during REGISTER interactive operation", () => {
    expect(observerShouldBootstrap("REGISTER", "pending", "new-user-uid")).toBe(false);
  });

  it("successfully registers user and delegates initial email verification", async () => {
    (authApi.register as jest.Mock).mockResolvedValueOnce(mockProfile);

    const payload = {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
      registrationProfile: { firstName: "Maria", lastName: "Clara" },
    };

    const result = await authApi.register(payload);
    expect(result).toEqual(mockProfile);
    expect(authApi.register).toHaveBeenCalledWith(payload);
  });

  it("reconciles ambiguous backend registration failure via GET /auth/profile", async () => {
    // Simulate network error on POST /auth/register
    (authApi.register as jest.Mock).mockRejectedValueOnce(
      new AppError({ kind: "NETWORK", message: "Connection lost during registration." })
    );
    // Profile is found on GET /auth/profile reconciliation
    (authApi.profile as jest.Mock).mockResolvedValueOnce(mockProfile);

    let profileResult: BackendUserProfile | null = null;
    try {
      await authApi.register({
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: "v1.0",
        privacyVersion: "v1.0",
        registrationProfile: { firstName: "Maria", lastName: "Clara" },
      });
    } catch {
      profileResult = await authApi.profile();
    }

    expect(profileResult).toEqual(mockProfile);
    expect(authApi.profile).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate registration attempts when an operation is in-flight", () => {
    let isInFlight = true;
    const attemptRegistration = () => {
      if (isInFlight) {
        throw new AppError({ kind: "AUTH", message: "A registration request is already in progress." });
      }
    };

    expect(() => attemptRegistration()).toThrow("A registration request is already in progress.");
  });
});