import { AuthService } from "../services/AuthService.js";
import { normalizeAndConstructFullName } from "../utils/nameUtils.js";
import { isValidLegalVersion, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, LEGAL_EFFECTIVE_DATE } from "../config/legal.js";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

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

  const { env } = await import("../config/env.js");
  const { login } = await import("../controllers/AuthController.js");
  const { AuditLogService } = await import("../services/AuditLogService.js");
  const staffRoles = ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR", "SUPER_ADMIN"];
  const originalSetting = env.adminEmailVerificationRequired;
  const originalEnvironment = env.nodeEnv;
  const originalAuditLog = AuditLogService.log;

  // Exercise the actual startup reporter without starting the server or its workers.
  const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const reporterSource = serverSource.match(/export const logAuthenticationPolicy = \(\) => \{[\s\S]*?\n\};/)?.[0];
  assert(Boolean(reporterSource), "Startup authentication policy reporter exists");

  try {
    // Keep controller tests local: no audit database writes or Firebase calls.
    AuditLogService.log = async () => {};
    for (const required of [false, true]) {
      env.adminEmailVerificationRequired = required;
      for (const environment of ["development", "production"]) {
        env.nodeEnv = environment;
        for (const role of [...staffRoles, "PARISHIONER"]) {
          const expected = role === "PARISHIONER" || required;
          for (const roleValue of [role, { roleName: role }]) {
            assert(
              shouldRequireEmailVerification({ role: roleValue, provider: "password", environment }) === expected,
              `${environment} ${role} policy=${required}, role ${typeof roleValue}: required=${expected}`
            );
          }
          for (const provider of ["password", "google.com"]) {
            assert(
              shouldRequireEmailVerification({ role, provider, environment }) === (provider === "password" && expected),
              `${environment} ${role} ${provider} policy=${required}`
            );
            for (const verified of [false, true]) {
              let status;
              let body;
              let error;
              await login({
                firebaseUser: { email_verified: verified, firebase: { sign_in_provider: provider } },
                user: { id: 999, role },
                body: {},
              }, {
                status(value) { status = value; return this; },
                json(value) { body = value; return this; },
              }, (value) => { error = value; });
              const rejected = !verified && provider === "password" && expected;
              assert(
                !error && status === (rejected ? 403 : 200) &&
                  (rejected ? body?.code === "EMAIL_NOT_VERIFIED" : body?.success === true),
                `${environment} login ${role} ${provider} verified=${verified} policy=${required}: ${rejected ? "rejected" : "accepted"}`
              );
            }
          }
        }
        const lines = [];
        const warnings = [];
        let report;
        runInNewContext(`${reporterSource.replace("export ", "")}\nlogAuthenticationPolicy();`, {
          env,
          console: { log: (line) => lines.push(line) },
          logger: { warn: (message) => warnings.push(message), info: (data) => { report = data; } },
        });
        const state = required ? "REQUIRED" : "DISABLED";
        assert(
          lines.includes(`Staff Verification       : ${state}`) &&
            report?.staffVerification === state && report?.parishionerVerification === "REQUIRED" &&
            report?.environment === environment.toUpperCase() && report?.providerOverride === "Google Always Verified",
          `${environment} startup console and structured logs report policy=${required}`
        );
        assert(
          warnings.length === (environment === "production" && !required ? 1 : 0) &&
            warnings.every((message) => message.includes("Staff email/password verification is disabled in production") &&
              message.includes("Parishioner email/password verification remains required")),
          `${environment} startup warning accurately reports policy=${required}`
        );
      }
      for (const role of [undefined, "UNKNOWN", "PARISHIONER"]) {
        assert(
          shouldRequireEmailVerification({ role, environment: "production" }) === true,
          `Production ${role} cannot use staff exception with policy=${required}`
        );
      }
    }
  } finally {
    env.adminEmailVerificationRequired = originalSetting;
    env.nodeEnv = originalEnvironment;
    AuditLogService.log = originalAuditLog;
  }

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
