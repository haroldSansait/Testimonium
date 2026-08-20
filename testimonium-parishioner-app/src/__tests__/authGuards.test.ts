import { evaluateBootstrapState } from "@/types/auth";
import { isCurrentAuthOperation, observerShouldBootstrap } from "@/services/auth/guards";
const profile = { id: 1, firebaseUid: "uid", email: "x@example.com", fullName: "Name", isVerified: true, emailVerified: true, termsAccepted: true, privacyAccepted: true, needsProfileCompletion: false, status: "ACTIVE", role: "PARISHIONER" };
describe("auth bootstrap guards", () => {
  it("suppresses passive profile restore during interactive ownership", () => expect(observerShouldBootstrap("uid", "uid")).toBe(false));
  it("rejects stale user operations after generation changes", () => expect(isCurrentAuthOperation(3, "user-a", 4, "user-b")).toBe(false));
  it("evaluates backend onboarding gates", () => { expect(evaluateBootstrapState({ ...profile, needsProfileCompletion: true }, true)).toBe("PROFILE_COMPLETION_REQUIRED"); expect(evaluateBootstrapState(profile, true)).toBe("AUTHENTICATED_READY"); });
});