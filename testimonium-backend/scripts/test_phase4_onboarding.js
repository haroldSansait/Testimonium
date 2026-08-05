import { AuthService } from "../services/AuthService.js";
import { normalizeAndConstructFullName } from "../utils/nameUtils.js";
import { isValidLegalVersion, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, LEGAL_EFFECTIVE_DATE } from "../config/legal.js";

async function runRegressionTests() {
  console.log("=== Phase 4.0.2 Onboarding Regression Test Suite ===");
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // Test 1: Legal metadata constants & version validation
  console.log("\n1. Legal Effective Date & Version Audit Metadata");
  assert(CURRENT_TERMS_VERSION === "v1.0", "Terms version is v1.0");
  assert(CURRENT_PRIVACY_VERSION === "v1.0", "Privacy version is v1.0");
  assert(Boolean(LEGAL_EFFECTIVE_DATE), "LEGAL_EFFECTIVE_DATE is defined");
  assert(isValidLegalVersion("v1.0", "v1.0") === true, "Valid legal version returns true");
  assert(isValidLegalVersion("v0.9", "v1.0") === false, "Outdated legal version returns false");

  // Test 2: Structured Name Field Validation & Normalization
  console.log("\n2. Structured Name Field Validation & Normalization");
  const normalized1 = normalizeAndConstructFullName({
    firstName: " Juan  ",
    middleName: "  De La ",
    lastName: " Cruz  ",
    suffix: " Jr. ",
  });
  assert(normalized1 === "Juan De La Cruz Jr.", `Normalized name 1: "${normalized1}"`);

  const normalized2 = normalizeAndConstructFullName({
    firstName: "Maria",
    middleName: "",
    lastName: "Santos",
    suffix: "",
  });
  assert(normalized2 === "Maria Santos", `Normalized name 2: "${normalized2}"`);

  let nameErrorThrown = false;
  try {
    normalizeAndConstructFullName({ firstName: "", middleName: "De", lastName: "", suffix: "" });
  } catch (err) {
    nameErrorThrown = true;
  }
  assert(nameErrorThrown, "Throws error when firstName or lastName is missing");

  // Test 3: AuthService Instantiation & Method Interfaces
  console.log("\n3. AuthService Method Verification");
  const authService = new AuthService();
  assert(typeof authService.getOrCreateApplicationUser === "function", "getOrCreateApplicationUser method exists");
  assert(typeof authService.recordLegalAcceptance === "function", "recordLegalAcceptance method exists");
  assert(typeof authService.validateLegalPayload === "function", "validateLegalPayload method exists");

  // Test 4: Legal Acceptance Validation Rules
  console.log("\n4. Legal Acceptance Payload Rules");
  let legalError = false;
  try {
    authService.validateLegalPayload({ termsAccepted: false, privacyAccepted: true });
  } catch (err) {
    legalError = err.code === "LEGAL_ACCEPTANCE_REQUIRED";
  }
  assert(legalError, "Requires both termsAccepted and privacyAccepted");

  // Test 5: Fallback & Registration Name Parsing in AuthService
  console.log("\n5. Registration Profile Name Construction");
  const testToken = { uid: "test-uid-123", email: "test.user@example.com", email_verified: true };
  const mockCreatedUserProfile = authService.toApplicationProfile({
    id: 999,
    firebaseUid: testToken.uid,
    email: testToken.email,
    fullName: normalizeAndConstructFullName({ firstName: "Pedro", lastName: "Penduko" }),
    isVerified: true,
    status: "ACTIVE",
    role: { roleName: "PARISHIONER" },
    parish: null,
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    termsVersion: "v1.0",
    privacyVersion: "v1.0",
  }, testToken);
  assert(mockCreatedUserProfile.fullName === "Pedro Penduko", "Constructed fullName persisted accurately in Application Profile");

  // Test 6: Phase 4.0.3 Centralized Email Verification Policy Matrix
  console.log("\n6. Email Verification Policy Matrix (Phase 4.0.3)");
  const { shouldRequireEmailVerification } = await import("../utils/emailVerificationPolicy.js");

  // Rule 1: Google provider always bypassed
  assert(
    shouldRequireEmailVerification({ role: "PARISHIONER", provider: "google.com", environment: "development" }) === false,
    "Google provider returns false for PARISHIONER in development"
  );
  assert(
    shouldRequireEmailVerification({ role: "SECRETARY", provider: "google.com", environment: "production" }) === false,
    "Google provider returns false for SECRETARY in production"
  );

  // Rule 2: Production environment always requires verification for email/password
  assert(
    shouldRequireEmailVerification({ role: "SECRETARY", provider: "password", environment: "production" }) === true,
    "Production env requires verification for SECRETARY"
  );
  assert(
    shouldRequireEmailVerification({ role: "SUPER_ADMIN", provider: "password", environment: "production" }) === true,
    "Production env requires verification for SUPER_ADMIN"
  );

  // Rule 3: Development environment always requires verification for PARISHIONER
  assert(
    shouldRequireEmailVerification({ role: "PARISHIONER", provider: "password", environment: "development" }) === true,
    "Development env requires verification for PARISHIONER"
  );

  // Rule 4: Staff roles in development follow env.adminEmailVerificationRequired setting
  const { env } = await import("../config/env.js");
  const expectedStaffResult = env.adminEmailVerificationRequired;
  assert(
    shouldRequireEmailVerification({ role: "SECRETARY", provider: "password", environment: "development" }) === expectedStaffResult,
    `Development SECRETARY verification matches env setting (${expectedStaffResult})`
  );
  assert(
    shouldRequireEmailVerification({ role: "PRIEST", provider: "password", environment: "development" }) === expectedStaffResult,
    `Development PRIEST verification matches env setting (${expectedStaffResult})`
  );
  assert(
    shouldRequireEmailVerification({ role: "DIOCESE_COORDINATOR", provider: "password", environment: "development" }) === expectedStaffResult,
    `Development DIOCESE_COORDINATOR verification matches env setting (${expectedStaffResult})`
  );
  assert(
    shouldRequireEmailVerification({ role: "SUPER_ADMIN", provider: "password", environment: "development" }) === expectedStaffResult,
    `Development SUPER_ADMIN verification matches env setting (${expectedStaffResult})`
  );

  // Summary
  console.log(`\n=== Test Results: ${passedCount}/${totalCount} Passed ===`);
  if (passedCount === totalCount) {
    console.log("All regression test assertions completed successfully!\n");
    process.exit(0);
  } else {
    console.error("Some regression tests failed.\n");
    process.exit(1);
  }
}

runRegressionTests().catch((err) => {
  console.error("Unhandled error in regression tests:", err);
  process.exit(1);
});
