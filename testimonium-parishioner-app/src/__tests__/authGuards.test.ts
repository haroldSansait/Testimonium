import { evaluateBootstrapState } from "@/types/auth";
import { isCurrentAuthOperation, observerShouldBootstrap } from "@/services/auth/guards";

const profile = {
  id: 1,
  firebaseUid: "uid",
  email: "x@example.com",
  fullName: "Juan Dela Cruz",
  isVerified: true,
  emailVerified: true,
  termsAccepted: true,
  privacyAccepted: true,
  needsProfileCompletion: false,
  status: "ACTIVE",
  role: "PARISHIONER",
};

describe("auth bootstrap guards", () => {
  it("suppresses passive profile restore during interactive ownership", () => {
    expect(observerShouldBootstrap("REGISTER", null, "uid")).toBe(false);
    expect(observerShouldBootstrap("LOGIN", null, "uid")).toBe(false);
    expect(observerShouldBootstrap("GOOGLE_LOGIN", null, "uid")).toBe(false);
    expect(observerShouldBootstrap(null, "uid", "uid")).toBe(false);
    expect(observerShouldBootstrap(null, null, "uid")).toBe(true);
  });

  it("rejects stale user operations after generation changes", () => {
    expect(isCurrentAuthOperation(3, "user-a", 4, "user-b")).toBe(false);
    expect(isCurrentAuthOperation(4, "user-b", 4, "user-b")).toBe(true);
  });

  it("evaluates backend onboarding gates accurately in order", () => {
    // Non-parishioner role -> SESSION_ERROR
    expect(evaluateBootstrapState({ ...profile, role: "SECRETARY" }, true)).toBe("SESSION_ERROR");
    // Inactive status -> SESSION_ERROR
    expect(evaluateBootstrapState({ ...profile, status: "INACTIVE" }, true)).toBe("SESSION_ERROR");
    // Unverified email -> EMAIL_VERIFICATION_REQUIRED
    expect(evaluateBootstrapState(profile, false)).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(evaluateBootstrapState({ ...profile, emailVerified: false }, true)).toBe("EMAIL_VERIFICATION_REQUIRED");
    // Missing legal acceptance -> LEGAL_REQUIRED
    expect(evaluateBootstrapState({ ...profile, termsAccepted: false }, true)).toBe("LEGAL_REQUIRED");
    expect(evaluateBootstrapState({ ...profile, privacyAccepted: false }, true)).toBe("LEGAL_REQUIRED");
    // Needs profile completion -> PROFILE_COMPLETION_REQUIRED
    expect(evaluateBootstrapState({ ...profile, needsProfileCompletion: true }, true)).toBe("PROFILE_COMPLETION_REQUIRED");
    // All satisfied -> AUTHENTICATED_READY
    expect(evaluateBootstrapState(profile, true)).toBe("AUTHENTICATED_READY");
  });
});