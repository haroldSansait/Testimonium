import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_DOCUMENT_TYPES,
  CANONICAL_REQUIREMENTS,
  getAssignedCanonicalRequirements,
  getAvailableCanonicalRequirements,
  setCanonicalRequirementAssignment,
} from '../src/config/documents.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Admin Portal — Document Requirement Assignment Management Suite', async (t) => {
  const pagePath = path.join(srcDir, 'pages/SettingsPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  const simulateAddRequirement = (docId, reqId, docSettings) => {
    return setCanonicalRequirementAssignment(docSettings, docId, reqId, true);
  };

  const simulateRemoveRequirement = (docId, reqId, docSettings) => {
    return setCanonicalRequirementAssignment(docSettings, docId, reqId, false);
  };

  await t.test('20. Existing assigned requirements render correctly from defaults & overrides', () => {
    // A. Defaults with no explicit override
    const defaultSettings = {
      BAPTISMAL_CERTIFICATE: { price: 100, requirements: {} },
    };
    const assignedDefault = getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', defaultSettings);
    assert.equal(assignedDefault.length, 1);
    assert.equal(assignedDefault[0].id, 'valid_id');

    // B. Explicit saved settings with additional requirement
    const customSettings = {
      BAPTISMAL_CERTIFICATE: {
        price: 120,
        requirements: { valid_id: true, baptismal_cert: true },
      },
    };
    const assignedCustom = getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', customSettings);
    assert.equal(assignedCustom.length, 2);
    const ids = assignedCustom.map((r) => r.id);
    assert.ok(ids.includes('valid_id'));
    assert.ok(ids.includes('baptismal_cert'));
  });

  await t.test('21. Add Requirement shows only canonical existing requirements', () => {
    // Only canonical IDs are present in CANONICAL_REQUIREMENTS
    const expectedCanonicalIds = [
      'valid_id',
      'baptismal_cert',
      'confirmation_cert',
      'marriage_license',
      'precana_proof',
      'cenomar',
      'banns_clearance',
      'canonical_interview',
    ];
    assert.equal(CANONICAL_REQUIREMENTS.length, 8);
    for (const req of CANONICAL_REQUIREMENTS) {
      assert.ok(expectedCanonicalIds.includes(req.id), `ID ${req.id} must be canonical`);
      assert.ok(req.label && req.label.trim().length > 0);
      assert.ok(
        CANONICAL_DOCUMENT_TYPES.some((doc) => doc.requirements.includes(req)),
        `Requirement ${req.id} must reuse an existing definition`
      );
    }
    assert.throws(
      () => setCanonicalRequirementAssignment({}, 'BAPTISMAL_CERTIFICATE', 'custom_requirement', true),
      /Unknown canonical requirement/
    );
  });

  await t.test('22. Already assigned requirements are excluded from selector choices', () => {
    const docSettings = {
      BAPTISMAL_CERTIFICATE: {
        price: 100,
        requirements: { valid_id: true, cenomar: true },
      },
    };
    const available = getAvailableCanonicalRequirements('BAPTISMAL_CERTIFICATE', docSettings);
    const availableIds = available.map((r) => r.id);

    assert.ok(!availableIds.includes('valid_id'), 'valid_id must be excluded');
    assert.ok(!availableIds.includes('cenomar'), 'cenomar must be excluded');
    assert.equal(available.length, 6); // 8 - 2 assigned
  });

  await t.test('23. Selecting requirement sets it to true', () => {
    let docSettings = {
      BAPTISMAL_CERTIFICATE: {
        price: 100,
        requirements: { valid_id: true },
      },
    };

    docSettings = simulateAddRequirement('BAPTISMAL_CERTIFICATE', 'precana_proof', docSettings);
    assert.strictEqual(
      docSettings.BAPTISMAL_CERTIFICATE.requirements.precana_proof,
      true,
      'Requirement must be set strictly to boolean true'
    );

    const assigned = getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', docSettings);
    assert.ok(assigned.some((r) => r.id === 'precana_proof'));
  });

  await t.test('24. Remove sets requirement to false (not deleted from catalog)', () => {
    let docSettings = {
      BAPTISMAL_CERTIFICATE: {
        price: 100,
        requirements: { valid_id: true, precana_proof: true },
      },
    };

    docSettings = simulateRemoveRequirement('BAPTISMAL_CERTIFICATE', 'precana_proof', docSettings);
    assert.strictEqual(
      docSettings.BAPTISMAL_CERTIFICATE.requirements.precana_proof,
      false,
      'Requirement must be set strictly to boolean false'
    );

    const assigned = getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', docSettings);
    assert.ok(!assigned.some((r) => r.id === 'precana_proof'), 'precana_proof must no longer be assigned');
  });

  await t.test('25. Removed requirement can be re-added', () => {
    let docSettings = {
      BAPTISMAL_CERTIFICATE: {
        price: 100,
        requirements: { valid_id: true, precana_proof: false },
      },
    };

    // Since precana_proof is false (unassigned), it appears in available choices
    const available = getAvailableCanonicalRequirements('BAPTISMAL_CERTIFICATE', docSettings);
    assert.ok(available.some((r) => r.id === 'precana_proof'), 'Removed requirement must be available to re-add');

    // Re-add
    docSettings = simulateAddRequirement('BAPTISMAL_CERTIFICATE', 'precana_proof', docSettings);
    assert.strictEqual(docSettings.BAPTISMAL_CERTIFICATE.requirements.precana_proof, true);
    const assigned = getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', docSettings);
    assert.ok(assigned.some((r) => r.id === 'precana_proof'));
  });

  await t.test('26. No custom/free-text creation exists in SettingsPage', () => {
    // Assert no custom text input for requirement creation
    assert.ok(!pageContent.includes('Create Requirement'), 'No Create Requirement button');
    assert.ok(!pageContent.includes('New Requirement'), 'No New Requirement button');
    assert.ok(!pageContent.includes('Custom Requirement'), 'No Custom Requirement option');
    assert.ok(pageContent.includes('Select requirement to add...'), 'Selector uses predetermined canonical choices');
  });

  await t.test('27. Save payload retains existing prices and unrelated settings', () => {
    const initialSettings = {
      paymentMethods: { gcash: true, maya: false },
      BAPTISMAL_CERTIFICATE: {
        price: 250,
        customNote: 'Preserve this note',
        requirements: { valid_id: true },
      },
    };

    // When modifying requirement
    const updated = simulateAddRequirement('BAPTISMAL_CERTIFICATE', 'baptismal_cert', initialSettings);

    assert.equal(updated.paymentMethods.gcash, true);
    assert.equal(updated.BAPTISMAL_CERTIFICATE.price, 250);
    assert.equal(updated.BAPTISMAL_CERTIFICATE.customNote, 'Preserve this note');
    assert.equal(updated.BAPTISMAL_CERTIFICATE.requirements.baptismal_cert, true);
  });

  await t.test('28. Failed save preserves current local edits in SettingsPage', () => {
    // In SettingsPage.tsx handleSaveSettings:
    // Verify that catch block updates toast with err message and does NOT reset documentSettings
    assert.ok(pageContent.includes("setToast({ message: err?.response?.data?.message || err?.message"));
    // Ensure setDocumentSettings is NOT called with originalSnapshot in handleSaveSettings catch block
    const saveMethodSection = pageContent.slice(
      pageContent.indexOf('const handleSaveSettings = async () => {'),
      pageContent.indexOf('if (loading) {')
    );
    assert.ok(!saveMethodSection.includes('setDocumentSettings(originalSnapshot.documentSettings)'));
  });
});
