import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getParishSettingsChanges } from '../src/utils/parishSettingsChanges.ts';
import { setCanonicalRequirementAssignment, getAssignedCanonicalRequirements } from '../src/config/documents.ts';
import { validateDocumentSettingsForSave } from '../../testimonium-backend/config/documents.js';

const page = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../src/components/settings/SchedulingAvailabilityEditor.tsx', import.meta.url), 'utf8');
function findNode(source, predicate) {
  const root = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  const visit = (node) => { if (predicate(node)) found = node; else ts.forEachChild(node, visit); };
  visit(root);
  assert.ok(found, 'Production save function must exist');
  return found.getText(root);
}
const handler = findNode(page, (n) => ts.isVariableDeclaration(n) && n.name.getText() === 'handleSaveSettings');
const compile = (source, context) => runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const plain = (value) => JSON.parse(JSON.stringify(value));
function baseline() {
  return { documentSettings: {
    BAPTISMAL_CERTIFICATE: { price: 120, requirements: { valid_id: false, gkk_endorsement: true, endorsement_letter: false } },
    ENDORSEMENT: { price: 75, requirements: { historical: true } },
    paymentMethods: { gcash: true, maya: false },
  }, eventSettings: { FUNERAL: { requirements: { death_cert: true } } }, officeHours: {},
  availableDocuments: ['BAPTISMAL_CERTIFICATE'], paymentQrEnabled: true, paymentQrImage: '/qr.png', venueCapacity: 100 };
}
function harness(changes = {}, options = {}) {
  const original = baseline();
  const calls = []; const toasts = [];
  const context = { ...structuredClone(original), ...changes, originalSnapshot: structuredClone(original),
    selectedParishId: '2', canEditScheduling: true, saving: false, schedulingRulesDirty: changes.schedulingRulesDirty ?? false,
    getParishSettingsChanges, console: { error() {} },
    validateOfficeHours: () => null,
    setSaving(value) { context.saving = value; },
    setToast(value) { toasts.push(value); },
    setParishes(fn) { context.parishes = fn(context.parishes); },
    setOriginalSnapshot(fn) { context.originalSnapshot = fn(context.originalSnapshot); },
    parishes: [{ id: '2', ...structuredClone(original) }, { id: '3', ...structuredClone(original) }],
    schedulingEditorRef: { current: {
      hasUnsavedDateException: () => false,
      async save(eventSettings, officeHours) {
        calls.push({ kind: 'scheduling', eventSettings: plain(eventSettings), officeHours: plain(officeHours) });
        if (options.schedulingError) throw options.schedulingError;
        context.schedulingRulesDirty = false;
      },
    } },
    ParishManagementService: { async editParishSettings(id, payload) {
      calls.push({ kind: 'parish', id, payload: plain(payload) });
      if (options.parishError) throw options.parishError;
      if (payload.documentSettings) validateDocumentSettingsForSave(payload.documentSettings, original.documentSettings);
      options.onParishSave?.(context);
      return { availableDocuments: original.availableDocuments };
    } },
  };
  const save = compile(`(() => { const ${handler}; return handleSaveSettings; })();`, context);
  return { save, context, calls, toasts, original };
}

test('Funeral disable and re-enable save only scheduling despite legacy document settings', async () => {
  const h = harness({ eventSettings: { FUNERAL: { requirements: { death_cert: false } } } });
  await h.save();
  assert.deepEqual(h.calls.map((c) => c.kind), ['scheduling']);
  assert.equal(h.calls[0].eventSettings.FUNERAL.requirements.death_cert, false);
  assert.deepEqual(h.context.documentSettings, h.original.documentSettings);
  assert.equal(h.toasts.at(-1).type, 'success');
  // A new render captures the re-enabled value and the just-saved baseline.
  h.context.eventSettings = h.original.eventSettings;
  await compile(`(() => { const ${handler}; return handleSaveSettings; })();`, h.context)();
  assert.equal(h.calls[1].eventSettings.FUNERAL.requirements.death_cert, true);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(plain(h.context.parishes[1]), { id: '3', ...h.original });
});

test('each general section saves independently; availability, event settings and hours use scheduling', async () => {
  for (const [key, value] of Object.entries({ availableDocuments: [], paymentQrEnabled: false, paymentQrImage: null, venueCapacity: 250 })) {
    const h = harness({ [key]: value });
    h.context.schedulingEditorRef.current = null;
    await h.save();
    assert.deepEqual(h.calls, [{ kind: 'parish', id: '2', payload: { [key]: value } }]);
    assert.equal(h.toasts.at(-1).type, 'success');
  }
  for (const changes of [{ officeHours: { Monday: { isClosed: true } } }, { eventSettings: {} }, { schedulingRulesDirty: true }]) {
    const h = harness(changes); await h.save();
    assert.deepEqual(h.calls.map((c) => c.kind), ['scheduling']);
  }
});

test('canonical toggles including endorsement_letter preserve legacy entries and explicit false', async () => {
  for (const req of ['valid_id', 'endorsement_letter', 'baptismal_cert']) {
    for (const enabled of [true, false]) {
      const docs = setCanonicalRequirementAssignment(baseline().documentSettings, 'BAPTISMAL_CERTIFICATE', req, enabled);
      const h = harness({ documentSettings: docs });
      h.context.originalSnapshot.documentSettings = setCanonicalRequirementAssignment(h.original.documentSettings, 'BAPTISMAL_CERTIFICATE', req, !enabled);
      await h.save();
      assert.deepEqual(h.calls.map((c) => c.kind), ['parish']);
      assert.equal(h.toasts.at(-1).type, 'success');
      assert.equal(h.context.documentSettings.BAPTISMAL_CERTIFICATE.requirements.gkk_endorsement, true);
      assert.deepEqual(h.context.documentSettings.ENDORSEMENT, h.original.documentSettings.ENDORSEMENT);
      assert.equal(getAssignedCanonicalRequirements('BAPTISMAL_CERTIFICATE', docs).some((r) => r.id === req), enabled);
    }
  }
});

test('mixed saves preserve every changed section and advance only successful baselines', async () => {
  const changes = { documentSettings: setCanonicalRequirementAssignment(baseline().documentSettings, 'BAPTISMAL_CERTIFICATE', 'endorsement_letter', true),
    availableDocuments: [], paymentQrEnabled: false, paymentQrImage: null, venueCapacity: 300,
    eventSettings: { FUNERAL: { requirements: { death_cert: false } } }, officeHours: { Monday: { isClosed: true } } };
  const h = harness(changes); await h.save();
  assert.deepEqual(h.calls.map((c) => c.kind), ['parish', 'scheduling']);
  assert.deepEqual(plain(h.context.originalSnapshot), { ...h.original, ...changes });
  const failed = harness(changes, { schedulingError: new Error('Scheduling unavailable') }); await failed.save();
  assert.equal(failed.toasts.at(-1).type, 'error');
  assert.match(failed.toasts.at(-1).message, /General parish settings saved, but scheduling changes were not saved/);
  assert.deepEqual(plain(failed.context.originalSnapshot.eventSettings), failed.original.eventSettings);
  assert.deepEqual(failed.context.eventSettings, changes.eventSettings);
  assert.deepEqual(plain(failed.context.originalSnapshot.documentSettings), changes.documentSettings);
});

test('failed saves and stale conflicts preserve edits and never announce success', async () => {
  for (const error of [new Error('Unavailable'), Object.assign(new Error('Reload latest configuration'), { status: 409, code: 'SCHEDULING_CONFIG_STALE' })]) {
    const h = harness({ eventSettings: { FUNERAL: { requirements: { death_cert: false } } } }, { schedulingError: error });
    await h.save();
    assert.equal(h.toasts.some((t) => t.type === 'success'), false);
    assert.deepEqual(plain(h.context.originalSnapshot), h.original);
    assert.equal(h.context.eventSettings.FUNERAL.requirements.death_cert, false);
  }
  const h = harness({ paymentQrEnabled: false, eventSettings: {} }, { parishError: new Error('Save failed') });
  await h.save();
  assert.equal(h.calls.length, 1); assert.equal(h.toasts.at(-1).type, 'error');
  assert.deepEqual(plain(h.context.originalSnapshot), h.original);
  assert.equal(h.context.paymentQrEnabled, false);
});

test('edits made while awaiting a save remain unsaved; loading and date drafts block scheduling', async () => {
  const h = harness({ venueCapacity: 200 }, { onParishSave: (ctx) => { ctx.venueCapacity = 300; } });
  await h.save(); assert.equal(h.context.venueCapacity, 300); assert.equal(h.context.originalSnapshot.venueCapacity, 200);
  for (const mode of ['loading', 'draft']) {
    const blocked = harness({ eventSettings: {} });
    if (mode === 'loading') blocked.context.schedulingEditorRef.current = null;
    else blocked.context.schedulingEditorRef.current.hasUnsavedDateException = () => true;
    await blocked.save(); assert.equal(blocked.calls.length, 0); assert.equal(blocked.toasts.at(-1).type, 'error');
  }
});

test('actual availability save keeps expected version and weekly drafts on failure', async () => {
  const method = findNode(editor, (n) => ts.isMethodDeclaration(n) && n.name.getText() === 'save');
  const expected = Object.assign(new Error('Stale'), { status: 409, code: 'SCHEDULING_CONFIG_STALE' });
  const context = { serverBaseline: { schedulingConfigVersion: 8 }, draftParishRules: Array(7).fill({}), draftServiceRules: [],
    WEEKDAYS: Array(7).fill({}), parishId: '2', scheduleAvailabilityApi: { async replaceWeekdayRules(id, payload) {
      assert.equal(id, '2'); assert.equal(payload.expectedVersion, 8); throw expected;
    } }, handleConflict() { assert.fail('must not discard drafts on 409'); },
    setServerBaseline() { assert.fail('must retain baseline'); }, setDraftParishRules() { assert.fail('must retain weekly edits'); },
    setDraftServiceRules() { assert.fail('must retain service edits'); },
  };
  const save = compile(`({ ${method} }).save;`, context);
  await assert.rejects(save({}, {}), (e) => e === expected);
});
