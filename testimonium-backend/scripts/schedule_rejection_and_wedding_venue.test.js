import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { updateScheduleStatusSchema, createScheduleSchema } from '../validators/scheduleSchemas.js';
import {
  SCHEDULE_REJECTION_REASONS,
  SCHEDULE_REJECTION_REASON_CODES,
  DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS,
  getScheduleRejectionReasonLabel,
} from '../shared/ScheduleRejectionReasons.js';
import { NotificationDispatcher, ScheduleTemplates } from '../services/NotificationDispatcher.js';
import { prisma } from '../config/db.js';
import { ScheduleService } from '../services/ScheduleService.js';

const root = resolve(import.meta.dirname, '..');

test('ScheduleRejectionReasons defines all 6 canonical codes and document-related subset', () => {
  assert.equal(SCHEDULE_REJECTION_REASON_CODES.length, 6);
  assert.deepEqual(SCHEDULE_REJECTION_REASON_CODES, [
    'MISSING_REQUIREMENTS',
    'INVALID_DOCUMENTS',
    'INCORRECT_BOOKING_INFO',
    'UNAVAILABLE_DATE_TIME',
    'SERVICE_UNAVAILABLE',
    'OTHER',
  ]);
  assert.equal(DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has('MISSING_REQUIREMENTS'), true);
  assert.equal(DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has('INVALID_DOCUMENTS'), true);
  assert.equal(DOCUMENT_RELATED_SCHEDULE_REJECTION_REJECTION_CHECK(), false);
  assert.equal(
    getScheduleRejectionReasonLabel('UNAVAILABLE_DATE_TIME'),
    'Requested date or time cannot be accommodated'
  );

  function DOCUMENT_RELATED_SCHEDULE_REJECTION_REJECTION_CHECK() {
    return DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has('OTHER');
  }
});

test('updateScheduleStatusSchema enforces canonical rejectionReasonCode when status is REJECTED', () => {
  const missingReason = updateScheduleStatusSchema.safeParse({
    status: 'REJECTED',
    expectedVersion: 1,
  });
  assert.equal(missingReason.success, false);

  const invalidReason = updateScheduleStatusSchema.safeParse({
    status: 'REJECTED',
    expectedVersion: 1,
    rejectionReasonCode: 'MADE_UP_REASON',
  });
  assert.equal(invalidReason.success, false);

  const tooLongNote = updateScheduleStatusSchema.safeParse({
    status: 'REJECTED',
    expectedVersion: 1,
    rejectionReasonCode: 'OTHER',
    rejectionNote: 'x'.repeat(1001),
  });
  assert.equal(tooLongNote.success, false);

  for (const code of SCHEDULE_REJECTION_REASON_CODES) {
    const valid = updateScheduleStatusSchema.safeParse({
      status: 'REJECTED',
      expectedVersion: 2,
      rejectionReasonCode: code,
      affectedRequirementIds: ['cenomar'],
      rejectionNote: 'Please check the uploaded file.',
    });
    assert.equal(valid.success, true, `Expected ${code} to pass validation`);
  }

  const cancelled = updateScheduleStatusSchema.safeParse({
    status: 'CANCELLED',
    expectedVersion: 1,
  });
  assert.equal(cancelled.success, true);
});

test('createScheduleSchema accepts optional location within 150 characters', () => {
  const valid = createScheduleSchema.safeParse({
    parishId: 1,
    eventType: 'WEDDING',
    date: '2026-12-20',
    timeSlot: '09:00 AM',
    location: 'St. Joseph Parish',
  });
  assert.equal(valid.success, true);

  const tooLong = createScheduleSchema.safeParse({
    parishId: 1,
    eventType: 'BAPTISM',
    date: '2026-12-20',
    timeSlot: '09:00 AM',
    location: 'a'.repeat(151),
  });
  assert.equal(tooLong.success, false);
});

test('ScheduleTemplates.parishioner includes rejection reason, affected requirements, and note', () => {
  const tpl = ScheduleTemplates.parishioner('Marriage (Canonical Interview)', 'REJECTED', {
    reasonLabel: SCHEDULE_REJECTION_REASONS.MISSING_REQUIREMENTS,
    affectedRequirements: ['CENOMAR', 'Marriage License'],
    note: 'Please bring original copies.',
  });
  assert.equal(tpl.title, 'Schedule Request Rejected');
  assert.match(tpl.message, /Missing or incomplete requirements/);
  assert.match(tpl.message, /CENOMAR, Marriage License/);
  assert.match(tpl.message, /Please bring original copies\./);
});

test('ScheduleService derives WEDDING location from parish.parishName and persists rejection details', () => {
  const serviceSrc = readFileSync(resolve(root, 'services/ScheduleService.js'), 'utf8');
  assert.match(serviceSrc, /canonicalEventType === "WEDDING"\s*\?\s*parish\.parishName/);
  assert.match(serviceSrc, /rejectionReasonCode/);
  assert.match(serviceSrc, /rejectionAffectedRequirements/);
  assert.match(serviceSrc, /rejectionNote/);
  assert.match(serviceSrc, /AFFECTED_REQUIREMENTS_REQUIRED/);
});

function rejectionFixture(t, requirements = {}, attachments = []) {
  const current = { id: 42, parishId: 10, userId: 5, version: 1, status: 'PENDING', eventType: 'BAPTISM' };
  const state = { history: [], notifications: [] };
  const parish = { id: 10, isActive: true, eventSettings: {
    availableEvents: [], timeSlots: ['09:00 AM'], BAPTISM: { requirements },
  } };
  const tx = {
    parish: { findUnique: async () => parish },
    scheduleAttachment: { findMany: async () => attachments },
    schedule: {
      findUnique: async () => current,
      updateMany: async ({ data }) => {
        Object.assign(current, data, { version: current.version + 1, updatedAt: new Date() });
        return { count: 1 };
      },
    },
    scheduleHistory: { create: async ({ data }) => { state.history.push(data); } },
    scheduleAlternativeProposal: { findMany: async () => [] },
  };
  for (const [target, key, implementation] of [
    [prisma.schedule, 'findUnique', async () => current],
    [prisma.parish, 'findUnique', async () => parish],
    [prisma, '$transaction', async (callback) => callback(tx)],
    [NotificationDispatcher, 'notifyScheduleChange', async (data) => { state.notifications.push(data); }],
  ]) {
    const original = target[key];
    target[key] = implementation;
    t.after(() => { target[key] = original; });
  }
  return { state, service: new ScheduleService() };
}

for (const code of DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS) {
  test(`${code}: rejects a booking without configured requirements or attachments before any writes`, async (t) => {
    const { service, state } = rejectionFixture(t);
    await assert.rejects(service.updateStatus(42, 'REJECTED', 9, 'SECRETARY', 10, 1, {
      rejectionReasonCode: code,
    }), { statusCode: 400, code: 'INVALID_REJECTION_REASON' });
    assert.equal(state.history.length, 0);
    assert.equal(state.notifications.length, 0);
  });

  test(`${code}: configured requirements still require affected selection`, async (t) => {
    const { service } = rejectionFixture(t, { birth_cert: true });
    await assert.rejects(service.updateStatus(42, 'REJECTED', 9, 'SECRETARY', 10, 1, {
      rejectionReasonCode: code,
    }), { code: 'AFFECTED_REQUIREMENTS_REQUIRED' });
  });
}

for (const code of SCHEDULE_REJECTION_REASON_CODES) {
  test(`${code}: preserves rejection persistence, history, note and notification with applicable documents`, async (t) => {
    const { service, state } = rejectionFixture(t, { birth_cert: true, marriage_cert: true });
    const result = await service.updateStatus(42, 'REJECTED', 9, 'SECRETARY', 10, 1, {
      rejectionReasonCode: code,
      affectedRequirementIds: ['birth_cert', 'marriage_cert'],
      rejectionNote: '  Please review these documents.  ',
    });
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionReasonCode, code);
    assert.equal(result.rejectionAffectedRequirements.length, 2);
    assert.equal(result.rejectionNote, 'Please review these documents.');
    assert.equal(state.history.length, 1);
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].rejectionContext.affectedRequirements.length, 2);
  });
}

for (const code of SCHEDULE_REJECTION_REASON_CODES.filter((code) => !DOCUMENT_RELATED_SCHEDULE_REJECTION_REASONS.has(code))) {
  test(`${code}: allows rejecting bookings without document requirements`, async (t) => {
    const { service } = rejectionFixture(t);
    const result = await service.updateStatus(42, 'REJECTED', 9, 'SECRETARY', 10, 1, { rejectionReasonCode: code });
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionAffectedRequirements, null);
  });
}

test('previously attached booking requirements remain applicable after configuration changes', async (t) => {
  const { service } = rejectionFixture(t, {}, [{ requirementId: 'birth_cert', requirementLabel: 'Birth Certificate' }]);
  const result = await service.updateStatus(42, 'REJECTED', 9, 'SECRETARY', 10, 1, {
    rejectionReasonCode: 'INVALID_DOCUMENTS', affectedRequirementIds: ['birth_cert'],
  });
  assert.deepEqual(result.rejectionAffectedRequirements, [{ id: 'birth_cert', label: 'Birth Certificate' }]);
});

test('configuration supplies authoritative requirements for existing bookings even when service is disabled', async (t) => {
  const { service } = rejectionFixture(t, { birth_cert: true });
  const config = await service.getSchedulingConfiguration(10);
  assert.deepEqual(config.services, []);
  assert.deepEqual(config.requirementsByEventType.BAPTISM, [{ id: 'birth_cert', label: 'Birth Certificate / Immunization Card' }]);
  assert.deepEqual(config.requirementsByEventType.WEDDING, []);
});

