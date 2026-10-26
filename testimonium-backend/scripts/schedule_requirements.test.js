import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { prisma } from '../config/db.js';
import { ScheduleService } from '../services/ScheduleService.js';
import { ScheduleAttachmentService, SCHEDULE_ATTACHMENT_SELECT } from '../services/ScheduleAttachmentService.js';
import { SCHEDULE_REQUIREMENTS, getScheduleRequirements, validateScheduleRequirements } from '../services/ScheduleRequirements.js';
import { RegistrantIdStorageService } from '../services/RegistrantIdStorageService.js';
import { R2Service } from '../services/R2Service.js';
import { PrivateObjectCleanupWorker } from '../services/PrivateObjectCleanupWorker.js';
import { NotificationDispatcher } from '../services/NotificationDispatcher.js';
import { getManilaHorizonMaxDate } from '../services/BookingValidator.js';
import { create, createWeb } from '../controllers/ScheduleController.js';
import { scheduleWebUpload } from '../middlewares/scheduleUploadMiddleware.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import express from 'express';

const file = (name = 'evidence.pdf', buffer = Buffer.from('%PDF-1.7 test')) => ({
  originalname: name, buffer, size: buffer.length, mimetype: 'application/pdf',
});
const prepared = (ids) => ScheduleAttachmentService.prepare(ids.map(() => file()), JSON.stringify(ids));
const makeParish = (id = 51, eventType = 'BAPTISM', ids = ['birth_cert']) => ({ id, isActive: true,
  officeHours: null, availabilities: [], eventSettings: { availableEvents: [eventType], timeSlots: ['08:00 AM'],
    capacitySettings: { dailyLimit: 100, slotCapacity: 100 },
    [eventType]: { requirements: Object.fromEntries(ids.map((id) => [id, true])) },
  },
});

function stub(t, target, key, implementation) {
  const original = target[key]; target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function fixture(t, parish = makeParish()) {
  const state = { schedules: [], keys: [], jobs: [], uploads: [], notifications: 0,
    failUpload: false, failBooking: false, changeRequirements: false };
  const tx = {
    $queryRaw: async () => [{ id: parish.id }],
    parish: { findUnique: async () => state.changeRequirements ? makeParish(parish.id, 'BAPTISM', ['marriage_cert']) : parish },
    parishWeekdayRule: { findMany: async () => ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].map((weekday) => ({ weekday, isAvailable: true })) },
    parishServiceWeekdayRule: { findMany: async () => [] },
    parishScheduleDateRule: { findUnique: async () => null },
    schedule: {
      findMany: async () => state.schedules,
      create: async ({ data }) => {
        if (state.failBooking) throw new Error('Booking failed');
        const record = { id: state.schedules.length + 1, ...data, createdAt: new Date() };
        state.schedules.push(record); return record;
      },
    },
    privateObjectCleanupJob: { updateMany: async ({ where, data }) => {
      const jobs = state.jobs.filter((j) => where.objectKey.in.includes(j.objectKey) && j.status === where.status);
      jobs.forEach((j) => Object.assign(j, data)); return { count: jobs.length };
    } },
    idempotencyKey: { create: async ({ data }) => { state.keys.push(data); return data; } },
  };
  stub(t, prisma.parish, 'findUnique', async () => parish);
  stub(t, prisma.schedule, 'findUnique', async ({ where }) => state.schedules.find((s) => s.id === where.id));
  stub(t, prisma.idempotencyKey, 'findUnique', async ({ where }) => state.keys.find((key) =>
    ['userId','key','resourceType'].every((field) => key[field] === where.userId_key_resourceType[field])) || null);
  stub(t, prisma.privateObjectCleanupJob, 'create', async ({ data }) => {
    const job = { id: state.jobs.length + 1, status: 'PENDING', ...data }; state.jobs.push(job); return job;
  });
  stub(t, prisma, '$transaction', async (callback) => {
    const snapshot = structuredClone({ schedules: state.schedules, keys: state.keys, jobs: state.jobs, notifications: state.notifications });
    try { return await callback(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
  });
  stub(t, RegistrantIdStorageService, 'assertAvailable', async () => 'approved-private-test');
  stub(t, RegistrantIdStorageService, 'bucketName', () => 'approved-private-test');
  stub(t, R2Service.prototype, 'upload', async (input) => {
    assert.equal(input.bucketName, 'approved-private-test');
    assert.ok(state.jobs.some((j) => j.objectKey === input.key), 'cleanup intent precedes upload');
    state.uploads.push(input);
    if (state.failUpload) throw new Error('Upload failed');
  });
  stub(t, NotificationDispatcher, 'notifyScheduleChange', async () => { state.notifications++; });
  const payload = { userId: 701, parishId: parish.id, eventType: parish.eventSettings.availableEvents[0],
    requestedDate: getManilaHorizonMaxDate(new Date(), 1), timeSlot: '08:00 AM', remarks: 'Test booking' };
  return { state, tx, payload, service: new ScheduleService() };
}

for (const [eventType, definitions] of Object.entries(SCHEDULE_REQUIREMENTS)) {
  test(eventType + ': exact selections, parish differences and complete submission', async (t) => {
    const ids = definitions.map(([id]) => id);
    const parish = makeParish(51, eventType, ids);
    parish.eventSettings[eventType].requirements.endorsement_letter = true;
    assert.deepEqual(getScheduleRequirements(parish, eventType), definitions.map(([id, label]) => ({ id, label })));
    assert.deepEqual(getScheduleRequirements(makeParish(52, eventType, []), eventType), []);
    assert.deepEqual(getScheduleRequirements(makeParish(53, eventType, [ids[0]]), eventType).map((r) => r.id), [ids[0]]);
    const { service, payload, state } = fixture(t, parish);
    const result = await service.create(payload, 'complete-' + eventType, prepared(ids));
    assert.equal(result.schedule.status, 'PENDING');
    assert.equal(state.uploads.length, ids.length);
    assert.deepEqual(state.schedules[0].attachments.create.map((a) => a.requirementLabel).sort(), definitions.map(([, label]) => label).sort());
    assert.equal(state.keys[0].resourceType, 'SCHEDULE_WEB_CREATE');
    assert.ok(state.jobs.every((j) => j.status === 'CANCELLED'));
    assert.equal(state.notifications, 1);
  });
}

test('catalog matches Settings labels and has exactly the six services', async () => {
  assert.deepEqual(Object.keys(SCHEDULE_REQUIREMENTS), ['WEDDING','MARRIAGE_SPECIAL','BAPTISM','CONFIRMATION','WAKE_MASS','FUNERAL']);
  const settings = await readFile(new URL('../../testimonium-admin-portal/src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
  for (const [eventType, definitions] of Object.entries(SCHEDULE_REQUIREMENTS)) {
    const row = settings.split('\n').find((line) => line.includes("id: '" + eventType + "'"));
    for (const [id, label] of definitions) assert.ok(row.includes("{ id: '" + id + "', label: '" + label + "' }"));
  }
  assert.deepEqual(getScheduleRequirements(makeParish(1, 'BLESSING'), 'BLESSING'), []);
  assert.deepEqual(getScheduleRequirements({ eventSettings: '{bad' }, 'BAPTISM'), []);
  const parish = makeParish(); parish.eventSettings.BAPTISM.requirements.birth_cert = 'true';
  assert.deepEqual(getScheduleRequirements(parish, 'BAPTISM'), []);
});

test('missing, duplicate, extra, wrong-service and invalid uploads fail before storage', async (t) => {
  const { service, payload, state } = fixture(t);
  await assert.rejects(service.create(payload, 'missing', []), { code: 'SCHEDULE_REQUIREMENTS_CHANGED' });
  assert.throws(() => validateScheduleRequirements(makeParish(), 'BAPTISM', [{ requirementId: 'birth_cert' }, { requirementId: 'birth_cert' }]), { code: 'SCHEDULE_REQUIREMENTS_CHANGED' });
  await assert.rejects(service.create(payload, 'extra', prepared(['birth_cert','marriage_cert'])), { code: 'SCHEDULE_REQUIREMENTS_CHANGED' });
  await assert.rejects(service.create(payload, 'wrong', prepared(['death_cert'])), { code: 'SCHEDULE_REQUIREMENTS_CHANGED' });
  assert.throws(() => ScheduleAttachmentService.prepare([file()], 'broken'));
  assert.throws(() => ScheduleAttachmentService.prepare([file()], '[]'));
  assert.throws(() => ScheduleAttachmentService.prepare([file(),file()], '["birth_cert","birth_cert"]'));
  assert.throws(() => ScheduleAttachmentService.prepare([file('evidence.exe')], '["birth_cert"]'));
  assert.throws(() => ScheduleAttachmentService.prepare([file('evidence.pdf', Buffer.from('bad'))], '["birth_cert"]'));
  assert.throws(() => ScheduleAttachmentService.prepare([{ ...file(), size: 6 * 1024 * 1024 }], '["birth_cert"]'));
  assert.throws(() => ScheduleAttachmentService.prepare([{ ...file(), mimetype: 'image/png' }], '["birth_cert"]'), { statusCode: 415 });
  assert.equal(state.uploads.length, 0); assert.equal(state.schedules.length, 0);
});

test('no configured prerequisites allow Web bookings with no storage operations', async (t) => {
  const { service, payload, state } = fixture(t, makeParish(51, 'BAPTISM', []));
  await service.create(payload, 'empty', []);
  assert.equal(state.uploads.length, 0); assert.equal(state.jobs.length, 0); assert.equal(state.schedules.length, 1);
});

test('Android service call remains valid without uploads despite configured prerequisites', async (t) => {
  const { service, payload, state } = fixture(t);
  await service.create(payload, 'android-original');
  assert.equal(state.keys[0].resourceType, 'SCHEDULE_CREATE');
  assert.equal(state.schedules[0].attachments, undefined); assert.equal(state.uploads.length, 0);
});

test('disabled service is rejected without upload or booking', async (t) => {
  const { service, payload, state } = fixture(t);
  await assert.rejects(service.create({ ...payload, eventType: 'FUNERAL' }, 'disabled', prepared(['death_cert'])), { code: 'SERVICE_NOT_OFFERED' });
  assert.equal(state.uploads.length, 0);
});

test('authoritative requirements are rechecked inside the booking transaction', async (t) => {
  const { service, payload, state } = fixture(t);
  state.changeRequirements = true;
  await assert.rejects(service.create(payload, 'changed', prepared(['birth_cert'])), { code: 'SCHEDULE_REQUIREMENTS_CHANGED' });
  assert.equal(state.schedules.length, 0); assert.equal(state.keys.length, 0);
  assert.equal(state.jobs[0].status, 'PENDING');
});

test('upload and booking failures retain durable cleanup intent and allow retries', async (t) => {
  const { service, payload, state } = fixture(t);
  state.failUpload = true;
  await assert.rejects(service.create(payload, 'retry', prepared(['birth_cert'])), /Upload failed/);
  assert.equal(state.schedules.length, 0); assert.equal(state.jobs[0].status, 'PENDING');
  state.failUpload = false; state.failBooking = true;
  await assert.rejects(service.create(payload, 'retry', prepared(['birth_cert'])), /Booking failed/);
  assert.equal(state.schedules.length, 0); assert.equal(state.jobs[1].status, 'PENDING');
  state.failBooking = false;
  await service.create(payload, 'retry', prepared(['birth_cert']));
  assert.equal(state.schedules.length, 1); assert.equal(state.jobs[2].status, 'CANCELLED');
});

test('duplicates replay once; changed file content conflicts; Android keys are separate', async (t) => {
  const { service, payload, state } = fixture(t);
  const first = await service.create(payload, 'duplicate', prepared(['birth_cert']));
  const replay = await service.create(payload, 'duplicate', prepared(['birth_cert']));
  assert.equal(replay.isReplay, true); assert.equal(replay.schedule.id, first.schedule.id);
  assert.equal(state.uploads.length, 1); assert.equal(state.schedules.length, 1); assert.equal(state.notifications, 1);
  const changed = ScheduleAttachmentService.prepare([file('evidence.pdf', Buffer.from('%PDF new content'))], '["birth_cert"]');
  await assert.rejects(service.create(payload, 'duplicate', changed), { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
  await service.create(payload, 'duplicate');
  assert.equal(state.schedules.length, 2); assert.equal(state.keys[1].resourceType, 'SCHEDULE_CREATE');
});

test('retrieval authorizes owner and parish staff before private R2 access', async (t) => {
  fixture(t);
  const metadata = { id: 4, requirementLabel: 'Birth Certificate / Immunization Card', fileName: 'evidence.pdf', fileType: 'application/pdf' };
  stub(t, prisma.schedule, 'findUnique', async () => ({ userId: 701, parishId: 51 }));
  stub(t, prisma.scheduleAttachment, 'findMany', async (query) => {
    assert.deepEqual(query.select, SCHEDULE_ATTACHMENT_SELECT); assert.equal(query.where.scheduleId, 1); return [metadata];
  });
  stub(t, prisma.scheduleAttachment, 'findUnique', async () => ({ r2ObjectKey: 'private-key' }));
  let reads = 0;
  stub(t, R2Service.prototype, 'download', async (_key, options) => { reads++; assert.equal(options.bucketName, 'approved-private-test'); return { Body: Readable.from('file') }; });
  for (const actor of [{ id: 701, role: 'PARISHIONER' }, { role: 'SECRETARY', parishId: 51 }, { role: 'PRIEST', parish: { id: 51 } }, { role: 'DIOCESE_COORDINATOR' }]) {
    const result = await ScheduleAttachmentService.download(1, 4, actor); assert.equal(result.metadata.id, 4);
  }
  const before = reads;
  for (const actor of [{ id: 702, role: 'PARISHIONER' }, { role: 'SECRETARY', parishId: 52 }, { role: 'SECRETARY' }, { role: 'PRIEST' }, { role: 'ADMIN' }, { role: 'STAFF', parishId: 51 }]) {
    await assert.rejects(ScheduleAttachmentService.download(1, 4, actor), { statusCode: 404 });
  }
  await assert.rejects(ScheduleAttachmentService.download(1, 99, { id: 701, role: 'PARISHIONER' }), { statusCode: 404 });
  await assert.rejects(ScheduleAttachmentService.list('1bad', { id: 701, role: 'PARISHIONER' }), { statusCode: 400 });
  assert.equal(reads, before);
});

test('idempotency persistence failure rolls back booking and attachment links', async (t) => {
  const { service, payload, state, tx } = fixture(t);
  tx.idempotencyKey.create = async () => { throw new Error('Idempotency write failed'); };
  await assert.rejects(service.create(payload, 'write-failed', prepared(['birth_cert'])), /Idempotency write failed/);
  assert.equal(state.schedules.length, 0); assert.equal(state.keys.length, 0);
  assert.equal(state.notifications, 0); assert.equal(state.jobs[0].status, 'PENDING');
});

test('simulated duplicate race replays the winner and leaves losing upload recoverable', async (t) => {
  const { service, payload, state } = fixture(t);
  const winner = await service.create(payload, 'race', prepared(['birth_cert']));
  const winnerKey = state.keys[0]; state.keys = [];
  stub(t, prisma, '$transaction', async () => {
    state.keys = [winnerKey];
    throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
  });
  const loser = await service.create(payload, 'race', prepared(['birth_cert']));
  assert.equal(loser.isReplay, true); assert.equal(loser.schedule.id, winner.schedule.id);
  assert.equal(state.schedules.length, 1); assert.equal(state.jobs[0].status, 'CANCELLED');
  assert.equal(state.jobs[1].status, 'PENDING');
});

test('a recovery job already claimed by cleanup cannot become a committed booking', async (t) => {
  const { service, payload, state, tx } = fixture(t);
  tx.privateObjectCleanupJob.updateMany = async () => ({ count: 0 });
  await assert.rejects(service.create(payload, 'expired', prepared(['birth_cert'])), { code: 'SCHEDULE_UPLOAD_EXPIRED' });
  assert.equal(state.schedules.length, 0); assert.equal(state.keys.length, 0);
});

test('cleanup removes failed private uploads and preserves committed evidence', async (t) => {
  let referenced = null; let deleted = 0; const updates = [];
  stub(t, prisma.scheduleAttachment, 'findFirst', async () => referenced);
  stub(t, prisma.privateObjectCleanupJob, 'updateMany', async (query) => { updates.push(query.data); return { count: 1 }; });
  stub(t, RegistrantIdStorageService, 'delete', async () => { deleted++; });
  const job = { cleanup_job_id: 1, reason_code: 'SCHEDULE_ATTACHMENT_PENDING', object_key: 'uncommitted', processing_token: 'test', attempt_count: 1 };
  await PrivateObjectCleanupWorker.process(job);
  assert.equal(deleted, 1); assert.equal(updates.at(-1).status, 'COMPLETED');
  referenced = { id: 9 }; await PrivateObjectCleanupWorker.process(job);
  assert.equal(deleted, 1); assert.equal(updates.at(-1).status, 'CANCELLED');
});

test('HTTP multipart Web and original Android JSON creation preserve verification gates', async (t) => {
  const { state } = fixture(t);
  stub(t, prisma.user, 'findUnique', async () => ({ id: 701, fullName: 'Test Person', contactNumber: '09123456789', governmentIdVerification: { status: 'VERIFIED' } }));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 701, role: 'PARISHIONER' }; next(); });
  app.post('/web', scheduleWebUpload, createWeb); app.post('/android', create); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const booking = { parishId: 51, eventType: 'BAPTISM', date: getManilaHorizonMaxDate(new Date(), 1), timeSlot: '08:00 AM' };
  const body = new FormData(); body.append('booking', JSON.stringify(booking)); body.append('requirementIds', '["birth_cert"]'); body.append('files', new Blob(['%PDF evidence'], { type: 'application/pdf' }), 'proof.pdf');
  const response = await fetch(url + '/web', { method: 'POST', headers: { 'Idempotency-Key': 'http-web' }, body });
  assert.equal(response.status, 201, JSON.stringify(await response.json()));
  const android = await fetch(url + '/android', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) });
  assert.equal(android.status, 201); assert.equal(state.schedules.length, 2);
  const missing = new FormData(); missing.append('booking', JSON.stringify(booking));
  const rejected = await fetch(url + '/web', { method: 'POST', headers: { 'Idempotency-Key': 'missing-http' }, body: missing });
  assert.equal(rejected.status, 409);
  const noKey = await fetch(url + '/web', { method: 'POST', body }); assert.equal(noKey.status, 400);
  const malformed = await fetch(url + '/web', { method: 'POST', body: new FormData() }); assert.equal(malformed.status, 400);
});

test('HTTP wedding submission accepts the full three-document multipart envelope', async (t) => {
  const ids = ['cenomar', 'marriage_license', 'baptismal_cert'];
  const { state } = fixture(t, makeParish(51, 'WEDDING', ids));
  stub(t, prisma.user, 'findUnique', async () => ({ id: 701, fullName: 'Test Person', contactNumber: '09123456789', governmentIdVerification: { status: 'VERIFIED' } }));
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 701, role: 'PARISHIONER' }; next(); });
  app.post('/web', scheduleWebUpload, createWeb); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const body = new FormData();
  body.append('booking', JSON.stringify({ parishId: 51, eventType: 'WEDDING', date: getManilaHorizonMaxDate(new Date(), 1), timeSlot: '08:00 AM' }));
  body.append('requirementIds', JSON.stringify(ids));
  ids.forEach((id) => body.append('files', new Blob(['%PDF proof'], { type: 'application/pdf' }), id + '.pdf'));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/web', {
    method: 'POST', headers: { 'Idempotency-Key': 'wedding-three' }, body,
  });
  assert.equal(response.status, 201, JSON.stringify(await response.json()));
  assert.equal(state.schedules[0].attachments.create.length, 3);
  body.append('files', new Blob(['%PDF fourth'], { type: 'application/pdf' }), 'extra.pdf');
  const overflow = await fetch('http://127.0.0.1:' + server.address().port + '/web', {
    method: 'POST', headers: { 'Idempotency-Key': 'wedding-overflow' }, body,
  });
  assert.equal(overflow.status, 400); assert.equal(state.schedules.length, 1);
});
