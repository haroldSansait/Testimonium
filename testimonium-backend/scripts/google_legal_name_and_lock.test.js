import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../services/AuthService.js";
import { UserService } from "../services/UserService.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AuditLogService } from "../services/AuditLogService.js";
import {
  GovernmentIdVerificationService,
  defaultGovernmentIdVerificationService as verification,
} from "../services/GovernmentIdVerificationService.js";
import { register, updateProfile } from "../controllers/AuthController.js";
import { needsGoogleLegalNameConfirmation } from "../utils/googleLegalNameConfirmation.js";

const policies = {
  termsOfService: { version: "v1" },
  privacyPolicy: { version: "v1" },
};
const legal = {
  termsAccepted: true,
  privacyAccepted: true,
  termsVersion: "v1",
  privacyVersion: "v1",
};

test("eligibility requires the explicit new-registration marker and excludes staff, confirmed and database VERIFIED accounts", () => {
  const marker = { action: "Google New User", metadata: '{"legalNameConfirmationRequired":true}' };
  for (const activityLogs of [[], [{ action: "Google New User", metadata: null }], [{ action: "JIT User Created", metadata: marker.metadata }]]) {
    assert.equal(needsGoogleLegalNameConfirmation(makeUser({ activityLogs })), false);
  }
  assert.equal(needsGoogleLegalNameConfirmation(makeUser({ activityLogs: [marker] })), true);
  for (const overrides of [
    { role: { roleName: "SECRETARY" } },
    { firstName: "Juan Miguel", lastName: "Dela Cruz" },
    { activityLogs: [marker, { action: "Profile Updated", metadata: '{"legalNameConfirmed":true}' }] },
    { governmentIdVerification: { status: "VERIFIED", expiresAt: new Date("2000-01-01") } },
  ]) {
    assert.equal(needsGoogleLegalNameConfirmation(makeUser({ activityLogs: [marker], ...overrides })), false);
  }
});

function makeUser(overrides = {}) {
  return {
    id: 40,
    firebaseUid: "uid-40",
    email: "user40@example.com",
    fullName: "Juan Miguel Santos Dela Cruz Jr.",
    firstName: null,
    middleName: null,
    lastName: null,
    suffix: null,
    contactNumber: "09171234567",
    address: "San Carlos City",
    isVerified: true,
    status: "ACTIVE",
    role: { roleName: "PARISHIONER" },
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    termsVersion: "v1",
    privacyVersion: "v1",
    governmentIdVerification: null,
    activityLogs: [],
    ...overrides,
  };
}

async function invokeController(handler, user, body = {}) {
  let statusCode = 200;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return data;
    },
  };
  await handler(
    { user, body, firebaseUser: { uid: user.firebaseUid, email_verified: true } },
    res,
    (err) => {
      if (err) throw err;
    }
  );
  return { statusCode, payload };
}

test("1 & 2. Existing Google and password accounts with NULL structured names do not get confirmation prompt and retain verified status", async () => {
  const existingUnverifiedGoogle = makeUser({
    activityLogs: [{ action: "Google New User", metadata: null }],
    governmentIdVerification: null,
  });
  const existingVerifiedGoogle = makeUser({
    id: 41,
    firebaseUid: "uid-41",
    activityLogs: [{ action: "Google New User", metadata: null }],
    governmentIdVerification: { status: "VERIFIED", verifiedAt: new Date() },
  });

  const service = new AuthService(
    {
      findByFirebaseUid: async (uid) =>
        uid === "uid-41" ? existingVerifiedGoogle : existingUnverifiedGoogle,
    },
    {},
    { getCurrentPolicies: async () => policies }
  );

  const p1 = await service.getOrCreateApplicationUser({
    uid: "uid-40",
    email: "user40@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
  });
  assert.equal(p1.needsLegalNameConfirmation, false);
  assert.equal(p1.firstName, null);

  const p2 = await service.getOrCreateApplicationUser({
    uid: "uid-41",
    email: "user40@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
  });
  assert.equal(p2.needsLegalNameConfirmation, false);
  assert.equal(p2.isGovernmentIdVerified, true);
});

test("3 & 4. New email/password registration skips confirmation; new Google registration sets needsLegalNameConfirmation and survives re-login", async () => {
  const logsWritten = [];
  let createdRow = null;

  const service = new AuthService(
    {
      findByFirebaseUid: async () => (createdRow ? { ...createdRow, activityLogs: logsWritten } : null),
      findByEmail: async () => null,
    },
    { findByName: async () => ({ id: 1, roleName: "PARISHIONER" }) },
    {
      getCurrentPolicies: async () => policies,
      withCurrentPoliciesForAcceptance: async (cb) =>
        cb(
          {
            user: {
              create: async ({ data }) => {
                createdRow = { ...makeUser(), ...data };
                return createdRow;
              },
            },
          },
          policies
        ),
    },
    {
      logOrThrow: async (_uid, action, _tx, _sys, extra) => {
        logsWritten.push({
          action,
          metadata: extra?.metadata ? JSON.stringify(extra.metadata) : null,
        });
      },
    }
  );

  // New Google user without structured parts
  const googleProfile = await service.getOrCreateApplicationUser(
    {
      uid: "google-new-1",
      email: "googlenew@example.com",
      email_verified: true,
      name: "Maria Clara Reyes",
      firebase: { sign_in_provider: "google.com" },
    },
    legal
  );
  assert.equal(googleProfile.fullName, "Maria Clara Reyes");
  assert.equal(googleProfile.firstName, null);
  assert.equal(googleProfile.needsLegalNameConfirmation, true);

  // Subsequent login (simulates logout/login or refresh)
  const reloginProfile = await service.getOrCreateApplicationUser({
    uid: "google-new-1",
    email: "googlenew@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
  });
  assert.equal(reloginProfile.needsLegalNameConfirmation, true);

  // New email/password user with structured parts
  createdRow = null;
  logsWritten.length = 0;
  const emailProfile = await service.getOrCreateApplicationUser(
    {
      uid: "pw-new-1",
      email: "pwnew@example.com",
      email_verified: false,
      firebase: { sign_in_provider: "password" },
    },
    legal,
    { firstName: "Jose", lastName: "Rizal" }
  );
  assert.equal(emailProfile.fullName, "Jose Rizal");
  assert.equal(emailProfile.firstName, "Jose");
  assert.equal(emailProfile.needsLegalNameConfirmation, false);
});

test("5 & 6. New Google user can confirm (Option A with normalization, rejecting mismatch) or correct (Option B)", async (t) => {
  const stored = makeUser({
    fullName: "MARIA CLARA REYES",
    activityLogs: [
      {
        action: "Google New User",
        metadata: JSON.stringify({ legalNameConfirmationRequired: true }),
      },
    ],
  });
  const auditEntries = [];

  t.mock.method(UserRepository.prototype, "findById", async () => ({ ...stored }));
  t.mock.method(UserRepository.prototype, "update", async (_id, data) => {
    Object.assign(stored, data);
    return { ...stored };
  });
  t.mock.method(AuthService.prototype, "toCurrentApplicationProfile", async function (user, token) {
    return this.toApplicationProfile(user, token, false, { termsVersion: "v1", privacyVersion: "v1" });
  });
  t.mock.method(verification, "withUserVerificationLease", async (_id, cb) => cb());
  t.mock.method(AuditLogService, "log", async (_uid, action, _tx, _sys, extra) => {
    auditEntries.push({ action, metadata: extra?.metadata });
  });

  // Option A mismatch rejected
  await assert.rejects(
    () =>
      invokeController(updateProfile, { ...stored }, {
        firstName: "Ana",
        lastName: "Santos",
        legalNameConfirmationAction: "confirm",
      }),
    { statusCode: 400, code: "LEGAL_NAME_CONFIRMATION_MISMATCH" }
  );
  assert.equal(stored.firstName, null);

  // Option A matching (allowing case normalization) succeeds
  const confirmRes = await invokeController(updateProfile, { ...stored }, {
    firstName: "Maria",
    middleName: "Clara",
    lastName: "Reyes",
    suffix: "",
    legalNameConfirmationAction: "confirm",
  });
  assert.equal(confirmRes.statusCode, 200);
  assert.equal(confirmRes.payload.data.fullName, "MARIA CLARA REYES");
  assert.equal(confirmRes.payload.data.firstName, "Maria");
  assert.equal(confirmRes.payload.data.middleName, "Clara");
  assert.equal(confirmRes.payload.data.lastName, "Reyes");
  assert.equal(confirmRes.payload.data.suffix, null);
  assert.equal(confirmRes.payload.data.needsLegalNameConfirmation, false);
  assert.ok(auditEntries.some((e) => e.action === "Profile Updated" && e.metadata?.legalNameConfirmed === true));

  // Option B on another new Google user updates fullName and components
  stored.firstName = null;
  stored.middleName = null;
  stored.lastName = null;
  stored.suffix = null;
  stored.fullName = "Google Nickname";
  const correctRes = await invokeController(updateProfile, { ...stored }, {
    firstName: "Juan Miguel",
    middleName: "Santos",
    lastName: "Dela Cruz",
    suffix: "Jr.",
    legalNameConfirmationAction: "correct",
  });
  assert.equal(correctRes.statusCode, 200);
  assert.equal(correctRes.payload.data.fullName, "Juan Miguel Santos Dela Cruz Jr.");
  assert.equal(correctRes.payload.data.needsLegalNameConfirmation, false);
});

test("8. Only new Google users requiring confirmation are blocked from calling Government ID verification API", async () => {
  const newGoogleUnconfirmed = makeUser({
    activityLogs: [
      {
        action: "Google New User",
        metadata: JSON.stringify({ legalNameConfirmationRequired: true }),
      },
    ],
  });
  const legacyNullGoogle = makeUser({
    activityLogs: [{ action: "Google New User", metadata: null }],
  });

  let activeUser = newGoogleUnconfirmed;
  const govService = new GovernmentIdVerificationService({
    prismaClient: {
      user: { findUnique: async () => activeUser },
      governmentIdVerification: {
        findUnique: async () => null,
        upsert: async () => ({}),
      },
    },
    leaseService: { acquireLease: async () => true, releaseLease: async () => true },
    identityBucketName: "identity-private-test",
  });

  await assert.rejects(
    () => govService.submitForVerification(40, Buffer.from("a"), Buffer.from("b")),
    { statusCode: 403, code: "LEGAL_NAME_CONFIRMATION_REQUIRED" }
  );

  // Legacy account with NULL structured names is NOT blocked by legal-name confirmation gate
  activeUser = legacyNullGoogle;
  const legacyResult = await govService.submitForVerification(40, null, null);
  assert.equal(legacyResult.status, "REJECTED");
  assert.equal(legacyResult.rejectionReason, "FRONT_BACK_INCOMPLETE");

  // Saved components clear the prerequisite on the next authoritative read.
  activeUser = { ...newGoogleUnconfirmed, firstName: "Juan Miguel", lastName: "Dela Cruz" };
  const confirmedResult = await govService.submitForVerification(40, null, null);
  assert.equal(confirmedResult.rejectionReason, "FRONT_BACK_INCOMPLETE");

  // Password accounts and staff never encounter the Google prerequisite.
  for (const user of [makeUser(), { ...newGoogleUnconfirmed, role: { roleName: "SECRETARY" } }]) {
    activeUser = user;
    const result = await govService.submitForVerification(40, null, null);
    assert.equal(result.rejectionReason, "FRONT_BACK_INCOMPLETE");
  }
});

for (const expiresAt of [null, new Date("2000-01-01")]) {
test(`Verified parishioners lock all legal-name fields and allow unrelated edits (expiry: ${expiresAt})`, async (t) => {
  const stored = makeUser({
    fullName: "Juan Miguel Santos Dela Cruz Jr.",
    firstName: "Juan Miguel",
    middleName: "Santos",
    lastName: "Dela Cruz",
    suffix: "Jr.",
    governmentIdVerification: {
      status: "VERIFIED",
      expiresAt,
      verifiedAt: new Date(),
      frontObjectKey: "front.jpg",
      backObjectKey: "back.jpg",
    },
  });

  const leaseEvents = [];
  let invalidateCalled = false;

  t.mock.method(UserRepository.prototype, "findById", async () => ({ ...stored }));
  t.mock.method(UserRepository.prototype, "update", async (_id, data) => {
    Object.assign(stored, data);
    return { ...stored };
  });
  t.mock.method(AuthService.prototype, "toCurrentApplicationProfile", async function (user, token) {
    return this.toApplicationProfile(user, token, false, { termsVersion: "v1", privacyVersion: "v1" });
  });
  t.mock.method(verification, "withUserVerificationLease", async (_id, cb) => {
    leaseEvents.push("acquire");
    try {
      return await cb();
    } finally {
      leaseEvents.push("release");
    }
  });
  t.mock.method(verification, "invalidateVerification", async () => {
    invalidateCalled = true;
  });
  t.mock.method(AuditLogService, "log", async () => {});

  // Prohibited changes via updateProfile (including structured-only boundary shift and fullName)
  for (const badBody of [
    { fullName: "Pedro Santos Dela Cruz Jr." },
    { firstName: "Pedro", lastName: "Dela Cruz" },
    { firstName: "Juan", middleName: "Miguel Santos", lastName: "Dela Cruz", suffix: "Jr." },
    { middleName: "Reyes" },
    { suffix: "III" },
  ]) {
    // Even if req.user is STALE (unverified), authoritative DB check inside lease rejects it!
    const staleReqUser = { ...stored, governmentIdVerification: null };
    await assert.rejects(
      () => invokeController(updateProfile, staleReqUser, badBody),
      { statusCode: 403, code: "LEGAL_NAME_LOCKED" }
    );
  }

  // Prohibited change via register endpoint
  await assert.rejects(
    () =>
      invokeController(register, { ...stored }, {
        ...legal,
        firstName: "Pedro",
        lastName: "Dela Cruz",
      }),
    { statusCode: 403, code: "LEGAL_NAME_LOCKED" }
  );

  // Prohibited change via UserService.editUser (coordinator path)
  const userService = new UserService();
  await assert.rejects(
    () => userService.editUser(40, { name: "Pedro Dela Cruz" }, 1),
    { statusCode: 403, code: "LEGAL_NAME_LOCKED" }
  );

  assert.equal(invalidateCalled, false);
  assert.equal(stored.governmentIdVerification.status, "VERIFIED");
  assert.equal(stored.governmentIdVerification.frontObjectKey, "front.jpg");
  assert.ok(leaseEvents.includes("acquire") && leaseEvents.includes("release"));

  // Unchanged name + unrelated profile edits succeed
  const okRes = await invokeController(updateProfile, { ...stored }, {
    firstName: "Juan Miguel",
    middleName: "Santos",
    lastName: "Dela Cruz",
    suffix: "Jr.",
    contactNumber: "09998887777",
    address: "New Address",
    emailNotificationsEnabled: false,
  });
  assert.equal(okRes.statusCode, 200);
  assert.equal(okRes.payload.data.contactNumber, "09998887777");
  assert.equal(okRes.payload.data.address, "New Address");
  assert.equal(okRes.payload.data.emailNotificationsEnabled, false);
  assert.equal(okRes.payload.data.isGovernmentIdVerified, !expiresAt);
});
}

test("unchanged structured names preserve canonical formatting on all verified name-update paths", async (t) => {
  const stored = makeUser({
    fullName: "JUAN MIGUEL SANTOS DELA CRUZ JR.",
    firstName: "Juan Miguel", middleName: "Santos", lastName: "Dela Cruz", suffix: "Jr.",
    governmentIdVerification: { status: "VERIFIED", expiresAt: new Date("2000-01-01") },
  });
  const original = structuredClone(stored);
  t.mock.method(UserRepository.prototype, "findById", async () => ({ ...stored }));
  t.mock.method(UserRepository.prototype, "update", async (_id, data) => {
    Object.assign(stored, data);
    return { ...stored };
  });
  t.mock.method(AuthService.prototype, "toCurrentApplicationProfile", async user => user);
  t.mock.method(verification, "withUserVerificationLease", async (_id, cb) => cb());
  t.mock.method(AuditLogService, "log", async () => {});
  const parts = { firstName: stored.firstName, middleName: stored.middleName, lastName: stored.lastName, suffix: stored.suffix };
  await invokeController(updateProfile, stored, parts);
  await invokeController(register, stored, { ...legal, ...parts });
  await new UserService().editUser(stored.id, parts, 1);
  assert.deepEqual(stored, original);
});

test("latest database state is re-read after lease acquisition for profile, register and admin updates", async (t) => {
  const stored = makeUser();
  let leased = false;
  let writes = 0;
  t.mock.method(UserRepository.prototype, "findById", async () => ({
    ...stored,
    governmentIdVerification: leased ? { status: "VERIFIED", expiresAt: new Date("2000-01-01") } : null,
  }));
  t.mock.method(UserRepository.prototype, "update", async () => { writes++; return stored; });
  t.mock.method(verification, "withUserVerificationLease", async (_id, cb) => {
    leased = true;
    try { return await cb(); } finally { leased = false; }
  });
  for (const operation of [
    () => invokeController(updateProfile, stored, { fullName: "Changed Name" }),
    () => invokeController(register, stored, { ...legal, firstName: "Changed", lastName: "Name" }),
    () => new UserService().editUser(stored.id, { name: "Changed Name" }, 1),
  ]) {
    await assert.rejects(operation, { statusCode: 403, code: "LEGAL_NAME_LOCKED" });
  }
  assert.equal(writes, 0);
});

test("confirmation and verification share the same per-user lease in both directions", async (t) => {
  const stored = makeUser({ activityLogs: [{ action: "Google New User", metadata: '{"legalNameConfirmationRequired":true}' }] });
  const leases = new Set();
  const leaseService = {
    acquireLease: async key => { if (leases.has(key)) return false; leases.add(key); return true; },
    releaseLease: async key => { leases.delete(key); },
  };
  let releaseRead;
  let readStarted;
  const started = new Promise(resolve => { readStarted = resolve; });
  const read = new Promise(resolve => { releaseRead = resolve; });
  const service = new GovernmentIdVerificationService({
    prismaClient: { user: { findUnique: async () => { readStarted(); await read; return stored; } } },
    leaseService,
    identityBucketName: "identity-private-test",
  });
  t.mock.method(verification, "withUserVerificationLease", (id, cb) => service.withUserVerificationLease(id, cb));
  const submission = service.submitForVerification(stored.id, null, null);
  await started;
  await assert.rejects(() => invokeController(updateProfile, stored, {
    firstName: "Juan", lastName: "Cruz", legalNameConfirmationAction: "correct",
  }), { code: "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS" });
  releaseRead();
  await assert.rejects(() => submission, { code: "LEGAL_NAME_CONFIRMATION_REQUIRED" });
  await service.withUserVerificationLease(stored.id, async () => {
    await assert.rejects(() => service.submitForVerification(stored.id, null, null), {
      code: "GOVERNMENT_ID_VERIFICATION_IN_PROGRESS",
    });
  });
  assert.equal(leases.size, 0);
});

test("17. Staff account editing via UserService.editUser remains unaffected", async (t) => {
  const staffUser = makeUser({
    id: 55,
    roleId: 2,
    role: { roleName: "SECRETARY" },
    parishId: 1,
    fullName: "Old Staff Name",
  });
  t.mock.method(UserRepository.prototype, "findById", async () => ({ ...staffUser }));
  t.mock.method(UserRepository.prototype, "update", async (_id, data) => {
    Object.assign(staffUser, data);
    return { ...staffUser };
  });
  t.mock.method(AuditLogService, "log", async () => {});

  const userService = new UserService(undefined, undefined, {
    updateUser: async () => ({}),
  });
  const dto = await userService.editUser(55, { name: "Updated Staff Name" }, 1);
  assert.equal(dto.name, "Updated Staff Name");
});
