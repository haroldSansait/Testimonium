import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prisma } from '../config/db.js';
import { AuthService } from '../services/AuthService.js';
import { UserService } from '../services/UserService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { defaultGovernmentIdVerificationService as verification } from '../services/GovernmentIdVerificationService.js';
import { getProfile, register, updateProfile } from '../controllers/AuthController.js';
import { resolveUserNameUpdate, buildApplicantName } from '../utils/nameUtils.js';
import { compareSelfRegistrantName, SELF_NAME_MATCH } from '../utils/selfRegistrantNameMatcher.js';

const parts = { firstName: 'Juan Miguel', middleName: 'Santos', lastName: 'Dela Cruz', suffix: 'Jr.' };
const fullName = 'Juan Miguel Santos Dela Cruz Jr.';
const policies = { termsOfService: { version: 'v1' }, privacyPolicy: { version: 'v1' } };
const legal = { termsAccepted: true, privacyAccepted: true, termsVersion: 'v1', privacyVersion: 'v1' };
const legacyUser = () => ({
  id: 12, firebaseUid: 'uid-12', email: 'fixture@example.com', fullName,
  firstName: null, middleName: null, lastName: null, suffix: null,
  isVerified: true, contactNumber: '09123456789', status: 'ACTIVE',
  role: { roleName: 'PARISHIONER' }, termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
  termsVersion: 'v1', privacyVersion: 'v1',
  governmentIdVerification: { status: 'VERIFIED', verifiedAt: new Date() },
});

async function invoke(handler, user, body = {}) {
  let response;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(value) { response = value; return value; } };
  await handler({ user, body, firebaseUser: { uid: user.firebaseUid, email_verified: true } }, res, error => { throw error; });
  return response.data;
}

function profileFixture(t, initial = legacyUser()) {
  const stored = initial;
  const writes = [];
  const invalidations = [];
  t.mock.method(UserRepository.prototype, 'findById', async id => {
    assert.equal(id, stored.id);
    return { ...stored };
  });
  t.mock.method(UserRepository.prototype, 'update', async (id, data) => {
    assert.equal(id, stored.id);
    writes.push(data);
    Object.assign(stored, data);
    return { ...stored };
  });
  t.mock.method(AuthService.prototype, 'toCurrentApplicationProfile', async function (user, token) {
    return this.toApplicationProfile(user, token, false, { termsVersion: 'v1', privacyVersion: 'v1' });
  });
  t.mock.method(verification, 'withUserVerificationLease', async (id, callback) => callback());
  t.mock.method(verification, 'invalidateVerification', async id => {
    invalidations.push(id);
    stored.governmentIdVerification = { status: 'NOT_SUBMITTED' };
  });
  t.mock.method(AuditLogService, 'log', async () => {});
  return { stored, writes, invalidations };
}

test('migration only adds four nullable columns and leaves all stored rows untouched', () => {
  const sql = readFileSync(new URL('../prisma/migrations/20261112090000_add_user_structured_names/migration.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '').trim();
  assert.equal(sql, 'ALTER TABLE "users"\nADD COLUMN "first_name" VARCHAR(150),\nADD COLUMN "middle_name" VARCHAR(150),\nADD COLUMN "last_name" VARCHAR(150),\nADD COLUMN "suffix" VARCHAR(150);');
});

test('canonical components preserve compound names, optional values and explicit partial updates', () => {
  assert.deepEqual(resolveUserNameUpdate({ ...parts, firstName: ' Juan   Miguel ' }), { fullName, ...parts });
  assert.deepEqual(resolveUserNameUpdate({ firstName: 'Juan Miguel', lastName: 'Dela Cruz' }), {
    fullName: 'Juan Miguel Dela Cruz', firstName: 'Juan Miguel', middleName: null, lastName: 'Dela Cruz', suffix: null,
  });
  assert.deepEqual(resolveUserNameUpdate({ middleName: null }, { ...parts, fullName }), {
    fullName: 'Juan Miguel Dela Cruz Jr.', ...parts, middleName: null,
  });
  assert.throws(() => resolveUserNameUpdate({ firstName: 'Juan' }, legacyUser()), { code: 'INVALID_NAME_FIELDS' });
  assert.deepEqual(resolveUserNameUpdate({ contactNumber: '09123456789' }, legacyUser()), {});
});

for (const provider of ['password', 'google.com']) {
  test(`${provider} registration persists supplied parts with the canonical full name`, async () => {
    let created;
    const repository = { findByFirebaseUid: async () => null, findByEmail: async () => null };
    const service = new AuthService(repository, { findByName: async () => ({ id: 1 }) }, {
      withCurrentPoliciesForAcceptance: async callback => callback({ user: { create: async ({ data }) => {
        created = data;
        return { ...legacyUser(), ...data };
      } } }, policies),
    }, { logOrThrow: async () => {} });
    const profile = await service.getOrCreateApplicationUser({ uid: 'new-uid', email: 'new@example.com', email_verified: true, firebase: { sign_in_provider: provider } }, legal, parts);
    for (const [key, value] of Object.entries(parts)) {
      assert.equal(created[key], value);
      assert.equal(profile[key], value);
    }
    assert.equal(created.fullName, fullName);
    assert.equal(profile.firebaseUid, 'new-uid');
  });
}

test('Google combined display name remains fullName only, without inferred components', async () => {
  let created;
  const service = new AuthService({ findByFirebaseUid: async () => null, findByEmail: async () => null }, {
    findByName: async () => ({ id: 1 }),
  }, {
    withCurrentPoliciesForAcceptance: async callback => callback({ user: { create: async ({ data }) => {
      created = data;
      return { ...legacyUser(), ...data };
    } } }, policies),
  }, { logOrThrow: async () => {} });
  const profile = await service.getOrCreateApplicationUser({ uid: 'google-uid', email: 'google@example.com', name: fullName, firebase: { sign_in_provider: 'google.com' } }, legal);
  assert.equal(created.fullName, fullName);
  for (const field of Object.keys(parts)) {
    assert.equal(created[field], undefined);
    assert.equal(profile[field], null);
  }
});

test('existing Google account keeps its identity, role, legal name and verified ID with no new onboarding', async () => {
  const stored = legacyUser();
  const service = new AuthService({ findByFirebaseUid: async () => stored }, {}, { getCurrentPolicies: async () => policies });
  const profile = await service.getOrCreateApplicationUser({ uid: stored.firebaseUid, email: stored.email, email_verified: true, name: 'Changed Google Display Name', firebase: { sign_in_provider: 'google.com' } });
  assert.equal(profile.id, stored.id);
  assert.equal(profile.fullName, fullName);
  assert.equal(profile.role, 'PARISHIONER');
  assert.equal(profile.isGovernmentIdVerified, true);
  assert.equal(profile.needsProfileCompletion, false);
  assert.equal(profile.isNewUser, false);
  assert.equal(profile.firstName, null);
});

for (const handler of [register, updateProfile]) {
  test(`${handler.name} saves components for unverified users without disturbing verification`, async t => {
    const f = profileFixture(t, { ...legacyUser(), governmentIdVerification: { status: 'NOT_SUBMITTED' } });
    const profile = await invoke(handler, { ...f.stored }, { ...legal, ...parts });
    assert.deepEqual(f.writes[0], { fullName, ...parts });
    assert.equal(profile.isGovernmentIdVerified, false);
    assert.equal(profile.fullName, fullName);
    assert.equal(profile.lastName, 'Dela Cruz');
    assert.deepEqual(f.invalidations, []);
    const response = await invoke(getProfile, profile);
    assert.deepEqual(response, profile);
  });
}

test('profile completion accepts nested registration components and preserves status on retry', async t => {
  const f = profileFixture(t, { ...legacyUser(), governmentIdVerification: { status: 'NOT_SUBMITTED' } });
  const profile = await invoke(register, { ...f.stored }, { ...legal, registrationProfile: parts });
  await invoke(register, profile, { ...legal, registrationProfile: parts });
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.invalidations, []);
});

test('unverified legacy fullName-only updates clear outdated parts', async t => {
  const unverified = profileFixture(t, {
    ...legacyUser(),
    ...parts,
    governmentIdVerification: { status: 'NOT_SUBMITTED' },
  });
  await invoke(updateProfile, { ...unverified.stored }, { fullName });
  assert.equal(unverified.stored.firstName, parts.firstName);
  await invoke(updateProfile, { ...unverified.stored }, { fullName: 'Maria Clara Reyes' });
  for (const field of Object.keys(parts)) assert.equal(unverified.stored[field], null);
  assert.deepEqual(unverified.invalidations, []);
});

test('verified accounts reject fullName-only name changes without invalidating verification', async t => {
  const verified = profileFixture(t, { ...legacyUser(), ...parts });
  await assert.rejects(
    () => invoke(updateProfile, { ...verified.stored }, { fullName: 'Maria Clara Reyes' }),
    { statusCode: 403, code: 'LEGAL_NAME_LOCKED' }
  );
  assert.equal(verified.stored.fullName, fullName);
  assert.equal(verified.stored.firstName, parts.firstName);
  assert.equal(verified.stored.governmentIdVerification.status, 'VERIFIED');
  assert.deepEqual(verified.invalidations, []);
});

test('verified account rejects format-only fullName edit and preserves verification', async t => {
  const f = profileFixture(t, { ...legacyUser(), ...parts });
  await assert.rejects(
    () => invoke(updateProfile, { ...f.stored }, { fullName: fullName.toUpperCase() }),
    { statusCode: 403, code: 'LEGAL_NAME_LOCKED' }
  );
  assert.equal(f.stored.firstName, parts.firstName);
  assert.equal(f.stored.governmentIdVerification.status, 'VERIFIED');
  assert.deepEqual(f.invalidations, []);
});

test('contact-only updates leave existing components and verification untouched', async t => {
  const f = profileFixture(t, { ...legacyUser(), ...parts });
  await invoke(updateProfile, { ...f.stored }, { contactNumber: '09987654321' });
  assert.deepEqual(f.writes[0], { contactNumber: '09987654321' });
  assert.equal(f.stored.firstName, parts.firstName);
  assert.deepEqual(f.invalidations, []);
});

test('staff-managed unverified parishioner name edits save parts and verified parishioners stay locked', async t => {
  const unverified = profileFixture(t, { ...legacyUser(), governmentIdVerification: { status: 'NOT_SUBMITTED' } });
  const service = new UserService();
  await service.editUser(12, parts, 1);
  assert.equal(unverified.stored.lastName, 'Dela Cruz');
  await service.editUser(12, { name: 'Maria Clara Reyes' }, 1);
  assert.equal(unverified.stored.firstName, null);
  assert.deepEqual(unverified.invalidations, []);
});

test('staff-managed verified parishioner name edits are rejected without invalidating verification', async t => {
  const verified = profileFixture(t, { ...legacyUser(), ...parts });
  const service = new UserService();
  await assert.rejects(
    () => service.editUser(12, { name: 'Maria Clara Reyes' }, 1),
    { statusCode: 403, code: 'LEGAL_NAME_LOCKED' }
  );
  assert.equal(verified.stored.fullName, fullName);
  assert.deepEqual(verified.invalidations, []);
});

test('repository sends canonical name and all nullable parts in one user update', async t => {
  let written;
  const originalUpdate = prisma.user.update;
  prisma.user.update = async args => { written = args; return args.data; };
  t.after(() => { prisma.user.update = originalUpdate; });
  const repository = new UserRepository();
  await repository.update(12, { fullName, ...parts });
  assert.deepEqual(written.where, { id: 12 });
  assert.deepEqual(written.data, { fullName, ...parts });
  await repository.update(12, { firstName: null, middleName: null, lastName: null, suffix: null });
  assert.deepEqual(written.data, { firstName: null, middleName: null, lastName: null, suffix: null });
});

test('Self name matching continues to accept stored compound components while excluding suffix from requests', () => {
  const applicantName = buildApplicantName(parts);
  assert.equal(applicantName, 'Juan Miguel Santos Dela Cruz');
  assert.equal(compareSelfRegistrantName(fullName, applicantName).outcome, SELF_NAME_MATCH.CLEAR);
});
