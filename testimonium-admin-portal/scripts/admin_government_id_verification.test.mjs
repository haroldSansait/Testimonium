import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIdentityStatusResponse } from '../src/utils/governmentIdStatus.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Admin Portal — Government ID Verification & Secure Viewing Suite (Requirements 91 - 98)', async (t) => {
  const pagePath = path.join(srcDir, 'pages/UserManagementPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const apiPath = path.join(srcDir, 'api/api.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  await t.test('89. Standard API envelopes are unwrapped and validated before display', () => {
    const verified = parseIdentityStatusResponse({
      success: true,
      data: {
        status: 'VERIFIED',
        isGovernmentIdVerified: true,
        idType: 'PHIL_SYS',
        verifiedAt: '2026-10-02T12:06:43.714Z',
        expiresAt: null,
        rejectionReason: null,
      },
    });
    assert.equal(verified.status, 'VERIFIED');
    assert.equal(verified.isGovernmentIdVerified, true);
    assert.equal(verified.idType, 'PHIL_SYS');
    assert.ok(pageContent.includes('Verified'));
    assert.ok(pageContent.includes('Philippine Identification (PhilSys / National ID)'));
    assert.ok(pageContent.includes('View Front ID'));
    assert.ok(pageContent.includes('View Back ID'));

    const notSubmitted = parseIdentityStatusResponse({
      success: true,
      data: { status: 'NOT_SUBMITTED', isGovernmentIdVerified: false },
    });
    assert.equal(notSubmitted.status, 'NOT_SUBMITTED');
    assert.equal(notSubmitted.isGovernmentIdVerified, false);

    const rejected = parseIdentityStatusResponse({
      success: true,
      data: {
        status: 'REJECTED',
        isGovernmentIdVerified: false,
        rejectionReason: 'NAME_MISMATCH',
      },
    });
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejectionReason, 'NAME_MISMATCH');

    const expired = parseIdentityStatusResponse({
      success: true,
      data: {
        status: 'VERIFIED',
        isGovernmentIdVerified: false,
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    });
    assert.equal(expired.status, 'VERIFIED');
    assert.equal(expired.isGovernmentIdVerified, false);

    for (const malformed of [
      { success: true },
      { success: true, data: null },
      { success: true, data: {} },
      { success: true, data: { status: 'UNKNOWN', isGovernmentIdVerified: false } },
      { success: true, data: { status: 'VERIFIED' } },
    ]) {
      assert.throws(
        () => parseIdentityStatusResponse(malformed),
        /Invalid Government ID status response/
      );
    }

    assert.ok(pageContent.includes('parseIdentityStatusResponse(res.data)'));
    assert.ok(!pageContent.includes('setIdentityStatus(res.data)'));
    assert.ok(pageContent.includes('setIdentityStatus(null)'));
  });

  await t.test('90. Government ID requests use the shared API base URL exactly once', () => {
    assert.ok(
      apiContent.includes('baseURL: import.meta.env.VITE_API_URL'),
      'Government ID requests must use the shared API client base URL'
    );
    assert.ok(
      pageContent.includes('.get(`/users/${user.id}/identity/status`)'),
      'Status must use the API-client-relative route'
    );
    assert.ok(
      pageContent.includes('api.get(`/users/${user.id}/identity/${side}-image`'),
      'Front and back images must use the API-client-relative route'
    );
    assert.ok(
      !pageContent.includes('/api/v1/users/${user.id}/identity/'),
      'Government ID requests must not duplicate the /api/v1 base path'
    );
  });

  await t.test('91. Coordinator sees Government ID verification status in User Management', () => {
    // Verifies the coordinator condition and status badge rendering
    assert.ok(
      pageContent.includes('isCoordinator &&'),
      'Government ID panel must be conditional on isCoordinator'
    );
    assert.ok(
      pageContent.includes('Government ID Verification'),
      'Must render Government ID Verification section header'
    );
    assert.ok(
      pageContent.includes("identityStatus.status === 'VERIFIED'"),
      'Must handle VERIFIED status'
    );
    assert.ok(
      pageContent.includes("identityStatus.status === 'REJECTED'"),
      'Must handle REJECTED status'
    );
    assert.ok(
      pageContent.includes("'Not Submitted'"),
      'Must handle NOT_SUBMITTED status'
    );
  });

  await t.test('92. Coordinator sees metadata only, not OCR internals or object keys', () => {
    // Must expose ID Type, Verified Date, and Expiry Date when available
    assert.ok(
      pageContent.includes('ID Type'),
      'Must display ID Type label'
    );
    assert.ok(
      pageContent.includes('Verified Date'),
      'Must display Verified Date label'
    );
    assert.ok(
      pageContent.includes('Valid Until'),
      'Must display Valid Until label for expiring IDs'
    );

    // Invariant: Must NEVER render raw OCR, extracted names, or object keys
    assert.ok(
      !pageContent.includes('frontObjectKey'),
      'Must NOT expose frontObjectKey in admin UI'
    );
    assert.ok(
      !pageContent.includes('backObjectKey'),
      'Must NOT expose backObjectKey in admin UI'
    );
    assert.ok(
      !pageContent.includes('ocrResult'),
      'Must NOT expose raw ocrResult in admin UI'
    );
    assert.ok(
      !pageContent.includes('extractedName'),
      'Must NOT expose extractedName in admin UI'
    );
  });

  await t.test('93 & 94. Coordinator can view front and back ID images via dedicated buttons', () => {
    assert.ok(
      pageContent.includes("View Front ID"),
      'Must render View Front ID button'
    );
    assert.ok(
      pageContent.includes("View Back ID"),
      'Must render View Back ID button'
    );
    assert.ok(
      pageContent.includes("handleViewImage('front')"),
      'Must handle viewing front ID image'
    );
    assert.ok(
      pageContent.includes("handleViewImage('back')"),
      'Must handle viewing back ID image'
    );
  });

  await t.test('95. Image viewer revokes temporary Blob URLs on close and component unmount', () => {
    assert.ok(
      pageContent.includes('URL.createObjectURL'),
      'Must create temporary browser object URL from authenticated Blob'
    );
    assert.ok(
      pageContent.includes('URL.revokeObjectURL'),
      'Must revoke object URL to prevent memory leaks'
    );
    assert.ok(
      pageContent.includes('activeBlobUrlRef'),
      'Must track active blob URL ref for reliable lifecycle cleanup'
    );
    assert.ok(
      pageContent.includes('cleanupBlob'),
      'Must provide cleanup function on close and unmount'
    );
  });

  await t.test('96. No auth token placed in image URLs; requests use authenticated Blob streaming', () => {
    // Image fetching must use api.get with responseType: 'blob'
    assert.ok(
      pageContent.includes("responseType: 'blob'"),
      'Must request binary blob through authenticated api client'
    );
    assert.ok(
      pageContent.includes('`/users/${user.id}/identity/${side}-image`'),
      'Must use authenticated REST endpoint rather than public URL'
    );

    // Invariant: never put bearer tokens into query strings
    assert.ok(
      !pageContent.includes('?token='),
      'Must NOT append auth tokens into query strings'
    );
    assert.ok(
      !pageContent.includes('?bearer='),
      'Must NOT append bearer tokens into query strings'
    );
  });

  await t.test('97. isCoordinator is strictly role === DIOCESE_COORDINATOR', () => {
    assert.ok(
      pageContent.includes("role === 'DIOCESE_COORDINATOR'"),
      'isCoordinator must strictly match DIOCESE_COORDINATOR role'
    );
    assert.ok(
      pageContent.includes("isCoordinator={role === 'DIOCESE_COORDINATOR'}"),
      'Must pass strict coordinator check into ParishionerProfileModal'
    );
  });

  await t.test('98. Unrelated User Management actions remain unchanged', () => {
    assert.ok(
      pageContent.includes('UserManagementService.getUsers'),
      'User fetching remains unchanged'
    );
    assert.ok(
      pageContent.includes('UserManagementService.addUser'),
      'Adding user remains unchanged'
    );
    assert.ok(
      pageContent.includes('UserManagementService.editUser'),
      'Editing user remains unchanged'
    );
    assert.ok(
      pageContent.includes('UserManagementService.disableUser'),
      'Disabling user remains unchanged'
    );
    assert.ok(
      pageContent.includes('UserManagementService.enableUser'),
      'Enabling user remains unchanged'
    );
    assert.ok(
      pageContent.includes('UserManagementService.resetPassword'),
      'Resetting password remains unchanged'
    );
  });
});
