import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { saveMapConfiguration, reconcileMapDrafts } from '../src/utils/mapConfigurationSave.ts';

const center = [10.4377, 123.2582];
const baseline = () => ['1', '2'].map((id) => ({ id, name: `Fixture ${id}`, latitude: 10.4, longitude: 123.2,
  mapZoom: 13, pinColor: '#7B1C2A', showLabel: true, locationUpdatedAt: 'old-version',
  directoryDescription: 'Original', contactNumber: '09123456789', email: 'old@example.test' }));
const mapDraft = { latitude: 10.5, longitude: 123.3, mapZoom: 16, pinColor: '#10b981', showLabel: false };
const dirDraft = { directoryDescription: 'Saved', contactNumber: '09987654321', email: 'new@example.test' };
const plain = (value) => JSON.parse(JSON.stringify(value));
function fixture(options = {}) {
  const parishes = baseline();
  const rows = structuredClone(parishes);
  const calls = [];
  const api = {
    async batchUpdateMap(updates) {
      calls.push({ scope: 'map', updates });
      await options.mapWait;
      if (options.mapError) throw options.mapError;
      return updates.map(({ id, ...changes }) => {
        const row = rows.find((item) => item.id === id);
        Object.assign(row, changes, { locationUpdatedAt: 'new-version' });
        return { ...row, directoryDescription: 'Stale map response description' };
      });
    },
    async updateDirectorySettings(id, changes) {
      calls.push({ scope: 'directory', id, changes });
      if (options.failDirectory === id) throw new Error('Directory unavailable');
      const row = rows.find((item) => item.id === id);
      Object.assign(row, changes);
      // Deliberately stale map fields must never replace the map response.
      return { ...row, latitude: 10.1, longitude: 123.1, mapZoom: 5, pinColor: '#000000', showLabel: true, locationUpdatedAt: 'stale-version' };
    },
  };
  return { parishes, rows, calls, api };
}

test('combined save waits for map completion and merges only endpoint-owned fields; reloaded values match', async () => {
  let release;
  const h = fixture({ mapWait: new Promise((resolve) => { release = resolve; }) });
  const drafts = { '1': { ...mapDraft, ...dirDraft } };
  const pending = saveMapConfiguration(h.parishes, drafts, h.api, center);
  assert.deepEqual(h.calls.map((call) => call.scope), ['map']);
  release();
  const result = await pending;
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.savedIds, ['1']);
  const merged = { ...h.parishes[0], ...result.savedChanges['1'] };
  assert.deepEqual(merged, { ...h.rows[0], locationUpdatedBy: undefined });
  for (const [field, value] of Object.entries(drafts['1'])) assert.equal(merged[field], value);
  assert.equal(merged.locationUpdatedAt, 'new-version');
  assert.deepEqual(reconcileMapDrafts(drafts, drafts, h.parishes, result.savedChanges), {});
  assert.equal(h.calls[0].updates[0].locationUpdatedAt, 'old-version');
});

test('map success and one directory failure retain only failed fields; retry skips map and successful parish', async () => {
  const h = fixture({ failDirectory: '2' });
  const drafts = { '1': { ...mapDraft, ...dirDraft }, '2': { ...dirDraft } };
  const result = await saveMapConfiguration(h.parishes, drafts, h.api, center);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, '2');
  assert.deepEqual(result.savedIds, ['1']);
  const retained = reconcileMapDrafts(drafts, drafts, h.parishes, result.savedChanges);
  assert.deepEqual(retained, { '2': dirDraft });
  const nextBaseline = h.parishes.map((row) => ({ ...row, ...result.savedChanges[row.id] }));
  const retryCalls = [];
  const retry = await saveMapConfiguration(nextBaseline, retained, {
    batchUpdateMap() { assert.fail('map was already saved'); },
    async updateDirectorySettings(id, data) { retryCalls.push(id); return { ...nextBaseline[1], ...data }; },
  }, center);
  assert.deepEqual(retryCalls, ['2']);
  assert.deepEqual(reconcileMapDrafts(retained, retained, nextBaseline, retry.savedChanges), {});
});

test('map conflict preserves map drafts while successful directory changes are acknowledged', async () => {
  const error = Object.assign(new Error('Stale location'), { response: { status: 409 } });
  const h = fixture({ mapError: error });
  const drafts = { '1': { ...mapDraft, ...dirDraft } };
  const result = await saveMapConfiguration(h.parishes, drafts, h.api, center);
  assert.equal(result.failures[0].error, error);
  assert.deepEqual(result.savedIds, []);
  assert.deepEqual(reconcileMapDrafts(drafts, drafts, h.parishes, result.savedChanges), { '1': mapDraft });
  assert.equal(Object.hasOwn(result.savedChanges['1'], 'locationUpdatedAt'), false);
});

test('total failure preserves drafts; new edits, reversions and unrelated parish drafts survive an in-flight save', async () => {
  const h = fixture({ mapError: new Error('Unavailable'), failDirectory: '1' });
  const submitted = { '1': { ...mapDraft, ...dirDraft } };
  const failed = await saveMapConfiguration(h.parishes, submitted, h.api, center);
  assert.equal(failed.failures.length, 2);
  assert.deepEqual(failed.savedChanges, {});
  assert.deepEqual(reconcileMapDrafts(submitted, submitted, h.parishes, failed.savedChanges), submitted);
  const saved = { '1': { ...mapDraft, ...dirDraft, locationUpdatedAt: 'new-version' } };
  const current = { '1': { ...submitted['1'], directoryDescription: 'Newer edit' }, '2': { email: 'other@example.test' } };
  delete current['1'].email; // reverted to original while request was in flight
  assert.deepEqual(reconcileMapDrafts(current, submitted, h.parishes, saved), {
    '1': { directoryDescription: 'Newer edit', email: 'old@example.test' }, '2': current['2'],
  });
  // Server-sanitized text becomes the baseline, without reintroducing HTML.
  assert.deepEqual(reconcileMapDrafts({ '1': { directoryDescription: '<b>Text</b>' } },
    { '1': { directoryDescription: '<b>Text</b>' } }, h.parishes, { '1': { directoryDescription: 'Text' } }), {});
});

function nodeText(source, predicate) {
  const root = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (predicate(node)) found = node; else ts.forEachChild(node, visit); }
  visit(root);
  assert.ok(found);
  return found.getText(root);
}
const compile = (source, context) => runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const page = readFileSync(new URL('../src/pages/MapConfigurationPage.tsx', import.meta.url), 'utf8');
const saveHandler = nodeText(page, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'handleSaveAll');

test('actual page handler reports partial failures, retains drafts and recognizes Axios conflicts', async () => {
  for (const options of [{ failDirectory: '1' }, { mapError: Object.assign(new Error('Stale'), { response: { status: 409 } }) }]) {
    const h = fixture(options);
    const toasts = []; const dialogs = [];
    const context = { hasUnsavedChanges: true, isSaving: false, drafts: { '1': { ...mapDraft, ...dirDraft } }, parishes: h.parishes,
      ParishManagementService: h.api, DIOCESE_CENTER: center, saveMapConfiguration, reconcileMapDrafts,
      useCallback: (fn) => fn, setTimeout() {}, console,
      setIsSaving(value) { context.isSaving = value; }, setSaveSuccessIds() {},
      setParishes(fn) { context.parishes = fn(context.parishes); }, setDrafts(fn) { context.drafts = fn(context.drafts); },
      showToast(message, type) { toasts.push({ message, type }); }, showConfirm(...args) { dialogs.push(args); }, loadParishes() {},
    };
    await compile(`(() => { const ${saveHandler}; return handleSaveAll; })()`, context)();
    assert.equal(toasts.some((toast) => toast.type === 'success'), false);
    assert.match(toasts.at(-1).message, /Partially saved/);
    assert.deepEqual(plain(context.drafts), { '1': options.mapError ? mapDraft : dirDraft });
    assert.equal(context.isSaving, false);
    assert.equal(dialogs.length, options.mapError ? 1 : 0);
  }
});

test('All Vicariates uses the actual toolbar value and preserves named/search filters', () => {
  const toolbar = readFileSync(new URL('../src/components/map-configuration/SaveToolbar.tsx', import.meta.url), 'utf8');
  const allValue = /value: '([^']+)', label: 'All Vicariates'/.exec(toolbar)[1];
  const filter = nodeText(page, (node) => ts.isVariableDeclaration(node) && node.name.getText() === 'filteredParishes');
  const parishes = [{ name: 'Alpha', vicariate: 'Vicariate of Canlaon' }, { name: 'Beta', vicariate: 'Vicariate of St. Vincent Ferrer' }];
  const run = (selectedVicariate, searchQuery = '') => compile(`(() => { const ${filter}; return filteredParishes; })()`, {
    React: { useMemo: (fn) => fn() }, parishes, selectedVicariate, searchQuery,
  });
  assert.equal(run(allValue).length, 2);
  assert.equal(run(allValue, 'beta')[0].name, 'Beta');
  assert.equal(run(parishes[0].vicariate).length, 1);
  assert.equal(run(parishes[0].vicariate, 'beta').length, 0);
});

test('actual MapController ignores new center-array identities but reacts to selection, coordinates, zoom and explicit locate/reset', () => {
  const source = readFileSync(new URL('../src/components/map-configuration/MapController.tsx', import.meta.url), 'utf8');
  const component = nodeText(source, (node) => ts.isFunctionDeclaration(node) && node.name?.getText() === 'MapController');
  const calls = []; let previous;
  const map = { flyTo(...args) { calls.push(args); } };
  const render = compile(`${component.replace(/^export /, '')}; MapController;`, { useMap: () => map, useEffect(fn, deps) {
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) fn();
    previous = deps;
  } });
  const props = { center: [10.4, 123.2], zoom: 13, selectedId: '1', locateTrigger: 0 };
  render(props);
  for (let i = 0; i < 5; i++) render({ ...props, center: [...props.center] });
  assert.equal(calls.length, 1, 'text/contact/color/label rerenders must not move the map');
  render({ ...props, selectedId: '2' });
  render({ ...props, center: [10.5, 123.2] });
  render({ ...props, zoom: 16 });
  render({ ...props, locateTrigger: 1 });
  assert.equal(calls.length, 5);
});

test('directory provider uses its own route while general settings keep the established endpoint', () => {
  const source = readFileSync(new URL('../src/providers/api/ApiParishProvider.ts', import.meta.url), 'utf8');
  const routes = [];
  for (const name of ['updateDirectorySettings', 'editParishSettings']) {
    const method = nodeText(source, (node) => ts.isMethodDeclaration(node) && node.name.getText() === name);
    const fn = compile(`({ ${method} })[${JSON.stringify(name)}]`, { api: { async patch(path) { routes.push(path); return { data: { data: {} } }; } } });
    void fn('1', {});
  }
  assert.deepEqual(routes, ['/parishes/1/directory-settings', '/parishes/1/settings']);
});
