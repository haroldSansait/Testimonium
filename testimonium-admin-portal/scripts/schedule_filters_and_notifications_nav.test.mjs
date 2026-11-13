import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getNotificationDestination,
  getNotificationPresentation,
  isNotificationClickable,
} from '../src/utils/notificationNavigation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

test('Notification navigation resolves exact request details for New Document Request and Payment Proof notifications', () => {
  const docNotif = {
    title: 'New Document Request',
    type: 'document-request',
    referenceType: 'DOCUMENT_REQUEST',
    referenceId: '454',
  };
  assert.equal(isNotificationClickable(docNotif), true);
  assert.deepEqual(getNotificationDestination(docNotif), {
    path: '/document-requests',
    state: { requestId: '454' },
    actionLabel: 'View request',
    categoryLabel: 'Document Request',
  });

  const paymentNotif = {
    title: 'Payment Proof Requires Verification',
    type: 'payment-uploaded',
    referenceType: 'DOCUMENT_REQUEST',
    referenceId: '443',
  };
  assert.equal(isNotificationClickable(paymentNotif), true);
  assert.deepEqual(getNotificationDestination(paymentNotif), {
    path: '/document-requests',
    state: { requestId: '443' },
    actionLabel: 'Review payment',
    categoryLabel: 'Payment Verification',
  });
});

test('Notification navigation resolves exact schedule request destination for New Appointment Request', () => {
  const schedNotif = {
    title: 'New Appointment Request',
    type: 'schedule-request',
    referenceType: 'SCHEDULE_REQUEST',
    referenceId: '53',
  };
  assert.equal(isNotificationClickable(schedNotif), true);
  assert.deepEqual(getNotificationDestination(schedNotif), {
    path: '/schedule-requests',
    state: { requestId: '53' },
    actionLabel: 'View request',
    categoryLabel: 'Schedule Request',
  });
});

test('Notification navigation keeps Pastoral Assignment Accepted/Declined and unlinked notices strictly static', () => {
  const acceptedNotif = {
    title: 'Pastoral Assignment Accepted',
    type: 'system-update',
    referenceType: 'SCHEDULE_REQUEST',
    referenceId: '99',
  };
  assert.equal(isNotificationClickable(acceptedNotif), false);
  assert.equal(getNotificationDestination(acceptedNotif), null);
  assert.equal(
    getNotificationPresentation({ ...acceptedNotif, description: 'Fr. Reyes accepted the assignment.', urgency: 'info' }).category,
    'pastoral'
  );

  const declinedNotif = {
    title: 'Pastoral Assignment Declined',
    type: 'system-update',
    referenceType: 'SCHEDULE_REQUEST',
    referenceId: '100',
  };
  assert.equal(isNotificationClickable(declinedNotif), false);
  assert.equal(getNotificationDestination(declinedNotif), null);

  const generalNotif = {
    title: 'System Maintenance Complete',
    type: 'system-update',
    referenceType: 'GENERAL',
    referenceId: null,
  };
  assert.equal(isNotificationClickable(generalNotif), false);
  assert.equal(getNotificationDestination(generalNotif), null);

  const missingIdConflict = {
    title: 'Schedule Conflict Detected',
    type: 'schedule-conflict',
    referenceType: 'SCHEDULE_REQUEST',
    referenceId: '',
  };
  assert.equal(isNotificationClickable(missingIdConflict), false);
  assert.equal(getNotificationDestination(missingIdConflict), null);
});

test('ScheduleRequestsPage and DocumentRequestsPage contracts implement combined filtering toolbar and deep-link fetch', () => {
  const schedulePageSrc = fs.readFileSync(path.join(srcDir, 'pages/ScheduleRequestsPage.tsx'), 'utf8');
  assert.ok(schedulePageSrc.includes('All Event Types'), 'Must include All Event Types default option');
  assert.ok(schedulePageSrc.includes('All Statuses'), 'Must include All Statuses default option');
  assert.ok(schedulePageSrc.includes('Search by Reference No. or Name...'), 'Must include Reference No. / Name search input');
  assert.ok(schedulePageSrc.includes('EventTypeCatalog'), 'Must populate Event Type dropdown from EventTypeCatalog');
  assert.ok(schedulePageSrc.includes("value: 'OTHER'"), 'Must include Other event type option');
  assert.ok(schedulePageSrc.includes('getScheduleRequest('), 'Must fetch single schedule request by ID when deep-linked from notifications');
  assert.ok(!schedulePageSrc.includes('FILTER_TABS'), 'Segmented tab interface must be replaced with filtering toolbar');

  const docPageSrc = fs.readFileSync(path.join(srcDir, 'pages/DocumentRequestsPage.tsx'), 'utf8');
  assert.ok(docPageSrc.includes('getDocumentRequest('), 'Must fetch single document request by ID when deep-linked beyond current page');

  const cardSrc = fs.readFileSync(path.join(srcDir, 'components/notifications/NotificationCard.tsx'), 'utf8');
  assert.ok(cardSrc.includes('data-notification-interactive="true"'), 'Clickable notifications must expose interactive semantics');
  assert.ok(cardSrc.includes('data-notification-interactive="false"'), 'Static notifications must render non-interactively');
  assert.ok(cardSrc.includes('<article'), 'Static notifications must render as non-clickable article elements');
});

