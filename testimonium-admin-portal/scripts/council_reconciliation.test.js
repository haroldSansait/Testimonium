import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeCouncilMembers,
  areCouncilSnapshotsEqual,
  shouldReconcileAsSaved,
  createFinanceDraftMember,
  ensureFinanceDraftForEnabledState,
} from '../src/utils/councilReconciliation.ts';

test('Council Reconciliation and state helpers audit', async (t) => {
  await t.test('normalizeCouncilMembers handles empty, null, and undefined safely', () => {
    assert.deepEqual(normalizeCouncilMembers(undefined), []);
    assert.deepEqual(normalizeCouncilMembers(null), []);
    assert.deepEqual(normalizeCouncilMembers([]), []);
    assert.deepEqual(
      normalizeCouncilMembers([
        { positionTitle: '  Coordinator  ', memberName: '  John Doe  ' },
        { positionTitle: undefined, memberName: undefined },
        { positionTitle: null, memberName: null },
      ]),
      [
        { positionTitle: 'Coordinator', memberName: 'John Doe' },
        { positionTitle: '', memberName: '' },
        { positionTitle: '', memberName: '' },
      ]
    );
  });

  await t.test('areCouncilSnapshotsEqual handles null/undefined inputs and equality checks', () => {
    assert.equal(areCouncilSnapshotsEqual(null, null), false);
    assert.equal(areCouncilSnapshotsEqual(null, {}), false);
    assert.equal(areCouncilSnapshotsEqual({}, null), false);

    const snapA = {
      financeCouncilEnabled: true,
      pastoralCouncilMembers: [{ positionTitle: 'Coordinator', memberName: 'John' }],
      financeCouncilMembers: [{ positionTitle: 'Treasurer', memberName: 'Jane' }],
    };
    const snapB = {
      financeCouncilEnabled: true,
      pastoralCouncilMembers: [{ positionTitle: ' Coordinator ', memberName: ' John ' }],
      financeCouncilMembers: [{ positionTitle: ' Treasurer ', memberName: ' Jane ' }],
    };
    assert.equal(areCouncilSnapshotsEqual(snapA, snapB), true);

    const snapC = { ...snapA, financeCouncilEnabled: false };
    assert.equal(areCouncilSnapshotsEqual(snapA, snapC), false);
  });

  await t.test('isDirty calculation during PFC toggle OFF -> ON -> OFF', () => {
    const baseline = {
      version: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [{ positionTitle: 'President', memberName: 'Father Joe' }],
      financeCouncilMembers: [],
    };

    let draft = {
      version: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [{ positionTitle: 'President', memberName: 'Father Joe' }],
      financeCouncilMembers: [],
    };

    const computeIsDirty = (b, c) => {
      if (!b) return false;
      return (
        c.financeCouncilEnabled !== b.financeCouncilEnabled ||
        JSON.stringify((c.pastoralCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) !==
          JSON.stringify((b.pastoralCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) ||
        JSON.stringify((c.financeCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) !==
          JSON.stringify((b.financeCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() })))
      );
    };

    assert.equal(computeIsDirty(baseline, draft), false);

    // Toggle PFC ON (zero members) -> dirty must be true
    draft.financeCouncilEnabled = true;
    assert.equal(computeIsDirty(baseline, draft), true);

    // Toggle PFC back OFF -> dirty must return to false
    draft.financeCouncilEnabled = false;
    assert.equal(computeIsDirty(baseline, draft), false);
  });

  await t.test('PFC toggle ON with zero members validates without throwing', () => {
    const pastoralMembers = [{ positionTitle: 'PPC Lead', memberName: 'Alice' }];
    const financeCouncilEnabled = true;
    const financeMembers = [];

    const duplicatePastoralIndices = new Set();
    const duplicateFinanceIndices = new Set();

    const computeValidationError = (pastoral, enabled, finance, dupP, dupF) => {
      const pList = pastoral || [];
      const fList = finance || [];

      for (let i = 0; i < pList.length; i++) {
        const pos = (pList[i]?.positionTitle || '').trim();
        const name = (pList[i]?.memberName || '').trim();
        if (!pos) return `PPC member #${i + 1} is missing a position/title.`;
        if (!name) return `PPC member #${i + 1} is missing a name.`;
      }
      if (dupP.size > 0) {
        return 'Pastoral Council has duplicate member entries with the exact same name and position.';
      }

      if (enabled) {
        if (fList.length === 0) {
          return 'At least 1 Finance Council member is required when the Finance Council is enabled.';
        }
        for (let i = 0; i < fList.length; i++) {
          const pos = (fList[i]?.positionTitle || '').trim();
          const name = (fList[i]?.memberName || '').trim();
          if (!pos) return `PFC member #${i + 1} is missing a position/title.`;
          if (!name) return `PFC member #${i + 1} is missing a name.`;
        }
        if (dupF.size > 0) {
          return 'Finance Council has duplicate member entries with the exact same name and position.';
        }
      }

      return null;
    };

    const err = computeValidationError(
      pastoralMembers,
      financeCouncilEnabled,
      financeMembers,
      duplicatePastoralIndices,
      duplicateFinanceIndices
    );

    assert.equal(err, 'At least 1 Finance Council member is required when the Finance Council is enabled.');
  });

  await t.test('PFC Preserved draft maintains member list across OFF -> ON -> OFF -> ON transitions', () => {
    const baseline = {
      version: 2,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [{ positionTitle: 'Coordinator', memberName: 'Mario' }],
      financeCouncilMembers: [{ id: '10', positionTitle: 'Treasurer', memberName: 'Luigi' }],
    };

    // Loaded from baseline
    let state = {
      version: baseline.version,
      financeCouncilEnabled: baseline.financeCouncilEnabled,
      pastoralMembers: [...baseline.pastoralCouncilMembers],
      financeMembers: [...baseline.financeCouncilMembers],
    };

    assert.equal(state.financeCouncilEnabled, false);
    assert.equal(state.financeMembers.length, 1);

    // Toggle PFC ON
    state.financeCouncilEnabled = true;
    assert.equal(state.financeCouncilEnabled, true);
    assert.equal(state.financeMembers.length, 1);
    assert.equal(state.financeMembers[0].positionTitle, 'Treasurer');

    // Add a new draft member
    state.financeMembers.push({ positionTitle: 'Auditor', memberName: 'Peach' });
    assert.equal(state.financeMembers.length, 2);

    // Toggle PFC OFF
    state.financeCouncilEnabled = false;
    assert.equal(state.financeCouncilEnabled, false);
    // Preserved rows must not be lost
    assert.equal(state.financeMembers.length, 2);

    // Toggle PFC back ON
    state.financeCouncilEnabled = true;
    assert.equal(state.financeCouncilEnabled, true);
    assert.equal(state.financeMembers.length, 2);
    assert.equal(state.financeMembers[1].memberName, 'Peach');
  });

  await t.test('shouldReconcileAsSaved handles ambiguous save reconciliation', () => {
    const payload = {
      expectedVersion: 1,
      financeCouncilEnabled: true,
      pastoralCouncilMembers: [{ positionTitle: 'Lead', memberName: 'John' }],
      financeCouncilMembers: [{ positionTitle: 'Treasurer', memberName: 'Jane' }],
    };
    const baseline = {
      version: 1,
      financeCouncilEnabled: false,
      pastoralCouncilMembers: [{ positionTitle: 'Lead', memberName: 'John' }],
      financeCouncilMembers: [],
    };
    const freshMatching = {
      parishId: '1',
      version: 2,
      financeCouncilEnabled: true,
      pastoralCouncilMembers: [{ positionTitle: 'Lead', memberName: 'John' }],
      financeCouncilMembers: [{ positionTitle: 'Treasurer', memberName: 'Jane' }],
    };

    assert.equal(shouldReconcileAsSaved(1, payload, baseline, freshMatching), true);

    const freshWrongVersion = { ...freshMatching, version: 3 };
    assert.equal(shouldReconcileAsSaved(1, payload, baseline, freshWrongVersion), false);
  });

  await t.test('ensureFinanceDraftForEnabledState guarantees invariant when PFC enabled', () => {
    // createFinanceDraftMember generates unique draft shape
    const draftItem = createFinanceDraftMember();
    assert.ok(draftItem.id && typeof draftItem.id === 'string');
    assert.equal(draftItem.positionTitle, '');
    assert.equal(draftItem.memberName, '');

    // When enabled with 0 members -> returns 1 empty draft
    const draftWhenZero = ensureFinanceDraftForEnabledState(true, []);
    assert.equal(draftWhenZero.length, 1);
    assert.ok(draftWhenZero[0].id && typeof draftWhenZero[0].id === 'string');
    assert.equal(draftWhenZero[0].positionTitle, '');
    assert.equal(draftWhenZero[0].memberName, '');

    // When enabled with existing members -> preserves without extra rows
    const existing = [{ id: 'pfc-1', positionTitle: 'Treasurer', memberName: 'Jane' }];
    const preserved = ensureFinanceDraftForEnabledState(true, existing);
    assert.equal(preserved.length, 1);
    assert.equal(preserved[0].id, 'pfc-1');

    // When disabled -> allows 0 members
    const disabledEmpty = ensureFinanceDraftForEnabledState(false, []);
    assert.equal(disabledEmpty.length, 0);

    // When disabled with members -> preserves them
    const disabledWithMembers = ensureFinanceDraftForEnabledState(false, existing);
    assert.equal(disabledWithMembers.length, 1);
    assert.equal(disabledWithMembers[0].id, 'pfc-1');
  });
});

