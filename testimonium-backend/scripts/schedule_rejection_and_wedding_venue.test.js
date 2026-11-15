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
import { ScheduleTemplates } from '../services/NotificationDispatcher.js';

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

