import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DOCUMENT_TYPES,
  DOCUMENT_TYPE_FILTER_OPTIONS,
  getCanonicalDocumentId,
  getDocumentLabel,
  getDocumentRequirementsLookupParams,
  getDocumentTypeFilterParam,
} from '../src/config/documents.ts';

const expectedMappings = [
  ['BAPTISMAL_CERTIFICATE', 'Baptismal Certificate'],
  ['CONFIRMATION_CERTIFICATE', 'Confirmation Certificate'],
  ['MARRIAGE_CERTIFICATE', 'Marriage Certificate'],
  ['FIRST_COMMUNION_CERTIFICATE', 'First Communion Certificate'],
  ['MARRIAGE_BANNS', 'Marriage Banns'],
  ['PERMIT_TO_MARRY', 'Permit to Marry'],
  ['STATUS_OF_LIBERTY', 'Status of Liberty Certificate'],
];

test('Admin document type mapping regression suite', async (t) => {
  await t.test('canonical config contains exactly the seven supported document types', () => {
    assert.deepEqual(
      CANONICAL_DOCUMENT_TYPES.map(({ id, label }) => [id, label]),
      expectedMappings
    );
  });

  await t.test('maps every backend canonical ID to its Admin label', () => {
    for (const [canonicalId, label] of expectedMappings) {
      assert.equal(getDocumentLabel(canonicalId), label);
    }
    assert.notEqual(getDocumentLabel('STATUS_OF_LIBERTY'), 'Baptismal Certificate');
    assert.notEqual(getDocumentLabel('FIRST_COMMUNION_CERTIFICATE'), 'Confirmation Certificate');
  });

  await t.test('maps every Admin label back to its backend canonical ID', () => {
    for (const [canonicalId, label] of expectedMappings) {
      assert.equal(getCanonicalDocumentId(label), canonicalId);
    }
  });

  await t.test('document request filter exposes all seven labels and submits canonical IDs', () => {
    assert.deepEqual(
      DOCUMENT_TYPE_FILTER_OPTIONS.map(({ label, value }) => [label, value]),
      expectedMappings.map(([, label]) => [label, label])
    );
    for (const [canonicalId, label] of expectedMappings) {
      assert.equal(getDocumentTypeFilterParam(label), canonicalId);
    }
    assert.equal(getDocumentTypeFilterParam('Status of Liberty Certificate'), 'STATUS_OF_LIBERTY');
    assert.equal(getDocumentTypeFilterParam('all'), undefined);
  });

  await t.test('Status of Liberty correction lookup uses the canonical backend type', () => {
    assert.deepEqual(
      getDocumentRequirementsLookupParams('Status of Liberty Certificate', '42'),
      { type: 'STATUS_OF_LIBERTY', parishId: '42' }
    );
  });

  await t.test('unexpected backend values remain visible and never impersonate a real type', () => {
    const unknownDisplay = getDocumentLabel('FUTURE_CANONICAL_DOCUMENT');
    assert.equal(unknownDisplay, 'Unknown Document Type (FUTURE_CANONICAL_DOCUMENT)');
    assert.equal(getCanonicalDocumentId(unknownDisplay), 'FUTURE_CANONICAL_DOCUMENT');
    assert.equal(
      expectedMappings.some(([, label]) => label === unknownDisplay),
      false
    );
  });
});
