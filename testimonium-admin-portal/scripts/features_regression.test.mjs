import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapDocumentStatusToBackend } from '../src/providers/api/documentStatusMapping.ts';
import { documentStatusGroups } from '../src/shared/documentAnalytics.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Admin Portal Features 1-7 Regression & Contract Suite', async (t) => {
  await t.test('Feature 1: Mother Parish admin UI contracts', () => {
    // Check types
    const typesPath = path.join(srcDir, 'types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    assert.ok(typesContent.includes('isMotherParish?: boolean;'), 'Parish type must expose isMotherParish');
    assert.equal(typesContent.includes('motherParishId'), false, 'Parish type must not expose a parent-parish relationship');

    // Check ParishManagementPage
    const pagePath = path.join(srcDir, 'pages/ParishManagementPage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    assert.ok(pageContent.includes('ep-is-mother-parish'), 'ParishManagementPage must render the Mother Parish toggle');
    assert.ok(pageContent.includes('isDioceseCoordinator'), 'ParishManagementPage must gate Mother Parish on isDioceseCoordinator');
    assert.equal(pageContent.includes("Mother Parish: {parish.isMotherParish ? 'Yes' : 'No'}"), false, 'Parish table must NOT show the old yes/no boolean designation');
    assert.equal(pageContent.includes("Mother Parish: No"), false, 'Parish table must NOT render Mother Parish: No');
    assert.equal(pageContent.includes("Mother Parish: Yes"), false, 'Parish table must NOT render Mother Parish: Yes');
    assert.ok(pageContent.includes("parish.isMotherParish &&"), 'Parish table must conditionally render designation for Mother Parish only');
    assert.ok(pageContent.includes("Mother Parish"), 'Parish table must render Mother Parish text when designated');
    assert.equal(pageContent.includes('Select mother parish'), false, 'Edit Parish must not expose a parish-selection dropdown');
    assert.equal(pageContent.includes('motherParishId'), false, 'Edit Parish must not retain a parent-parish field');

    // Check NewParishWizard
    const wizardPath = path.join(srcDir, 'components/parish-management/NewParishWizard.tsx');
    const wizardContent = fs.readFileSync(wizardPath, 'utf8');
    assert.ok(wizardContent.includes('parish-is-mother'), 'NewParishWizard must render the Mother Parish toggle');
    assert.ok(wizardContent.includes('isMotherParish: boolean;'), 'NewParishWizard must include isMotherParish in state');
    assert.ok(wizardContent.includes('Set as Mother Parish'), 'Both forms must use the requested designation label');
    assert.equal(wizardContent.includes('Select mother parish'), false, 'New Parish must not expose a parish-selection dropdown');
    assert.equal(wizardContent.includes('motherParishId'), false, 'New Parish must not retain a parent-parish field');
  });

  await t.test('Feature 5: Confirmed schedule priest reassignment warning contract', () => {
    const schedulePagePath = path.join(srcDir, 'pages/ScheduleRequestsPage.tsx');
    const content = fs.readFileSync(schedulePagePath, 'utf8');

    // Confirmed schedule reassignment warning text
    assert.ok(content.includes('Reassigning the priest for a Confirmed appointment will return this schedule to Pending'), 'Must show return-to-pending warning');
    assert.ok(content.includes('The new priest must accept the assignment before the schedule can be confirmed again'), 'Must show acceptance requirement warning');
    assert.ok(content.includes('setSelectedRequest(updated)'), 'Must update selected request immediately with canonical schedule');
  });

  await t.test('Feature 6: Priest read-only document requests permissions & controls', () => {
    const permPath = path.join(srcDir, 'permissions/permissions.ts');
    const permContent = fs.readFileSync(permPath, 'utf8');
    assert.ok(permContent.includes("MANAGE_DOCUMENT_REQUESTS: 'MANAGE_DOCUMENT_REQUESTS'"), 'Must define MANAGE_DOCUMENT_REQUESTS');

    const rolePermPath = path.join(srcDir, 'permissions/rolePermissions.ts');
    const roleContent = fs.readFileSync(rolePermPath, 'utf8');

    // Assigned to SECRETARY and DIOCESE_COORDINATOR, but NOT PRIEST
    const secretaryMatch = roleContent.match(/SECRETARY:\s*\[([\s\S]*?)\],/)?.[1] || '';
    assert.ok(secretaryMatch.includes('MANAGE_DOCUMENT_REQUESTS'), 'SECRETARY must have MANAGE_DOCUMENT_REQUESTS');

    const dcMatch = roleContent.match(/DIOCESE_COORDINATOR:\s*\[([\s\S]*?)\],/)?.[1] || '';
    assert.ok(dcMatch.includes('MANAGE_DOCUMENT_REQUESTS'), 'DIOCESE_COORDINATOR must have MANAGE_DOCUMENT_REQUESTS');

    const priestMatch = roleContent.match(/PRIEST:\s*\[([\s\S]*?)\],/)?.[1] || '';
    assert.ok(!priestMatch.includes('MANAGE_DOCUMENT_REQUESTS'), 'PRIEST must NOT have MANAGE_DOCUMENT_REQUESTS');
    assert.ok(priestMatch.includes('VIEW_DOCUMENT_REQUESTS'), 'PRIEST must keep VIEW_DOCUMENT_REQUESTS');

    assert.ok(roleContent.includes('export function canManageDocumentRequests'), 'Must export canManageDocumentRequests helper');

    // DocumentRequestsPage contract: read-only message and canManage gating
    const docPagePath = path.join(srcDir, 'pages/DocumentRequestsPage.tsx');
    const docContent = fs.readFileSync(docPagePath, 'utf8');
    assert.ok(docContent.includes('canManageDocumentRequests'), 'DocumentRequestsPage must check canManageDocumentRequests');
    assert.ok(docContent.includes('You have read-only access to document requests.'), 'DocumentRequestsPage must show read-only info banner');
    assert.match(docContent, /\{canManage\s*\?\s*\(/, 'DocumentRequestsPage must gate the mutation footer on canManage');
  });

  await t.test('Feature 7: Ready for Signing status enum, mapping, and badge', () => {
    // 1. DocumentStatus type includes 'Ready for Signing'
    const typesPath = path.join(srcDir, 'types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    assert.ok(typesContent.includes("'Ready for Signing'"), 'DocumentStatus union must include Ready for Signing');

    // 2. ApiDocumentProvider maps READY_FOR_SIGNING to 'Ready for Signing'
    const providerPath = path.join(srcDir, 'providers/api/ApiDocumentProvider.ts');
    const providerContent = fs.readFileSync(providerPath, 'utf8');
    assert.ok(providerContent.includes("case 'READY_FOR_SIGNING':"), 'ApiDocumentProvider must map READY_FOR_SIGNING');
    assert.ok(providerContent.includes("return 'Ready for Signing';"), 'ApiDocumentProvider must return Ready for Signing');

    // 3. StatusBadge styles 'Ready for Signing'
    const badgePath = path.join(srcDir, 'components/ui/StatusBadge.tsx');
    const badgeContent = fs.readFileSync(badgePath, 'utf8');
    assert.ok(badgeContent.includes("'Ready for Signing'"), 'StatusBadge must style Ready for Signing');

    // 4. DocumentRequestsPage next-action flow
    const docPagePath = path.join(srcDir, 'pages/DocumentRequestsPage.tsx');
    const docContent = fs.readFileSync(docPagePath, 'utf8');
    assert.ok(docContent.includes("'Ready for Signing'"), 'DocumentRequestsPage must support Ready for Signing filter');
    assert.ok(docContent.includes('Mark Ready for Signing'), 'DocumentRequestsPage must offer Mark Ready for Signing action');
    assert.ok(docContent.includes('Mark Ready for Pickup'), 'DocumentRequestsPage must offer Mark Ready for Pickup action');

    assert.equal(
      mapDocumentStatusToBackend('Ready for Signing'),
      'READY_FOR_SIGNING',
      'Provider filter mapping must send the canonical backend enum'
    );
    assert.deepEqual(
      documentStatusGroups.flatMap((group) => group.options).find((option) => option.value === 'READY_FOR_SIGNING'),
      { value: 'READY_FOR_SIGNING', label: 'Ready for Signing' },
      'Admin analytics must expose the internal status with a human-readable label'
    );
  });
});
