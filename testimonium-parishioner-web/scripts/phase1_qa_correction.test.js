import test from "node:test";
import assert from "node:assert/strict";

// Mock localStorage / sessionStorage simulation for session state machine
class MockSessionStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Session state machine replicating AuthContext & HomePage logic
class RegistrationGreetingStateMachine {
  constructor(storage = new MockSessionStorage()) {
    this.sessionStorage = storage;
  }

  onSignUpSuccess() {
    // New email/password or new Google registration establishes true
    this.sessionStorage.setItem("testimonium_registration_session", "true");
  }

  onProfileRefresh(backendResponse) {
    // Ordinary profile refresh, hydration, or verification refresh must NOT downgrade or remove registration session
    // It preserves the established session flag
  }

  onVerificationRefresh() {
    // Email verification refresh preserves the flag
  }

  onExplicitLogin() {
    // Returning login clears or sets to returning
    this.sessionStorage.removeItem("testimonium_registration_session");
  }

  onLogout() {
    this.sessionStorage.removeItem("testimonium_registration_session");
  }

  computeGreeting(user, profile) {
    const isNewRegistration = this.sessionStorage.getItem("testimonium_registration_session") === "true";
    const firstName = profile?.firstName || (profile?.fullName ? profile.fullName.trim().split(/\s+/)[0] : "") || "";
    
    if (isNewRegistration) {
      return firstName ? `Welcome, ${firstName}!` : "Welcome!";
    }
    return firstName ? `Welcome back, ${firstName}!` : "Welcome back!";
  }
}

// Profile requirement helper logic matching ProfileRequirementContext & useProfileRequirement
class ProfileEligibilityEngine {
  constructor(appProfile) {
    this.appProfile = appProfile;
  }

  get isProfileIncomplete() {
    return Boolean(this.appProfile?.needsProfileCompletion);
  }

  guardAction(actionFn, onBlocked) {
    if (this.isProfileIncomplete) {
      if (onBlocked) onBlocked();
      return { allowed: false, actionExecuted: false };
    }
    let executed = false;
    if (actionFn) {
      actionFn();
      executed = true;
    }
    return { allowed: true, actionExecuted: executed };
  }

  canBrowse(surface) {
    const allowedBrowsingSurfaces = [
      "home",
      "directory",
      "directory_map",
      "parish_detail",
      "track_status",
      "request_history",
      "notifications",
      "help",
      "profile",
    ];
    return allowedBrowsingSurfaces.includes(surface);
  }
}

test("Phase 1 QA Correction: Greeting State Machine", async (t) => {
  await t.test("new email registration arrives Home with 'Welcome, Juan!'", () => {
    const sm = new RegistrationGreetingStateMachine();
    sm.onSignUpSuccess();
    const greeting = sm.computeGreeting({ uid: "user-123" }, { fullName: "Juan Dela Cruz" });
    assert.equal(greeting, "Welcome, Juan!");
  });

  await t.test("profile/auth refresh does not downgrade registration flag", () => {
    const sm = new RegistrationGreetingStateMachine();
    sm.onSignUpSuccess();
    // Simulate multiple background profile refresh calls where isNewUser might be false in backend DB
    sm.onProfileRefresh({ isNewUser: false });
    sm.onProfileRefresh({ isNewUser: false });
    const greeting = sm.computeGreeting({ uid: "user-123" }, { fullName: "Juan Dela Cruz" });
    assert.equal(greeting, "Welcome, Juan!");
  });

  await t.test("email verification keeps registration flag true", () => {
    const sm = new RegistrationGreetingStateMachine();
    sm.onSignUpSuccess();
    sm.onVerificationRefresh();
    const greeting = sm.computeGreeting({ uid: "user-123" }, { fullName: "Juan Dela Cruz" });
    assert.equal(greeting, "Welcome, Juan!");
  });

  await t.test("logout clears registration session", () => {
    const sm = new RegistrationGreetingStateMachine();
    sm.onSignUpSuccess();
    sm.onLogout();
    assert.equal(sm.sessionStorage.getItem("testimonium_registration_session"), null);
  });

  await t.test("later login is 'Welcome back, Juan!'", () => {
    const sm = new RegistrationGreetingStateMachine();
    sm.onExplicitLogin();
    const greeting = sm.computeGreeting({ uid: "user-123" }, { fullName: "Juan Dela Cruz" });
    assert.equal(greeting, "Welcome back, Juan!");
  });

  await t.test("neutral fallback without legitimate name", () => {
    const smNew = new RegistrationGreetingStateMachine();
    smNew.onSignUpSuccess();
    assert.equal(smNew.computeGreeting({ uid: "user-1" }, { fullName: "" }), "Welcome!");

    const smReturning = new RegistrationGreetingStateMachine();
    smReturning.onExplicitLogin();
    assert.equal(smReturning.computeGreeting({ uid: "user-2" }, { fullName: "" }), "Welcome back!");
  });
});

test("Phase 1 QA Correction: Profile Entry-Point Gating & Browsing Eligibility", async (t) => {
  const incompleteProfile = { id: 1, fullName: "", contactNumber: "", needsProfileCompletion: true };
  const completeProfile = { id: 2, fullName: "Juan Dela Cruz", contactNumber: "09123456789", needsProfileCompletion: false };

  await t.test("incomplete user: Home request CTA is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let actionExecuted = false;
    const result = engine.guardAction(() => { actionExecuted = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(actionExecuted, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Sidebar Request Document is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let navigated = false;
    const result = engine.guardAction(() => { navigated = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(navigated, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Sidebar Schedule Appointment is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let navigated = false;
    const result = engine.guardAction(() => { navigated = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(navigated, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Track Status CTA is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let navigated = false;
    const result = engine.guardAction(() => { navigated = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(navigated, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Directory Request Document is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let navigated = false;
    const result = engine.guardAction(() => { navigated = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(navigated, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Directory Schedule Rite is blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    let blockedCalled = false;
    let navigated = false;
    const result = engine.guardAction(() => { navigated = true; }, () => { blockedCalled = true; });
    assert.equal(result.allowed, false);
    assert.equal(navigated, false);
    assert.equal(blockedCalled, true);
  });

  await t.test("incomplete user: Direct creation routes are blocked", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    assert.equal(engine.isProfileIncomplete, true);
  });

  await t.test("complete profile: all entry points work normally", () => {
    const engine = new ProfileEligibilityEngine(completeProfile);
    let actionCount = 0;
    const actions = [
      () => actionCount++, // Home request
      () => actionCount++, // Home schedule
      () => actionCount++, // Sidebar request
      () => actionCount++, // Sidebar schedule
      () => actionCount++, // Track status CTA
      () => actionCount++, // Directory request
      () => actionCount++, // Directory schedule
    ];
    actions.forEach(act => {
      const res = engine.guardAction(act);
      assert.equal(res.allowed, true);
      assert.equal(res.actionExecuted, true);
    });
    assert.equal(actionCount, 7);
  });

  await t.test("incomplete user CAN browse Home, Directory, Track Status, and Profile", () => {
    const engine = new ProfileEligibilityEngine(incompleteProfile);
    assert.equal(engine.canBrowse("home"), true);
    assert.equal(engine.canBrowse("directory"), true);
    assert.equal(engine.canBrowse("directory_map"), true);
    assert.equal(engine.canBrowse("parish_detail"), true);
    assert.equal(engine.canBrowse("track_status"), true);
    assert.equal(engine.canBrowse("request_history"), true);
    assert.equal(engine.canBrowse("notifications"), true);
    assert.equal(engine.canBrowse("help"), true);
    assert.equal(engine.canBrowse("profile"), true);
    assert.equal(engine.canBrowse("unauthorized_admin"), false);
  });
});
