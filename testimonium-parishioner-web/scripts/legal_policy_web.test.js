import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrc = path.resolve(__dirname, '../src');

describe('Parishioner Web Dynamic Legal Policies Integration', () => {
  test('legalPolicyService.ts exports fetchCurrentLegalPolicies and useLegalPolicies', () => {
    const filePath = path.join(webSrc, 'services/legalPolicyService.ts');
    assert.ok(fs.existsSync(filePath), 'legalPolicyService.ts must exist');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /fetchCurrentLegalPolicies/, 'Must export fetchCurrentLegalPolicies');
    assert.match(content, /useLegalPolicies/, 'Must export useLegalPolicies');
    assert.match(content, /\/legal-policies\/current/, 'Must request /legal-policies/current');
  });

  test('TermsContent and PrivacyContent render plain text safely without dangerouslySetInnerHTML', () => {
    const termsPath = path.join(webSrc, 'components/legal/TermsContent.tsx');
    const privacyPath = path.join(webSrc, 'components/legal/PrivacyContent.tsx');
    const terms = fs.readFileSync(termsPath, 'utf-8');
    const privacy = fs.readFileSync(privacyPath, 'utf-8');

    assert.doesNotMatch(terms, /dangerouslySetInnerHTML/, 'TermsContent must not use dangerouslySetInnerHTML');
    assert.doesNotMatch(privacy, /dangerouslySetInnerHTML/, 'PrivacyContent must not use dangerouslySetInnerHTML');
    assert.match(terms, /whitespace-pre-wrap/, 'TermsContent must preserve line breaks using CSS whitespace-pre-wrap');
    assert.match(privacy, /whitespace-pre-wrap/, 'PrivacyContent must preserve line breaks using CSS whitespace-pre-wrap');
  });

  test('SignupPage uses dynamic policies and does not hardcode v1.0', () => {
    const signupPath = path.join(webSrc, 'pages/public/SignupPage.tsx');
    const content = fs.readFileSync(signupPath, 'utf-8');

    assert.match(content, /useLegalPolicies/, 'SignupPage must use useLegalPolicies');
    assert.match(content, /policies\.termsOfService\.version/, 'SignupPage must pass dynamic terms version');
    assert.match(content, /policies\.privacyPolicy\.version/, 'SignupPage must pass dynamic privacy version');
    assert.doesNotMatch(content, /termsVersion:\s*['"]v1\.0['"]/, 'SignupPage must not hardcode v1.0');
  });

  test('LoginPage passes dynamic legal payload from LegalAcceptanceModal', () => {
    const loginPath = path.join(webSrc, 'pages/public/LoginPage.tsx');
    const content = fs.readFileSync(loginPath, 'utf-8');

    assert.match(content, /onAccept=\{\(payload\) => handleExecuteGoogleSignIn\(payload\)\}/, 'LoginPage must pass dynamic payload to handleExecuteGoogleSignIn');
    assert.doesNotMatch(content, /termsVersion:\s*['"]v1\.0['"]/, 'LoginPage must not hardcode v1.0');
  });

  test('LegalGate gates unaccepted/stale policies with independent checkboxes and conflict handling', () => {
    const gatePath = path.join(webSrc, 'components/legal/LegalGate.tsx');
    assert.ok(fs.existsSync(gatePath), 'LegalGate.tsx must exist');
    const content = fs.readFileSync(gatePath, 'utf-8');

    assert.match(content, /recordLegalAcceptance/, 'LegalGate must call recordLegalAcceptance');
    assert.match(content, /LEGAL_ACCEPTANCE_VERSION_CONFLICT/, 'LegalGate must handle 409 conflict');
    assert.match(content, /logout/, 'LegalGate must offer Sign Out');
  });

  test('ProtectedRoute gates routes with LegalGate when acceptance is missing or stale', () => {
    const protectedPath = path.join(webSrc, 'components/ProtectedRoute.tsx');
    const content = fs.readFileSync(protectedPath, 'utf-8');

    assert.match(content, /LegalGate/, 'ProtectedRoute must import and render LegalGate');
    assert.match(content, /!appProfile\.termsAccepted\s*\|\|\s*!appProfile\.privacyAccepted/, 'ProtectedRoute must check termsAccepted and privacyAccepted');
  });
});
