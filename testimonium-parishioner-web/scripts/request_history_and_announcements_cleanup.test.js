import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatActionLabel,
  formatHistoryRemarks,
  formatStatus,
  CANONICAL_STATUS_LABELS,
  replaceRecognizedStatusTokens,
} from '../src/features/requests/presentation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrc = path.resolve(__dirname, '../src');

const read = (relativePath) => fs.readFileSync(path.join(webSrc, relativePath), 'utf8');

describe('Task 1 — Document Request History Status Headings & Transitions', () => {
  test('canonical status labels match mobile presentation specification', () => {
    const expected = {
      PENDING: 'Pending Review',
      UNDER_REVIEW: 'Under Staff Review',
      NEEDS_CORRECTION: 'Needs Correction',
      PAYMENT_PENDING: 'Payment Required',
      PAYMENT_UNDER_REVIEW: 'Payment Under Review',
      PAYMENT_NEEDS_CORRECTION: 'Payment Correction',
      PAYMENT_VERIFIED: 'Payment Verified',
      PROCESSING: 'In Preparation',
      READY_FOR_SIGNING: 'In Preparation',
      READY_FOR_PICKUP: 'Ready for Pickup',
      COMPLETED: 'Completed',
      RETURNED: 'Returned for Correction',
      REJECTED: 'Declined',
      CANCELLED: 'Cancelled',
    };

    for (const [key, label] of Object.entries(expected)) {
      assert.equal(CANONICAL_STATUS_LABELS[key], label);
      assert.equal(formatStatus(key).label, label);
    }
  });

  test('STATUS_UPDATED derives destination status heading from newStatus', () => {
    const transitions = [
      { oldStatus: 'PENDING', newStatus: 'UNDER_REVIEW', expected: 'Under Staff Review' },
      { oldStatus: 'UNDER_REVIEW', newStatus: 'PAYMENT_PENDING', expected: 'Payment Required' },
      { oldStatus: 'PAYMENT_PENDING', newStatus: 'PAYMENT_UNDER_REVIEW', expected: 'Payment Under Review' },
      { oldStatus: 'PAYMENT_UNDER_REVIEW', newStatus: 'PAYMENT_VERIFIED', expected: 'Payment Verified' },
      { oldStatus: 'PAYMENT_VERIFIED', newStatus: 'PROCESSING', expected: 'In Preparation' },
      { oldStatus: 'PROCESSING', newStatus: 'READY_FOR_SIGNING', expected: 'In Preparation' },
      { oldStatus: 'READY_FOR_SIGNING', newStatus: 'READY_FOR_PICKUP', expected: 'Ready for Pickup' },
      { oldStatus: 'READY_FOR_PICKUP', newStatus: 'COMPLETED', expected: 'Completed' },
      { oldStatus: 'UNDER_REVIEW', newStatus: 'NEEDS_CORRECTION', expected: 'Needs Correction' },
      { oldStatus: 'COMPLETED', newStatus: 'RETURNED', expected: 'Returned for Correction' },
      { oldStatus: 'UNDER_REVIEW', newStatus: 'REJECTED', expected: 'Declined' },
      { oldStatus: 'PENDING', newStatus: 'CANCELLED', expected: 'Cancelled' },
    ];

    for (const { oldStatus, newStatus, expected } of transitions) {
      const heading = formatActionLabel('STATUS_UPDATED', {
        newStatus,
        remarks: `Status updated from ${oldStatus} to ${newStatus}`,
      });
      assert.equal(heading, expected);
    }
  });

  test('STATUS_UPDATED extracts destination status from remarks when newStatus is missing', () => {
    const heading = formatActionLabel('STATUS_UPDATED', {
      remarks: 'Status updated from PAYMENT_UNDER_REVIEW to PAYMENT_VERIFIED',
    });
    assert.equal(heading, 'Payment Verified');

    const legacyPickup = formatActionLabel('STATUS_UPDATED', {
      remarks: 'Status updated from READY_FOR_SIGNING to READY_FOR_PICKUP',
    });
    assert.equal(legacyPickup, 'Ready for Pickup');
  });

  test('STATUS_UPDATED falls back to Status Updated when destination status cannot be determined', () => {
    assert.equal(formatActionLabel('STATUS_UPDATED'), 'Status Updated');
    assert.equal(formatActionLabel('STATUS_UPDATED', { remarks: 'Staff reviewed application.' }), 'Status Updated');
  });

  test('non-status actions format human-readable event headings and preserve remarks', () => {
    assert.equal(formatActionLabel('DRAFT_CREATED'), 'Draft Initialized');
    assert.equal(formatActionLabel('SUBMITTED'), 'Request Submitted');
    assert.equal(formatActionLabel('RECEIPT_UPLOADED'), 'Receipt Uploaded');
    assert.equal(formatActionLabel('RECEIPT_QUALITY_PASSED'), 'Receipt Quality Passed');
    assert.equal(formatActionLabel('PAYMENT_PROOF_LOW_CONFIDENCE'), 'Payment Receipt Under Review');
    assert.equal(formatActionLabel('DOCUMENT_RETURNED'), 'Document Returned for Correction');
    assert.equal(formatActionLabel('CUSTOM_UNKNOWN_ACTION'), 'Custom Unknown Action');
  });

  test('formatHistoryRemarks formats transitions with friendly status names', () => {
    const remarks = formatHistoryRemarks({
      action: 'STATUS_UPDATED',
      oldStatus: 'PENDING',
      newStatus: 'UNDER_REVIEW',
      remarks: 'Status updated from PENDING to UNDER_REVIEW',
    });
    assert.equal(remarks, 'Status updated from Pending Review to Under Staff Review');

    const legacy = formatHistoryRemarks({
      action: 'STATUS_UPDATED',
      remarks: 'Status updated from PAYMENT_UNDER_REVIEW to PAYMENT_VERIFIED',
    });
    assert.equal(legacy, 'Status updated from Payment Under Review to Payment Verified');
  });

  test('formatHistoryRemarks preserves staff notes and custom explanations', () => {
    const staffNote = 'Reason: Typographical or Spelling Error\nNote: Please re-upload front copy of valid ID.';
    const formatted = formatHistoryRemarks({
      action: 'NEEDS_CORRECTION',
      remarks: staffNote,
    });
    assert.equal(formatted, staffNote);

    const withTokens = replaceRecognizedStatusTokens('Certificate moved to READY_FOR_PICKUP upon Father blessing.');
    assert.equal(withTokens, 'Certificate moved to Ready for Pickup upon Father blessing.');
  });

  test('RequestTrackingPage source contract renders heading and transition underneath', () => {
    const tracking = read('pages/dashboard/RequestTrackingPage.tsx');

    assert.match(tracking, /import\s*\{[^}]*formatActionLabel[^}]*formatHistoryRemarks[^}]*\}\s*from\s*['"]\.\.\/\.\.\/features\/requests\/presentation['"]/);
    assert.match(tracking, /const heading = formatActionLabel\(h\.action, h\);/);
    assert.match(tracking, /const formattedRemarks = formatHistoryRemarks\(h\);/);
    assert.match(tracking, /<h4 className="text-xs font-bold text-text-primary">\s*\{heading\}\s*<\/h4>/);
    assert.match(tracking, /\{showRemarks && \(\s*<p className="text-xs text-text-muted mt-0\.5 whitespace-pre-line">\s*\{formattedRemarks\}\s*<\/p>\s*\)\}/);
    // Preserves dateStr and actor
    assert.match(tracking, /\{dateStr\}\s*\{h\.actor\?\.fullName \? `by \$\{h\.actor\.fullName\}` : ''\}/);
  });
});

describe('Task 2 — Diocese Announcements Removal', () => {
  test('Diocese Announcements card and Megaphone are removed from HomePage', () => {
    const home = read('pages/dashboard/HomePage.tsx');

    assert.doesNotMatch(home, /Diocese Announcements/);
    assert.doesNotMatch(home, /useAnnouncements/);
    assert.doesNotMatch(home, /announcementsQuery/);
    assert.doesNotMatch(home, /const announcements =/);
    assert.doesNotMatch(home, /Megaphone/);
  });

  test('Home dashboard working features remain intact', () => {
    const home = read('pages/dashboard/HomePage.tsx');

    assert.match(home, /useParishes/);
    assert.match(home, /useRequests/);
    assert.match(home, /useAppointments/);
    assert.match(home, /useEvents/);
    assert.match(home, /useFeaturedEvents/);
    assert.match(home, /Vicariate Map/);
    assert.match(home, /path:\s*['"]\/dashboard\/notifications['"]/);
    assert.match(home, /path:\s*['"]\/dashboard\/request['"]/);
    assert.match(home, /path:\s*['"]\/dashboard\/track['"]/);
  });

  test('unused announcement provider, hook, and types are removed', () => {
    const apiIndex = read('providers/api/index.ts');
    assert.doesNotMatch(apiIndex, /ApiAnnouncementProvider/);
    assert.doesNotMatch(apiIndex, /announcement:/);

    const providerTypes = read('providers/types.ts');
    assert.doesNotMatch(providerTypes, /IAnnouncementProvider/);
    assert.doesNotMatch(providerTypes, /announcement:\s*IAnnouncementProvider/);

    const useService = read('hooks/useService.ts');
    assert.doesNotMatch(useService, /useAnnouncements/);

    const typesIndex = read('types/index.ts');
    assert.doesNotMatch(typesIndex, /export interface Announcement/);

    const announcementProviderPath = path.join(webSrc, 'providers/api/announcement.ts');
    assert.equal(fs.existsSync(announcementProviderPath), false, 'announcement.ts should be removed');
  });

  test('Notification system preserves announcement notification type and description', () => {
    const typesIndex = read('types/index.ts');
    assert.match(typesIndex, /\|\s*'announcement'/);

    const notificationsPage = read('pages/dashboard/NotificationsPage.tsx');
    assert.match(notificationsPage, /case 'announcement':/);
    assert.match(notificationsPage, /diocesan announcements/);
  });
});
