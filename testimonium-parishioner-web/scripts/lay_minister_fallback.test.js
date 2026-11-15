import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrc = path.resolve(__dirname, '../src');

const read = (relativePath) => fs.readFileSync(path.join(webSrc, relativePath), 'utf8');

describe('Lay Minister fallback Web integration', () => {
  test('maps server-authored presentation and proposal state', () => {
    const scheduler = read('providers/api/scheduler.ts');

    assert.match(scheduler, /s\.effectiveDisplayTitle\s*\|\|/);
    assert.match(scheduler, /layMinisterAssigned:\s*Boolean\(s\.layMinisterAssigned\)/);
    assert.match(scheduler, /canProposeAlternativeDate:\s*Boolean\(s\.canProposeAlternativeDate\)/);
    assert.match(scheduler, /alternativeProposal:\s*s\.alternativeProposal\s*\|\|\s*null/);
  });

  test('uses dedicated submit and withdraw proposal endpoints with revision protection', () => {
    const scheduler = read('providers/api/scheduler.ts');

    assert.match(scheduler, /\/alternative-proposals`/);
    assert.match(scheduler, /\/alternative-proposals\/\$\{proposalId\}\/withdraw/);
    assert.match(scheduler, /\{ expectedRevision \}/);
  });

  test('shows Lay Minister designation and alternative-date controls in Track Status view', () => {
    const tracking = read('pages/dashboard/RequestTrackingPage.tsx');

    assert.equal(fs.existsSync(path.join(webSrc, 'pages/dashboard/ScheduleDetailPage.tsx')), false);
    assert.match(tracking, /Lay Minister assignment/);
    assert.match(tracking, /proposeAlternativeDate/);
    assert.match(tracking, /withdrawAlternativeDate/);
    assert.match(tracking, /Lay Minister fallback/);
    assert.match(tracking, /Service Leader Assigned/);
    assert.match(tracking, /no priest acceptance is required/);
  });
});
