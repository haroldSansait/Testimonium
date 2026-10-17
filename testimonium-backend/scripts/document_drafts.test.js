import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db.js';
import { ParishionerRequestService } from '../services/ParishionerRequestService.js';
import { DocumentRequirementService } from '../services/DocumentRequirementService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { RequestNotificationService } from '../services/RequestNotificationService.js';
import { updateDraftSchema } from '../validators/requestSchemas.js';
import { updateDraft, deleteDraft } from '../controllers/ParishionerRequestController.js';
import { validateBody } from '../middlewares/validateRequest.js';
import { PrivateObjectCleanupWorker } from '../services/PrivateObjectCleanupWorker.js';
import { R2Service } from '../services/R2Service.js';
import { RegistrantIdStorageService } from '../services/RegistrantIdStorageService.js';
import { env } from '../config/env.js';
import { r2Client } from '../config/r2.js';
import { readFile } from 'node:fs/promises';

// Every database operation used below is replaced with a controlled fixture.
function fixture(t, overrides = {}) {
  const request = {
    id: 446, userId: 12, parishId: 3, documentType: 'BAPTISMAL_CERTIFICATE',
    isDraft: true, status: 'PENDING', trackingNumber: 'SR-2026-000446', fee: 100,
    applicantName: 'Maria Santos', relationship: 'Self', purpose: 'School',
    attachments: [{ id: 1, category: 'certificate', fileName: 'saved.pdf' }],
    ...overrides,
  };
  const user = { id: 12, fullName: 'Juan Dela Cruz', contactNumber: '09123456789', role: { roleName: 'PARISHIONER' }, governmentIdVerification: { status: 'VERIFIED' } };
  const events = [];
  let evidence = null;
  const tx = {
    $queryRaw: async (sql, ...values) => { events.push(['lock', sql.join('?'), values]); },
    user: { findUnique: async () => user },
    parish: { findUnique: async () => ({ id: 3, parishName: 'Fixture Parish', availableDocuments: ['BAPTISMAL_CERTIFICATE'] }) },
    documentRequest: {
      findFirst: async ({ where }) => { events.push(['read']); return where.id === request.id && where.userId === request.userId ? { ...request } : null; },
      create: async ({ data }) => { events.push(['create']); Object.assign(request, data); return { ...request }; },
      update: async ({ data }) => { events.push(['update', data]); Object.assign(request, data); return { ...request }; },
    },
    requestAttachment: {
      findFirst: async ({ where }) => request.attachments.find(a => a.category === where.category) || null,
      findMany: async () => request.attachments,
    },
    registrantIdEvidence: { findUnique: async () => evidence },
    requestHistory: { create: async ({ data }) => { events.push(['history', data.action]); return { id: 7 }; } },
  };
  const originalTransaction = prisma.$transaction;
  const originalUserLookup = prisma.user.findUnique;
  prisma.$transaction = async callback => callback(tx);
  prisma.user.findUnique = async () => user;
  t.after(() => { prisma.$transaction = originalTransaction; prisma.user.findUnique = originalUserLookup; });
  t.mock.method(DocumentRequirementService, 'getRequirements', async () => ({ requiredDocuments: [{ id: 'valid_id', required: true }, { id: 'certificate', required: true }] }));
  t.mock.method(AuditLogService, 'log', async (...args) => { events.push(['audit', args[1]]); });
  t.mock.method(RequestNotificationService, 'notifyStatusChange', async () => { events.push(['notify']); });
  return { request, user, events, tx, setEvidence: value => { evidence = value; }, service: new ParishionerRequestService() };
}

test('draft metadata allowlist rejects protected fields and invalid values', () => {
  for (const key of ['status', 'isDraft', 'userId', 'fee', 'paymentStatus', 'trackingNumber', 'parishId', 'documentType', 'attachments']) {
    assert.equal(updateDraftSchema.safeParse({ purpose: 'School', [key]: 'injected' }).success, false, key);
  }
  for (const payload of [{}, { applicantName: ' ' }, { applicantName: 'x'.repeat(151) }, { relationship: null }, { purpose: 10 }]) {
    assert.equal(updateDraftSchema.safeParse(payload).success, false);
  }
  let nextCalled = false;
  const res = { status(code) { assert.equal(code, 400); return this; }, json(body) { assert.equal(body.success, false); } };
  validateBody(updateDraftSchema)({ body: { fee: 0 } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
});

test('owner edits legal name and purpose under lock, preserving ID, fee and files without sending mail', async t => {
  const f = fixture(t);
  const files = f.request.attachments;
  const result = await f.service.updateDraft(446, 12, { applicantName: ' Juan Dela Cruz ', purpose: 'Passport (Approximate Registry Year: 1995)' });
  assert.equal(result.id, 446);
  assert.equal(result.trackingNumber, 'SR-2026-000446');
  assert.equal(result.fee, 100);
  assert.equal(result.applicantName, 'Juan Dela Cruz');
  assert.equal(result.purpose, 'Passport (Approximate Registry Year: 1995)');
  assert.equal(result.isDraft, true);
  assert.equal(result.attachments, files);
  assert.match(f.events[0][1], /FOR UPDATE/);
  assert.deepEqual(f.events[0][2], [446, 12]);
  assert.ok(f.events.some(e => e[0] === 'history' && e[1] === 'DRAFT_UPDATED'));
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 0);
});

test('explicit name parts reuse the canonical builder and update only the existing applicantName field', async t => {
  const f = fixture(t);
  for (const middleName of ['Santos', '']) {
    const result = await f.service.updateDraft(446, 12, {
      applicantFirstName: ' Juan  Miguel ', applicantMiddleName: middleName, applicantLastName: ' Dela  Cruz ',
    });
    assert.equal(result.id, 446);
    assert.equal(result.applicantName, middleName ? 'Juan Miguel Santos Dela Cruz' : 'Juan Miguel Dela Cruz');
    const update = f.events.filter(e => e[0] === 'update').at(-1)[1];
    assert.deepEqual(Object.keys(update), ['applicantName']);
  }
  assert.equal(f.events.filter(e => e[0] === 'create').length, 0);
});

test('purpose-only and relationship-only edits preserve the exact original saved name', async t => {
  const name = '  Dela Cruz,  Juan Miguel Jr.  ';
  const f = fixture(t, { applicantName: name });
  await f.service.updateDraft(446, 12, { purpose: 'Passport' });
  await f.service.updateDraft(446, 12, { relationship: 'Parent' });
  assert.equal(f.request.applicantName, name);
  assert.ok(f.events.filter(e => e[0] === 'update').every(e => !Object.hasOwn(e[1], 'applicantName')));
});

test('incomplete, blank, oversized or ambiguous structured names never overwrite the saved name', async t => {
  const f = fixture(t);
  for (const details of [
    { applicantFirstName: 'Juan' }, { applicantMiddleName: 'Santos' }, { applicantLastName: 'Cruz' },
    { applicantFirstName: '', applicantLastName: '' }, { applicantFirstName: 'Juan', applicantLastName: null },
    { applicantFirstName: 'x'.repeat(51), applicantLastName: 'Cruz' },
    { applicantName: 'Different Name', applicantFirstName: 'Juan', applicantLastName: 'Cruz' },
  ]) {
    assert.equal(updateDraftSchema.safeParse(details).success, false);
    await assert.rejects(f.service.updateDraft(446, 12, details));
  }
  assert.equal(f.request.applicantName, 'Maria Santos');
  assert.equal(f.events.filter(e => e[0] === 'update').length, 0);
});

test('another owner and non-parishioner are rejected without updates', async t => {
  const f = fixture(t);
  await assert.rejects(f.service.updateDraft(446, 99, { purpose: 'Attack' }), { statusCode: 404 });
  f.user.role.roleName = 'PRIEST';
  await assert.rejects(f.service.updateDraft(446, 12, { purpose: 'Attack' }), { statusCode: 403 });
  assert.equal(f.events.filter(e => e[0] === 'update').length, 0);
});

test('already submitted or concurrently finalized draft rejects edits after acquiring lock', async t => {
  const f = fixture(t);
  f.tx.$queryRaw = async () => { f.request.isDraft = false; };
  await assert.rejects(f.service.updateDraft(446, 12, { purpose: 'Too late' }), { code: 'REQUEST_NOT_DRAFT', statusCode: 409 });
  assert.equal(f.request.purpose, 'School');
});

test('canonical relationship and existing evidence are preserved conservatively', async t => {
  const f = fixture(t, { relationship: 'Parent' });
  f.setEvidence({ frontObjectKey: 'private-fixture', backObjectKey: 'private-fixture-back' });
  await assert.rejects(f.service.updateDraft(446, 12, { relationship: 'Self' }), { code: 'DRAFT_RELATIONSHIP_EVIDENCE_CONFLICT' });
  assert.equal(f.request.relationship, 'Parent');
  await f.service.updateDraft(446, 12, { relationship: ' parent ', purpose: 'Edited' });
  f.setEvidence(null);
  f.request.attachments.push({ category: 'authorization_letter', fileName: 'authorization.pdf' });
  await assert.rejects(f.service.updateDraft(446, 12, { relationship: 'Spouse' }), { code: 'DRAFT_RELATIONSHIP_EVIDENCE_CONFLICT' });
  await assert.rejects(f.service.updateDraft(446, 12, { relationship: 'Friend' }), { code: 'INVALID_RELATIONSHIP' });
});

test('Self-name mismatch stays a draft; correction submits the original ID and only then notifies', async t => {
  const f = fixture(t);
  await assert.rejects(f.service.submitDraft(446, 12), { code: 'SELF_REGISTRANT_NAME_MISMATCH' });
  assert.equal(f.request.isDraft, true);
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 0);
  await f.service.updateDraft(446, 12, { applicantFirstName: 'Juan', applicantLastName: 'Dela Cruz' });
  const result = await f.service.submitDraft(446, 12);
  assert.equal(result.id, 446);
  assert.equal(result.isDraft, false);
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 1);
  await assert.rejects(f.service.updateDraft(446, 12, { purpose: 'Late edit' }), { code: 'REQUEST_NOT_DRAFT' });
});

test('editing into non-Self does not bypass authorization letter, private ID or attachment requirements', async t => {
  const f = fixture(t);
  await f.service.updateDraft(446, 12, { relationship: 'Parent' });
  await assert.rejects(f.service.submitDraft(446, 12), { code: 'AUTHORIZATION_LETTER_REQUIRED' });
  f.request.attachments.push({ category: 'authorization_letter' });
  await assert.rejects(f.service.submitDraft(446, 12), { code: 'REGISTRANT_ID_REQUIRED' });
  f.setEvidence({ frontObjectKey: 'front', backObjectKey: 'back', frontSha256: 'a', backSha256: 'b' });
  f.request.attachments = f.request.attachments.filter(a => a.category !== 'certificate');
  await assert.rejects(f.service.submitDraft(446, 12), /required attachments/);
  assert.equal(f.request.isDraft, true);
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 0);
});

test('draft creation alone records a draft event without submission notifications', async t => {
  const f = fixture(t);
  const result = await f.service.createDraft(12, { parishId: 3, documentType: 'BAPTISMAL_CERTIFICATE', applicantFirstName: 'Juan', applicantLastName: 'Dela Cruz', relationship: 'Self', purpose: 'School' });
  assert.equal(result.isDraft, true);
  assert.ok(f.events.some(e => e[0] === 'history' && e[1] === 'DRAFT_CREATED'));
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 0);
});

test('PATCH controller validates IDs and returns the saved same-draft DTO', async t => {
  const f = fixture(t);
  let status;
  let body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; } };
  const req = { user: { id: 12 }, params: { id: '446junk' }, body: { purpose: 'School' } };
  await updateDraft(req, res, error => { throw error; });
  assert.equal(status, 400);
  req.params.id = '446';
  await updateDraft(req, res, error => { throw error; });
  assert.equal(status, 200);
  assert.equal(body.data.id, f.request.id);
});

function deletionFixture(t, overrides = {}) {
  const f = fixture(t, {
    attachments: [{ id: 1, r2ObjectKey: 'documents/req_446/certificate/saved.pdf' }, { id: 2, category: 'authorization_letter', r2ObjectKey: 'documents/req_446/authorization_letter/opaque' }],
    registrantIdEvidence: { frontObjectKey: 'registrant-id/446/front/opaque', backObjectKey: 'registrant-id/446/back/opaque' },
    paymentTransactions: [], returns: [], ...overrides,
  });
  const state = {
    deleted: false, jobs: new Map(), history: [{ requestId: 446, action: 'DRAFT_CREATED' }],
    correctionSnapshots: [{ requestId: 446 }],
    keys: [
      { userId: 12, resourceType: 'DOCUMENT_REQUEST_CREATE', resourceId: 446 },
      { userId: 99, resourceType: 'DOCUMENT_REQUEST_CREATE', resourceId: 446 },
      { userId: 12, resourceType: 'SCHEDULE_CREATE', resourceId: 446 },
      { userId: 12, resourceType: 'DOCUMENT_REQUEST_CREATE', resourceId: 447 },
    ],
  };
  const findFirst = f.tx.documentRequest.findFirst;
  f.tx.documentRequest.findFirst = args => state.deleted ? null : findFirst(args);
  f.tx.documentRequest.delete = async ({ where }) => {
    assert.equal(where.id, 446);
    f.events.push(['delete']);
    state.deleted = true;
    state.history = [];
    state.correctionSnapshots = [];
    f.request.attachments = [];
    f.request.registrantIdEvidence = null;
  };
  f.tx.privateObjectCleanupJob = { upsert: async ({ where, create, update }) => {
    f.events.push(['queue']);
    const existing = state.jobs.get(where.objectKey);
    state.jobs.set(where.objectKey, existing ? { ...existing, ...update } : { status: 'PENDING', attemptCount: 0, ...create });
  } };
  f.tx.idempotencyKey = { updateMany: async ({ where, data }) => {
    for (const key of state.keys) if (key.userId === where.userId && key.resourceType === where.resourceType && key.resourceId === where.resourceId) Object.assign(key, data);
  } };
  t.mock.method(AuditLogService, 'logOrThrow', async (...args) => { f.events.push(['durable-audit', args[1], args[4]]); });
  // Controlled rollback: failures cannot commit the draft removal or cleanup intents.
  prisma.$transaction = async callback => {
    const before = structuredClone(state);
    const beforeRequest = structuredClone(f.request);
    try { return await callback(f.tx); }
    catch (error) { Object.assign(state, before); Object.assign(f.request, beforeRequest); throw error; }
  };
  t.mock.method(R2Service.prototype, 'delete', async () => { assert.fail('Storage must not be called inside draft deletion'); });
  t.mock.method(RegistrantIdStorageService, 'delete', async () => { assert.fail('Private storage must not be called inside draft deletion'); });
  return { ...f, state };
}

test('manual deletion atomically queues both buckets, removes draft relationships, preserves audit and fences creation retries', async t => {
  const f = deletionFixture(t);
  // A previously cancelled/exhausted upload cleanup job must become runnable again.
  f.state.jobs.set('registrant-id/446/front/opaque', { status: 'CANCELLED', attemptCount: 999, processingToken: 'old' });
  const result = await f.service.deleteDraft(446, 12);
  assert.deepEqual(result, { id: 446, cleanupQueued: true });
  assert.equal(f.state.deleted, true);
  assert.equal(f.state.history.length, 0);
  assert.equal(f.state.correctionSnapshots.length, 0);
  assert.equal(f.request.attachments.length, 0);
  assert.equal(f.request.registrantIdEvidence, null);
  assert.equal(f.state.jobs.size, 4);
  assert.equal(f.state.jobs.get('documents/req_446/certificate/saved.pdf').reasonCode, 'DRAFT_ATTACHMENT_DELETED');
  assert.equal(f.state.jobs.get('registrant-id/446/back/opaque').reasonCode, 'DRAFT_REGISTRANT_ID_DELETED');
  assert.equal(f.state.jobs.get('registrant-id/446/front/opaque').attemptCount, 0);
  assert.equal(f.state.jobs.get('registrant-id/446/front/opaque').status, 'PENDING');
  assert.deepEqual(f.state.keys.map(key => key.resourceId), [0, 446, 446, 447]);
  const audit = f.events.find(e => e[0] === 'durable-audit');
  assert.equal(audit[1], 'Document Request Draft Deleted');
  assert.equal(audit[2].affectedRecordId, 446);
  assert.match(f.events[0][1], /FOR UPDATE/);
  assert.deepEqual(f.events[0][2], [446, 12]);
  assert.ok(f.events.findIndex(e => e[0] === 'delete') > f.events.findIndex(e => e[0] === 'queue'));
  assert.equal(f.events.filter(e => e[0] === 'notify').length, 0);
  assert.doesNotMatch(JSON.stringify(result), /documents\/|registrant-id\//);
  await assert.rejects(f.service.deleteDraft(446, 12), { statusCode: 404 });
});

test('deletion rejects another owner, missing drafts, submitted requests and non-parishioners without cleanup', async t => {
  const f = deletionFixture(t);
  await assert.rejects(f.service.deleteDraft(446, 99), { statusCode: 404 });
  await assert.rejects(f.service.deleteDraft(447, 12), { statusCode: 404 });
  f.request.isDraft = false;
  await assert.rejects(f.service.deleteDraft(446, 12), { code: 'REQUEST_NOT_DRAFT', statusCode: 409 });
  f.request.isDraft = true;
  f.user.role.roleName = 'SECRETARY';
  await assert.rejects(f.service.deleteDraft(446, 12), { statusCode: 403 });
  assert.equal(f.state.deleted, false);
  assert.equal(f.state.jobs.size, 0);
  assert.equal(f.state.keys[0].resourceId, 446);
});

test('final submission winning the lock prevents draft deletion', async t => {
  const f = deletionFixture(t);
  f.tx.$queryRaw = async () => { f.request.isDraft = false; };
  await assert.rejects(f.service.deleteDraft(446, 12), { code: 'REQUEST_NOT_DRAFT' });
  assert.equal(f.state.jobs.size, 0);
  assert.equal(f.state.deleted, false);
});

test('cleanup persistence, audit or delete failure rolls back every database change and never touches storage', async t => {
  const f = deletionFixture(t);
  const queue = f.tx.privateObjectCleanupJob.upsert;
  f.tx.privateObjectCleanupJob.upsert = async args => { await queue(args); throw new Error('Queue unavailable'); };
  await assert.rejects(f.service.deleteDraft(446, 12), /Queue unavailable/);
  assert.equal(f.state.jobs.size, 0);
  assert.equal(f.state.deleted, false);
  assert.equal(f.state.history.length, 1);
  f.tx.privateObjectCleanupJob.upsert = queue;
  const audit = AuditLogService.logOrThrow;
  AuditLogService.logOrThrow = async () => { throw new Error('Audit unavailable'); };
  await assert.rejects(f.service.deleteDraft(446, 12), /Audit unavailable/);
  AuditLogService.logOrThrow = audit;
  assert.equal(f.state.jobs.size, 0);
  assert.equal(f.state.keys[0].resourceId, 446);
  f.tx.documentRequest.delete = async () => { throw new Error('Delete conflict'); };
  await assert.rejects(f.service.deleteDraft(446, 12), /Delete conflict/);
  assert.equal(f.state.jobs.size, 0);
  assert.equal(f.state.keys[0].resourceId, 446);
});

test('empty draft deletion queues no files', async t => {
  const f = deletionFixture(t, { attachments: [], registrantIdEvidence: null });
  assert.deepEqual(await f.service.deleteDraft(446, 12), { id: 446, cleanupQueued: false });
  assert.equal(f.state.jobs.size, 0);
});

test('all associated document-bucket keys are retained for cleanup before cascade deletion', async t => {
  const key = 'documents/req_446/receipt/shared';
  const f = deletionFixture(t, {
    paymentProofObjectKey: key,
    paymentTransactions: [{ receipts: [{ r2ObjectKey: key }] }],
    returns: [{ returnedObjectKey: 'returns/446/returned', correctedObjectKey: 'returns/446/corrected' }],
  });
  await f.service.deleteDraft(446, 12);
  assert.equal(f.state.jobs.size, 7);
  assert.equal(f.state.jobs.get(key).reasonCode, 'DRAFT_ATTACHMENT_DELETED');
});

test('deleted creation keys cannot recreate a draft on the normal or concurrent recovery path', async t => {
  const f = fixture(t);
  const payload = { parishId: 3, documentType: 'BAPTISMAL_CERTIFICATE', applicantName: 'Juan Dela Cruz', relationship: 'Self', purpose: 'School' };
  f.tx.idempotencyKey = { findUnique: async () => ({ resourceId: 0 }) };
  await assert.rejects(f.service.createDraft(12, payload, 'deleted-key'), { code: 'DRAFT_DELETED', statusCode: 409 });
  assert.equal(f.events.filter(e => e[0] === 'create').length, 0);
  prisma.$transaction = async () => { throw { code: 'P2002' }; };
  const original = prisma.idempotencyKey.findUnique;
  prisma.idempotencyKey.findUnique = async () => ({ resourceId: 0 });
  t.after(() => { prisma.idempotencyKey.findUnique = original; });
  await assert.rejects(f.service.createDraft(12, payload, 'deleted-key'), { code: 'DRAFT_DELETED' });
});

test('DELETE controller rejects malformed IDs and never accepts client-supplied owner or file keys', async t => {
  const f = deletionFixture(t);
  let status;
  let body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; } };
  const req = { user: { id: 99 }, params: { id: '446junk' }, body: { userId: 12, objectKey: 'injected' } };
  await deleteDraft(req, res, error => { throw error; });
  assert.equal(status, 400);
  req.params.id = '446';
  let error;
  await deleteDraft(req, res, value => { error = value; });
  assert.equal(error.statusCode, 404);
  req.user.id = 12;
  await deleteDraft(req, res, value => { throw value; });
  assert.equal(status, 200);
  assert.equal(body.data.id, 446);
  assert.equal(f.state.jobs.has('injected'), false);
});

function cleanupFixture(t, { referenced = false, fail = null } = {}) {
  const calls = [];
  const replace = (object, name, value) => { const original = object[name]; object[name] = value; t.after(() => { object[name] = original; }); };
  for (const model of ['requestAttachment', 'receiptUpload', 'documentRequest', 'documentReturn', 'registrantIdEvidence']) {
    replace(prisma[model], 'findFirst', async args => { calls.push(['reference', model, args]); return referenced ? { id: 1 } : null; });
  }
  replace(prisma.privateObjectCleanupJob, 'updateMany', async args => { calls.push(['status', args]); return { count: 1 }; });
  t.mock.method(R2Service.prototype, 'delete', async key => { calls.push(['document-delete', key]); if (fail) throw fail; });
  t.mock.method(RegistrantIdStorageService, 'delete', async key => { calls.push(['private-delete', key]); if (fail) throw fail; });
  return calls;
}

test('cleanup worker routes document files and private IDs to their existing storage services', async t => {
  const calls = cleanupFixture(t);
  for (const reason of ['DRAFT_ATTACHMENT_DELETED', 'DRAFT_REGISTRANT_ID_DELETED', 'SUPERSEDED_OBJECT']) {
    await PrivateObjectCleanupWorker.process({ cleanup_job_id: 1, object_key: `fixture/${reason}`, reason_code: reason, attempt_count: 1, processing_token: 'fixture-token' });
  }
  assert.equal(calls.filter(c => c[0] === 'document-delete').length, 1);
  assert.equal(calls.filter(c => c[0] === 'private-delete').length, 2);
  assert.ok(calls.filter(c => c[0] === 'status').every(c => c[1].data.status === 'COMPLETED' && c[1].where.processingToken === 'fixture-token'));
});

test('referenced objects are never removed from either bucket', async t => {
  const calls = cleanupFixture(t, { referenced: true });
  for (const reason_code of ['DRAFT_ATTACHMENT_DELETED', 'DRAFT_REGISTRANT_ID_DELETED']) {
    await PrivateObjectCleanupWorker.process({ cleanup_job_id: 1, object_key: 'fixture', reason_code, attempt_count: 1 });
  }
  assert.equal(calls.filter(c => c[0].endsWith('-delete')).length, 0);
  assert.ok(calls.filter(c => c[0] === 'status').every(c => c[1].data.status === 'CANCELLED'));
});

test('storage failures retain durable cleanup intent for retries and report exhausted attempts', async t => {
  const calls = cleanupFixture(t, { fail: new Error('Fixture storage outage') });
  for (const attempt_count of [1, env.registrantId.cleanupMaxAttempts]) {
    await PrivateObjectCleanupWorker.process({ cleanup_job_id: 1, object_key: 'fixture', reason_code: 'DRAFT_ATTACHMENT_DELETED', attempt_count });
  }
  const states = calls.filter(c => c[0] === 'status').map(c => c[1].data);
  assert.equal(states[0].status, 'PENDING');
  assert.ok(states[0].nextAttemptAt > new Date());
  assert.equal(states[1].status, 'FAILED');
  assert.ok(states.every(state => state.lastErrorCode === 'DELETE_FAILED'));
});

test('already missing R2 files are treated as successfully cleaned', async t => {
  const calls = cleanupFixture(t, { fail: { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } } });
  await PrivateObjectCleanupWorker.process({ cleanup_job_id: 1, object_key: 'fixture', reason_code: 'DRAFT_ATTACHMENT_DELETED', attempt_count: 1 });
  assert.equal(calls.find(c => c[0] === 'status')[1].data.status, 'COMPLETED');
});

test('document and registrant-ID deletes use separate buckets and never use requester Government ID storage', async t => {
  const originalR2 = { ...env.r2 };
  t.after(() => { Object.assign(env.r2, originalR2); });
  Object.assign(env.r2, {
    bucketName: 'fixture-documents', registrantIdBucketName: 'fixture-registrant-id',
    registrantIdBucketApproved: true, identityBucketName: 'fixture-requester-id',
  });
  const commands = [];
  t.mock.method(r2Client, 'send', async command => { commands.push(command.input); });
  await new R2Service().delete('documents/req_446/certificate/fixture');
  await RegistrantIdStorageService.delete('registrant-id/446/front/fixture');
  assert.deepEqual(commands.map(command => command.Bucket), ['fixture-documents', 'fixture-registrant-id']);
  assert.ok(commands.every(command => command.Bucket !== 'fixture-requester-id'));
});

test('draft DELETE stays behind authentication and existing foreign keys cascade dependent request rows', async () => {
  const routes = await readFile(new URL('../routes/parishionerRequestRoutes.js', import.meta.url), 'utf8');
  assert.ok(routes.indexOf('router.use(authenticateFirebaseToken)') < routes.indexOf('router.delete("/:id", deleteDraft)'));
  assert.ok(routes.indexOf('router.use(checkRole(["PARISHIONER"]))') < routes.indexOf('router.delete("/:id", deleteDraft)'));
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  for (const model of ['RequestAttachment', 'RegistrantIdEvidence', 'RelationshipEvidenceCorrection', 'RequestHistory', 'PaymentTransaction', 'DocumentReturn']) {
    const body = schema.split(`model ${model} {`)[1].split('\n}')[0];
    assert.match(body, /DocumentRequest\s+@relation\([^\n]*onDelete: Cascade/);
  }
});
