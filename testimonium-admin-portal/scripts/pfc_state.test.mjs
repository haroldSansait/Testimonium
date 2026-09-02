import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureFinanceDraftForEnabledState,
  createFinanceDraftMember,
} from '../src/utils/councilReconciliation.ts';

function handleFinanceEnabledChange(enabled, currentMembers) {
  return {
    enabled,
    members: ensureFinanceDraftForEnabledState(enabled, currentMembers),
  };
}

function handleRemoveMember(enabled, members, index) {
  const remaining = members.filter((_, i) => i !== index);
  return ensureFinanceDraftForEnabledState(enabled, remaining);
}

function computeValidationError(pastoralMembers, financeCouncilEnabled, financeMembers) {
  const pastoral = pastoralMembers || [];
  const finance = financeMembers || [];

  for (let i = 0; i < pastoral.length; i++) {
    const pos = (pastoral[i]?.positionTitle || '').trim();
    const name = (pastoral[i]?.memberName || '').trim();
    if (!pos) return `PPC member #${i + 1} is missing a position/title.`;
    if (!name) return `PPC member #${i + 1} is missing a name.`;
  }

  if (financeCouncilEnabled) {
    if (finance.length === 0) {
      return 'At least 1 Finance Council member is required when the Finance Council is enabled.';
    }
    for (let i = 0; i < finance.length; i++) {
      const pos = (finance[i]?.positionTitle || '').trim();
      const name = (finance[i]?.memberName || '').trim();
      if (!pos) return `PFC member #${i + 1} is missing a position/title.`;
      if (!name) return `PFC member #${i + 1} is missing a name.`;
    }
  }

  return null;
}

test('A. enabled=false with financeMembers=[] -> toggle ON creates 1 complete empty draft row', () => {
  let enabled = false;
  let financeMembers = [];

  const next = handleFinanceEnabledChange(true, financeMembers);
  enabled = next.enabled;
  financeMembers = next.members;

  assert.equal(enabled, true);
  assert.equal(financeMembers.length, 1);
  assert.ok(financeMembers[0].id && typeof financeMembers[0].id === 'string');
  assert.equal(financeMembers[0].positionTitle, '');
  assert.equal(financeMembers[0].memberName, '');
});

test('B. enabled=false with financeMembers=[existing member] -> toggle ON preserves row without extra blank member', () => {
  let enabled = false;
  let financeMembers = [{ id: 'pfc-101', positionTitle: 'Treasurer', memberName: 'Jane Dela Cruz' }];

  const next = handleFinanceEnabledChange(true, financeMembers);
  enabled = next.enabled;
  financeMembers = next.members;

  assert.equal(enabled, true);
  assert.equal(financeMembers.length, 1);
  assert.equal(financeMembers[0].id, 'pfc-101');
  assert.equal(financeMembers[0].positionTitle, 'Treasurer');
  assert.equal(financeMembers[0].memberName, 'Jane Dela Cruz');
});

test('C. enabled=true with one member -> toggle OFF preserves members -> toggle ON restores same members', () => {
  let enabled = true;
  let financeMembers = [{ id: 'pfc-101', positionTitle: 'Coordinator', memberName: 'Robert Smith' }];

  // Toggle OFF
  const offNext = handleFinanceEnabledChange(false, financeMembers);
  enabled = offNext.enabled;
  financeMembers = offNext.members;

  assert.equal(enabled, false);
  assert.equal(financeMembers.length, 1);
  assert.equal(financeMembers[0].memberName, 'Robert Smith');

  // Toggle back ON
  const onNext = handleFinanceEnabledChange(true, financeMembers);
  enabled = onNext.enabled;
  financeMembers = onNext.members;

  assert.equal(enabled, true);
  assert.equal(financeMembers.length, 1);
  assert.equal(financeMembers[0].id, 'pfc-101');
  assert.equal(financeMembers[0].positionTitle, 'Coordinator');
  assert.equal(financeMembers[0].memberName, 'Robert Smith');
});

test('D. enabled=true with one member -> remove final member immediately yields one new complete blank draft', () => {
  const enabled = true;
  const financeMembers = [{ id: 'pfc-101', positionTitle: 'Treasurer', memberName: 'Jane' }];

  const afterRemove = handleRemoveMember(enabled, financeMembers, 0);

  assert.equal(afterRemove.length, 1);
  assert.notEqual(afterRemove[0].id, 'pfc-101');
  assert.ok(afterRemove[0].id && typeof afterRemove[0].id === 'string');
  assert.equal(afterRemove[0].positionTitle, '');
  assert.equal(afterRemove[0].memberName, '');
});

test('E. empty draft row -> Save remains invalid', () => {
  const pastoral = [{ positionTitle: 'PPC Head', memberName: 'Father Mark' }];
  const financeCouncilEnabled = true;
  const financeMembers = [createFinanceDraftMember()]; // empty position and name

  const err = computeValidationError(pastoral, financeCouncilEnabled, financeMembers);
  assert.equal(err, 'PFC member #1 is missing a position/title.');
  const isSaveDisabled = Boolean(err);
  assert.equal(isSaveDisabled, true);
});

test('F. filled valid draft row -> normal existing Save eligibility applies', () => {
  const pastoral = [{ positionTitle: 'PPC Head', memberName: 'Father Mark' }];
  const financeCouncilEnabled = true;
  const financeMembers = [{ id: 'pfc-new', positionTitle: 'Auditor', memberName: 'Maria Santos' }];

  const err = computeValidationError(pastoral, financeCouncilEnabled, financeMembers);
  assert.equal(err, null);
  const isSaveDisabled = Boolean(err);
  assert.equal(isSaveDisabled, false);
});
