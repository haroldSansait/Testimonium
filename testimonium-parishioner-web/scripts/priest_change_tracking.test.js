import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const tracking = readFileSync(new URL('../src/pages/dashboard/RequestTrackingPage.tsx', import.meta.url), 'utf8');
const handlers = tracking.slice(tracking.indexOf('  const loadEligibleReplacementPriests ='), tracking.indexOf('  const fetchAvailableDates ='));
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Execute the actual page handlers, including requests that finish after selection changes.
function harness(scheduler = {}) {
  const state = {};
  const env = {
    selectedSchedule: { id: '55', parishId: 10, version: 3 },
    activeScheduleIdRef: { current: '55' },
    replacementPriestsGenerationRef: { current: 0 },
    priestChangeInFlightRef: { current: false },
    submittingPriestChange: false,
    replacementPriestId: '22', priestChangeNote: '  Prefer this priest  ',
    services: { scheduler },
    useCallback: (fn) => fn,
    console: { error() {} },
    loadSchedules: () => { state.refreshes = (state.refreshes || 0) + 1; },
    syncUpdatedSchedule: (updated) => { state.updated = updated; },
  };
  for (const name of ['LoadingEligiblePriests', 'EligiblePriestsError', 'EligibleReplacementPriests', 'ShowPriestChangeForm', 'ReplacementPriestId', 'PriestChangeNote', 'PriestChangeError', 'PriestChangeSuccess', 'SubmittingPriestChange']) {
    env[`set${name}`] = (value) => { state[name] = value; };
  }
  const api = vm.runInNewContext(compile(`${handlers}\n({ loadEligibleReplacementPriests, handleSubmitPriestChange });`), env);
  return { env, state, ...api, submit: () => api.handleSubmitPriestChange({ preventDefault() {} }) };
}

test('replacement lookup discards another schedule response and preserves current loading state', async () => {
  const old = deferred(), latest = deferred();
  const h = harness({ getEligiblePriests: (parish) => parish === '10' ? old.promise : latest.promise });
  const first = h.loadEligibleReplacementPriests();
  h.env.selectedSchedule = { id: '56', parishId: 20 };
  h.env.activeScheduleIdRef.current = '56';
  const second = h.loadEligibleReplacementPriests();
  old.resolve([{ id: 22, name: 'Wrong parish priest' }]);
  await first;
  assert.equal(h.state.EligibleReplacementPriests.length, 0);
  assert.equal(h.state.LoadingEligiblePriests, true);
  latest.resolve([{ id: 33, name: 'Selected parish priest' }]);
  await second;
  assert.equal(h.state.EligibleReplacementPriests[0].id, 33);
  assert.equal(h.state.LoadingEligiblePriests, false);
});

test('obsolete lookup errors cannot overwrite the selected schedule priest list', async () => {
  const old = deferred();
  const h = harness({ getEligiblePriests: () => old.promise });
  const first = h.loadEligibleReplacementPriests();
  h.env.activeScheduleIdRef.current = '56';
  h.state.EligibleReplacementPriests = [{ id: 33 }];
  old.reject(new Error('Old parish unavailable'));
  await first;
  assert.equal(h.state.EligibleReplacementPriests[0].id, 33);
  assert.equal(h.state.EligiblePriestsError, null);
});

test('immediate repeated submit sends exactly one versioned request', async () => {
  const pending = deferred();
  const calls = [];
  const h = harness({ requestPriestChange: (...args) => { calls.push(args); return pending.promise; } });
  const first = h.submit();
  await h.submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '55');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), { replacementPriestId: 22, note: 'Prefer this priest', expectedVersion: 3 });
  pending.resolve({ id: '55', version: 4 });
  await first;
  assert.equal(h.state.updated.version, 4);
  assert.match(h.state.PriestChangeSuccess, /submitted/);
  assert.equal(h.env.priestChangeInFlightRef.current, false);
});

test('completed submission updates its record without closing another schedule form', async () => {
  const pending = deferred();
  const h = harness({ requestPriestChange: () => pending.promise });
  const first = h.submit();
  h.env.activeScheduleIdRef.current = '56';
  h.state.ShowPriestChangeForm = true;
  h.state.PriestChangeNote = 'New schedule note';
  pending.resolve({ id: '55', version: 4 });
  await first;
  assert.equal(h.state.updated.id, '55');
  assert.equal(h.state.ShowPriestChangeForm, true);
  assert.equal(h.state.PriestChangeNote, 'New schedule note');
  assert.equal(h.state.PriestChangeSuccess, null);
});

test('conflict refreshes the detail record used by tracking search', async () => {
  let refreshedId;
  const h = harness({
    requestPriestChange: async () => { throw { status: 409, message: 'Version conflict' }; },
    getAppointmentById: async (id) => { refreshedId = id; return { id, version: 9 }; },
  });
  await h.submit();
  assert.equal(refreshedId, '55');
  assert.equal(h.state.updated.version, 9);
  assert.equal(h.state.PriestChangeError, 'Version conflict');
  assert.equal(h.state.refreshes, 1);
});

test('Web provider uses the shared change API and maps secretary and replacement fields', async () => {
  const source = readFileSync(new URL('../src/providers/api/scheduler.ts', import.meta.url), 'utf8');
  let call;
  const module = { exports: {} };
  vm.runInNewContext(compile(source), {
    module, exports: module.exports,
    require: (name) => name.includes('api/client') ? { client: { post: async (url, payload) => {
      call = { url, payload };
      return { data: { id: 55, parishId: 10, status: 'PENDING', requestedDate: '2026-12-10', version: 4,
        priestChangeStatus: 'PENDING', priestChangeRequestedPriest: { id: 22, name: 'Fr. Mario' },
        parishSecretary: { id: 90, fullName: 'Secretary Clara', contactNumber: '09171234567' } } };
    } } } : name.includes('EventTypeCatalog') ? { resolveDisplayTitle: () => 'Baptism' } : { auth: {} },
  });
  const result = await new module.exports.ApiSchedulerProvider().requestPriestChange('55', { replacementPriestId: 22, note: '  Please change  ', expectedVersion: 3 });
  assert.equal(call.url, '/schedule-requests/55/request-priest-change');
  assert.equal(call.payload.note, 'Please change');
  assert.equal(call.payload.expectedVersion, 3);
  assert.equal(result.priestChangeRequestedPriestName, 'Fr. Mario');
  assert.equal(result.parishSecretary.fullName, 'Secretary Clara');
  assert.equal(result.parishSecretary.contactNumber, '09171234567');
});
