import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getParishSettingsChanges } from '../src/utils/parishSettingsChanges.ts';
import {
  bulkToggleServiceSettings,
  getEnabledServiceIds,
  hasExplicitServiceList,
  prepareSchedulingSettingsForSave,
  toggleServiceSetting,
  validateSchedulingDraftForSave,
} from '../src/utils/schedulingServiceSettings.ts';

// Mirrors the backend contract in testimonium-backend/services/SchedulingConfiguration.js
// (importing it directly pulls in the database config, which tests must not require).
const backendRejects = (s) => !Array.isArray(s.availableEvents) ? 'Enabled scheduling services must be provided as a list.'
  : !Array.isArray(s.timeSlots) ? 'Scheduling time slots must be provided as a list.' : null;

const page = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const ALL = ['BAPTISM', 'CONFIRMATION', 'MARRIAGE', 'FUNERAL'];
const STJOSEPH_14 = ['BAPTISM', 'CONFIRMATION', 'MARRIAGE', 'FUNERAL', 'HOLY_MASS', 'HOUSE_BLESSING', 'VEHICLE_BLESSING',
  'ANOINTING_OF_THE_SICK', 'HOLY_CONFESSION', 'FIRST_COMMUNION', 'SPIRITUAL_COUNSELING', 'NOVENA', 'THANKSGIVING_MASS', 'MEMORIAL_MASS'];
const plain = (v) => JSON.parse(JSON.stringify(v));

test('legacy parish without availableEvents shows nothing enabled instead of everything', () => {
  const legacy = { timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  assert.equal(hasExplicitServiceList(legacy), false);
  assert.deepEqual(getEnabledServiceIds(legacy), []);
  assert.deepEqual(getEnabledServiceIds(undefined), []);
  assert.deepEqual(getEnabledServiceIds({}), []);
  // The page must no longer fall back to the full catalogue, and must label unconfigured state.
  assert.doesNotMatch(page, /Array\.isArray\(prev\?\.availableEvents\) \? prev\.availableEvents : EVENT_TYPES/);
  assert.doesNotMatch(page, /: EVENT_TYPES\.map\(\(e\) => e\.id\);\s*\}, \[eventSettings\?\.availableEvents\]\)/);
  assert.match(page, /Not configured/);
});

test('individual toggle initializes a real availableEvents array for legacy parishes', () => {
  const legacy = { timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  const on = toggleServiceSetting(legacy, 'BAPTISM');
  assert.deepEqual(on.availableEvents, ['BAPTISM']);
  assert.deepEqual(on.timeSlots, legacy.timeSlots);
  assert.deepEqual(on.capacitySettings, legacy.capacitySettings);
  assert.deepEqual(toggleServiceSetting(on, 'BAPTISM').availableEvents, []);
  assert.equal(Array.isArray(toggleServiceSetting(legacy, 'FUNERAL').availableEvents), true);
});

test('Enable All / Disable All initialize and update an explicit array', () => {
  const legacy = { FUNERAL: { requirements: { death_cert: true } } };
  const all = bulkToggleServiceSettings(legacy, ALL, true);
  assert.deepEqual(all.availableEvents, ALL);
  assert.deepEqual(all.FUNERAL, legacy.FUNERAL);
  assert.deepEqual(bulkToggleServiceSettings(legacy, ALL, false).availableEvents, []);
  const partial = bulkToggleServiceSettings({ availableEvents: ['BAPTISM'] }, ['MARRIAGE', 'BAPTISM'], true);
  assert.deepEqual(partial.availableEvents, ['BAPTISM', 'MARRIAGE']);
  assert.deepEqual(bulkToggleServiceSettings(all, ['FUNERAL'], false).availableEvents, ['BAPTISM', 'CONFIRMATION', 'MARRIAGE']);
});

test('existing valid configuration (St. Joseph 14 services) is preserved untouched', () => {
  const stJoseph = { availableEvents: [...STJOSEPH_14], timeSlots: ['09:00 AM', '02:00 PM'], capacitySettings: { dailyLimit: 8, slotCapacity: 3 } };
  assert.equal(getEnabledServiceIds(stJoseph).length, 14);
  assert.equal(hasExplicitServiceList(stJoseph), true);
  assert.equal(validateSchedulingDraftForSave(stJoseph), null);
  assert.deepEqual(plain(prepareSchedulingSettingsForSave(stJoseph)), plain(stJoseph));
  const toggled = toggleServiceSetting(stJoseph, 'NOVENA');
  assert.equal(toggled.availableEvents.length, 13);
  assert.equal(stJoseph.availableEvents.length, 14, 'input must not be mutated');
  // An explicit empty list (admin disabled everything) is a valid explicit choice.
  assert.equal(validateSchedulingDraftForSave({ ...stJoseph, availableEvents: [] }), null);
});

test('save validation demands an explicit services list with actionable guidance', () => {
  const legacy = { timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  const message = validateSchedulingDraftForSave(legacy);
  assert.match(message, /Offered Sacraments & Ceremonies/);
  assert.match(message, /Enable All/);
  assert.ok(validateSchedulingDraftForSave({}));
  assert.ok(validateSchedulingDraftForSave({ availableEvents: 'BAPTISM' }));
  assert.match(validateSchedulingDraftForSave({ availableEvents: [], capacitySettings: { dailyLimit: 0, slotCapacity: 2 } }), /daily limit/);
  assert.match(validateSchedulingDraftForSave({ availableEvents: [] }), /per-slot capacity/);
});

test('prepared payload keeps slots/capacity and satisfies the backend validator', () => {
  const draft = toggleServiceSetting({ capacitySettings: { dailyLimit: 6, slotCapacity: 2 } }, 'BAPTISM');
  assert.equal(validateSchedulingDraftForSave(draft), null);
  const payload = prepareSchedulingSettingsForSave(draft);
  assert.deepEqual(payload.timeSlots, []);
  assert.equal('timeSlots' in draft, false, 'draft is not mutated');
  assert.equal(backendRejects(payload), null);
  assert.deepEqual(payload.availableEvents, ['BAPTISM']);
  assert.deepEqual(payload.capacitySettings.dailyLimit, 6);
  const withSlots = prepareSchedulingSettingsForSave({ ...draft, timeSlots: ['09:00 AM'] });
  assert.deepEqual(withSlots.timeSlots, ['09:00 AM']);
  // The exact legacy payload that used to hit the backend error is now rejected client-side first.
  assert.match(backendRejects({ timeSlots: [], capacitySettings: { dailyLimit: 1, slotCapacity: 1 } }),
    /Enabled scheduling services must be provided as a list/);
  assert.ok(validateSchedulingDraftForSave({ timeSlots: [], capacitySettings: { dailyLimit: 1, slotCapacity: 1 } }));
});

// ---- real handleSaveSettings, run against legacy vs explicit drafts ----
function findNode(source, predicate) {
  const root = ts.createSourceFile('c.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  const visit = (n) => { if (predicate(n)) found = n; else ts.forEachChild(n, visit); };
  visit(root);
  assert.ok(found);
  return found.getText(root);
}
const handler = findNode(page, (n) => ts.isVariableDeclaration(n) && n.name.getText() === 'handleSaveSettings');
const compile = (source, context) => runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText, context);

function saveHarness({ originalEvents, draftEvents, role = 'DIOCESE_COORDINATOR', officeHours = {}, drafts = false }) {
  const calls = []; const toasts = [];
  const context = {
    documentSettings: {}, availableDocuments: [], paymentQrEnabled: false, paymentQrImage: null, venueCapacity: null,
    eventSettings: draftEvents, officeHours, originalSnapshot: { documentSettings: {}, availableDocuments: [], paymentQrEnabled: false,
      paymentQrImage: null, venueCapacity: null, eventSettings: originalEvents, officeHours },
    selectedParishId: '2', canEditScheduling: role === 'SECRETARY' || role === 'DIOCESE_COORDINATOR', saving: false, schedulingRulesDirty: false,
    getParishSettingsChanges, validateSchedulingDraftForSave, prepareSchedulingSettingsForSave, console: { error() {} },
    validateOfficeHours: () => null,
    setSaving() {}, setToast(v) { toasts.push(v); }, setParishes() {}, setOriginalSnapshot() {},
    ParishManagementService: { async editParishSettings() { calls.push('parish'); } },
    schedulingEditorRef: { current: {
      hasUnsavedDateException: () => drafts,
      async save(es, oh) { const err = backendRejects(es); if (err) throw new Error(err); calls.push({ kind: 'scheduling', es: plain(es), oh: plain(oh) }); },
    } },
  };
  const save = compile(`(() => { const ${handler}; return handleSaveSettings; })();`, context);
  return { save, calls, toasts, context };
}

test('saving a legacy parish with no services chosen is blocked with guidance, before any request', async () => {
  const legacy = { timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  const h = saveHarness({ originalEvents: {}, draftEvents: legacy });
  await h.save();
  assert.deepEqual(h.calls, []);
  assert.equal(h.toasts.at(-1).type, 'error');
  assert.match(h.toasts.at(-1).message, /Enable All/);
});

test('legacy parish: Enable All then save persists a real list with slots and capacities (Diocese Coordinator)', async () => {
  const legacy = { timeSlots: ['09:00 AM', '02:00 PM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  const draft = bulkToggleServiceSettings(legacy, ALL, true);
  const h = saveHarness({ originalEvents: legacy, draftEvents: draft, role: 'DIOCESE_COORDINATOR' });
  await h.save();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].es.availableEvents, ALL);
  assert.deepEqual(h.calls[0].es.timeSlots, ['09:00 AM', '02:00 PM']);
  assert.deepEqual(h.calls[0].es.capacitySettings, { dailyLimit: 5, slotCapacity: 2 });
  assert.equal(h.toasts.at(-1).type, 'success');
});

test('legacy parish with individual toggle saves; existing explicit config saves unchanged data plus edits', async () => {
  const legacy = { timeSlots: [], capacitySettings: { dailyLimit: 3, slotCapacity: 1 } };
  const one = saveHarness({ originalEvents: legacy, draftEvents: toggleServiceSetting(legacy, 'FUNERAL') });
  await one.save();
  assert.deepEqual(one.calls[0].es.availableEvents, ['FUNERAL']);
  assert.equal(one.toasts.at(-1).type, 'success');

  const stJoseph = { availableEvents: [...STJOSEPH_14], timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 8, slotCapacity: 3 } };
  const edited = { ...stJoseph, capacitySettings: { dailyLimit: 9, slotCapacity: 3 } };
  const sj = saveHarness({ originalEvents: stJoseph, draftEvents: edited, role: 'SECRETARY' });
  await sj.save();
  assert.deepEqual(sj.calls[0].es.availableEvents, STJOSEPH_14);
  assert.equal(sj.calls[0].es.capacitySettings.dailyLimit, 9);
  assert.equal(sj.toasts.at(-1).type, 'success');
});

test('unsaved date-exception drafts still block, and edits stay in the draft when validation fails', async () => {
  const legacy = { timeSlots: ['09:00 AM'], capacitySettings: { dailyLimit: 5, slotCapacity: 2 } };
  const blocked = saveHarness({ originalEvents: {}, draftEvents: legacy, drafts: true });
  await blocked.save();
  assert.deepEqual(blocked.calls, []);
  assert.match(blocked.toasts.at(-1).message, /unsaved Date Exception/);
  const failed = saveHarness({ originalEvents: {}, draftEvents: legacy });
  await failed.save();
  assert.deepEqual(plain(failed.context.eventSettings), plain(legacy), 'draft untouched after blocked save');
});

test('Diocese Coordinator can edit scheduling for any selected parish without a secretary account', () => {
  assert.match(page, /const canEditScheduling = role === 'SECRETARY' \|\| role === 'DIOCESE_COORDINATOR';/);
  const routes = readFileSync(new URL('../../testimonium-backend/routes/scheduleAvailabilityRoutes.js', import.meta.url), 'utf8');
  assert.match(routes, /weekday-rules",\s*checkRole\(\["SECRETARY", "DIOCESE_COORDINATOR"\]\)/);
});
