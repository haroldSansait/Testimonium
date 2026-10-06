import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminSrc = path.resolve(__dirname, '../src');

describe('Admin Portal Legal Policy Management & Permissions Suite', () => {
  test('MANAGE_LEGAL_POLICIES permission is defined in permissions.ts', () => {
    const permPath = path.join(adminSrc, 'permissions/permissions.ts');
    const content = fs.readFileSync(permPath, 'utf-8');
    assert.match(content, /MANAGE_LEGAL_POLICIES/, 'MANAGE_LEGAL_POLICIES must be defined');
  });

  test('rolePermissions grants MANAGE_LEGAL_POLICIES only to DIOCESE_COORDINATOR', () => {
    const rolePath = path.join(adminSrc, 'permissions/rolePermissions.ts');
    const content = fs.readFileSync(rolePath, 'utf-8');
    assert.match(content, /canManageLegalPolicies/, 'canManageLegalPolicies helper must exist');
    assert.match(content, /DIOCESE_COORDINATOR:[\s\S]*?PERMISSIONS\.MANAGE_LEGAL_POLICIES/, 'Must be granted to DIOCESE_COORDINATOR');

    // Ensure it is NOT granted to SECRETARY or PRIEST
    const secretarySection = content.match(/SECRETARY:\s*\[([\s\S]*?)\]/);
    assert.ok(secretarySection, 'SECRETARY section must exist');
    assert.doesNotMatch(secretarySection[1], /MANAGE_LEGAL_POLICIES/, 'SECRETARY must NOT have MANAGE_LEGAL_POLICIES');

    const priestSection = content.match(/PRIEST:\s*\[([\s\S]*?)\]/);
    assert.ok(priestSection, 'PRIEST section must exist');
    assert.doesNotMatch(priestSection[1], /MANAGE_LEGAL_POLICIES/, 'PRIEST must NOT have MANAGE_LEGAL_POLICIES');
  });

  test('LegalPolicyService implements getManagePolicies and updatePolicy', () => {
    const servicePath = path.join(adminSrc, 'services/LegalPolicyService.ts');
    assert.ok(fs.existsSync(servicePath), 'LegalPolicyService.ts must exist');
    const content = fs.readFileSync(servicePath, 'utf-8');
    assert.match(content, /\/legal-policies\/manage/, 'Must call /legal-policies/manage');
    assert.match(content, /\/legal-policies\/\$\{policyType\}/, 'Must call PATCH /legal-policies/:policyType');
    assert.match(content, /expectedRevision/, 'Must pass expectedRevision');
  });

  test('LegalPoliciesEditor component implements plain text editing, CAS 409 handling, and metadata display', () => {
    const editorPath = path.join(adminSrc, 'components/settings/LegalPoliciesEditor.tsx');
    assert.ok(fs.existsSync(editorPath), 'LegalPoliciesEditor.tsx must exist');
    const content = fs.readFileSync(editorPath, 'utf-8');
    assert.match(content, /TERMS_OF_SERVICE/, 'Must handle TERMS_OF_SERVICE');
    assert.match(content, /PRIVACY_POLICY/, 'Must handle PRIVACY_POLICY');
    assert.match(content, /LEGAL_POLICY_VERSION_CONFLICT/, 'Must handle 409 conflict');
    assert.match(content, /textarea/, 'Must use plain text textarea');
    assert.match(content, /50000|50,000/, 'Must validate length <= 50,000 chars');
    assert.doesNotMatch(content, /dangerouslySetInnerHTML/, 'Must not use dangerouslySetInnerHTML');
  });

  test('SettingsPage integrates LegalPoliciesEditor tab guarded by canManageLegalPolicies', () => {
    const settingsPath = path.join(adminSrc, 'pages/SettingsPage.tsx');
    const content = fs.readFileSync(settingsPath, 'utf-8');
    assert.match(content, /LegalPoliciesEditor/, 'SettingsPage must import and render LegalPoliciesEditor');
    assert.match(content, /canManageLegalPolicies\(role\)/, 'SettingsPage must guard tab with canManageLegalPolicies');
    assert.match(content, /activeTab === 'legal'/, 'SettingsPage must support legal activeTab');
  });
});
