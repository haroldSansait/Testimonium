import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { createMemoryRouter } from 'react-router-dom';
import { buildApplicantName } from '../../testimonium-backend/utils/nameUtils.js';
import { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS } from '../src/config/documents.ts';

function createTimerController() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(fn, delay) {
      const id = nextId++;
      timers.set(id, { id, fn, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    count() {
      return timers.size;
    },
    delays() {
      return [...timers.values()].map(t => t.delay);
    },
    async runLatest() {
      const entries = [...timers.values()];
      assert.ok(entries.length > 0, 'expected at least one pending autosave timer');
      const latest = entries[entries.length - 1];
      timers.delete(latest.id);
      await latest.fn();
    },
  };
}

function harness({ page = 'SacramentalRequestPage', draft = null, search = '', api = {}, schedulerApi = {} } = {}) {
  const state = [];
  const effects = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  const calls = [];
  const storage = new Map();
  const windowListeners = new Map();
  const timers = createTimerController();
  const location = { search };
  const params = () => new URLSearchParams(location.search);
  const initialPath = page === 'SacramentalRequestPage' ? '/dashboard/request' : '/dashboard/scheduler';
  const router = createMemoryRouter([{ path: '*', element: null }], {
    initialEntries: ['/dashboard/home', `${initialPath}${search}`], initialIndex: 1,
  });
  router.subscribe(() => {
    location.search = router.state.location.search;
    dirty = true;
  });
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (callback, deps) => {
    const index = cursor++;
    if (!same(state[index]?.deps, deps)) state[index] = { value: callback(), deps };
    return state[index].value;
  };
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [
        state[index],
        value => {
          const next = typeof value === 'function' ? value(state[index]) : value;
          if (!Object.is(next, state[index])) {
            state[index] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      return (state[index] ||= { current: initial });
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(effects[index]?.deps, deps)) {
        effects[index] = { callback, deps, pending: true, cleanup: effects[index]?.cleanup };
      }
    },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
  };

  let currentDraft = draft;
  const request = {
    getRequestById: async id => {
      calls.push(['req:get', id]);
      return currentDraft;
    },
    getDocumentRequirements: async (...args) => {
      calls.push(['req:requirements', ...args]);
      return {
        requiredDocuments: [{ id: 'valid_id', required: true }, { id: 'certificate', label: 'Certificate', required: true }],
        relationshipEvidence: [],
      };
    },
    createRequest: async payload => {
      calls.push(['req:create', payload]);
      currentDraft = {
        id: '501',
        trackingNumber: 'TRK-501',
        isDraft: true,
        status: 'DRAFT',
        parishId: payload.parishId,
        documentType: payload.documentType,
        rawDocumentType: payload.documentType,
        applicantName: buildApplicantName({
          firstName: payload.applicantFirstName,
          middleName: payload.applicantMiddleName,
          lastName: payload.applicantLastName,
        }),
        relationship: payload.relationship,
        purpose: payload.purpose,
        attachments: [],
      };
      return currentDraft;
    },
    updateDraft: async (id, details) => {
      calls.push(['req:update', id, details]);
      const { applicantFirstName, applicantMiddleName, applicantLastName, ...savedDetails } = details;
      if (applicantFirstName !== undefined) {
        savedDetails.applicantName = buildApplicantName({
          firstName: applicantFirstName,
          middleName: applicantMiddleName,
          lastName: applicantLastName,
        });
      }
      currentDraft = { ...currentDraft, ...savedDetails };
      return currentDraft;
    },
    submitDraft: async id => {
      calls.push(['req:submit', id]);
      currentDraft = { ...currentDraft, isDraft: false };
      return currentDraft;
    },
    uploadFiles: async (id, files, category) => {
      calls.push(['req:upload', id, files, category]);
      return [];
    },
    uploadRegistrantId: async (id, files) => {
      calls.push(['req:private-upload', id, files]);
    },
    ...api,
  };

  let currentScheduleDraft = draft;
  const scheduler = {
    getDraftById: async id => {
      calls.push(['sched:get', id]);
      return currentScheduleDraft;
    },
    getSchedulingConfiguration: async parishId => {
      calls.push(['sched:config', parishId]);
      return {
        schedulingAvailable: true,
        services: [
          { eventType: 'BLESSING', label: 'House Blessing', requirements: [] },
          { eventType: 'WEDDING', label: 'Marriage (Canonical Interview)', requirements: [] },
        ],
        venueCapacity: 100,
      };
    },
    getAvailabilityDates: async () => ({ serviceAvailable: true, dates: ['2026-12-01'] }),
    getRecommendations: async () => ({ recommendations: [] }),
    getEligiblePriests: async () => [],
    getAvailableSlots: async () => ['09:00 AM - 10:00 AM'],
    getRescheduleProposal: async () => null,
    createDraft: async (payload, key) => {
      calls.push(['sched:create', payload, key]);
      currentScheduleDraft = {
        id: '701',
        parishId: payload.parishId,
        parishName: 'San Roque Parish',
        rawEventType: payload.eventType,
        serviceName: payload.displayTitle,
        displayTitle: payload.displayTitle,
        preferredDate: payload.preferredDate,
        date: payload.date,
        requestedDate: payload.requestedDate,
        timeSlot: payload.timeSlot,
        location: payload.location,
        remarks: payload.remarks,
        requestedPriestId: payload.requestedPriestId,
        attachments: [],
      };
      return currentScheduleDraft;
    },
    updateDraft: async (id, payload) => {
      calls.push(['sched:update', id, payload]);
      currentScheduleDraft = {
        ...currentScheduleDraft,
        ...payload,
        rawEventType: payload.eventType || currentScheduleDraft.rawEventType,
      };
      return currentScheduleDraft;
    },
    submitDraft: async (id, payload) => {
      calls.push(['sched:submit', id, payload]);
      return { id: '900', confirmationNumber: 'CONF-900', serviceName: payload.displayTitle, date: payload.date, timeSlot: payload.timeSlot };
    },
    ...schedulerApi,
  };

  const parishes = [{ id: '3', name: 'San Roque Parish', availableDocuments: DEFAULT_OFFERED_DOCUMENTS }];
  const navigate = (url, options) => {
    calls.push(['navigate', url, options]);
    return router.navigate(url, options);
  };
  const modules = {
    react: { ...React, default: React, __esModule: true },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-dom': { createPortal: child => child },
    'react-router-dom': {
      useSearchParams: () => [params()], useNavigate: () => navigate,
      useBlocker: predicate => router.getBlocker('draft', predicate),
    },
    '../../providers/factory': { default: { request, scheduler }, __esModule: true },
    '../../hooks/useService': { useParishes: () => ({ data: parishes, loading: false, refetch() {} }), usePausePolling() {} },
    '../../hooks/useProfileRequirement': { useProfileRequirement: () => ({ isProfileIncomplete: false, openProfileModal() {} }) },
    '../../contexts/AuthContext': {
      useAuth: () => ({
        user: { uid: 'u-1' },
        appProfile: { id: '12', firebaseUid: 'u-1', firstName: 'Juan', lastName: 'Dela Cruz', fullName: 'Juan Dela Cruz', isGovernmentIdVerified: true },
      }),
    },
    '../../config/documents': { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS },
    '../../utils/uploadPolicy': { UPLOAD_POLICIES: new Proxy({}, { get: () => ({ acceptAttribute: '.pdf,.png' }) }), validateUploadFile: () => ({ valid: true }) },
    '../../utils/scheduleAvailability': { isSchedulingAvailabilityConflict: () => false, scheduleSubmissionErrorMessage: e => e?.message || 'Error' },
  };
  const require = name =>
    modules[name] ||
    new Proxy({ __esModule: true }, { get: (_, prop) => (prop === '__esModule' ? true : prop === 'default' ? name.split('/').at(-1) : String(prop)) });

  const guardModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/hooks/useDraftNavigationGuard.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { require, module: guardModule, exports: guardModule.exports });
  modules['../../hooks/useDraftNavigationGuard'] = guardModule.exports;

  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/pages/dashboard/${page}.tsx`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    {
      require,
      module,
      exports: module.exports,
      URLSearchParams,
      console: { error() {} },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
      globalThis: { crypto: { randomUUID } },
      crypto: { randomUUID },
      window: {
        location,
        innerWidth: 1280,
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        addEventListener: (evt, fn) => {
          const list = windowListeners.get(evt) || [];
          list.push(fn);
          windowListeners.set(evt, list);
        },
        removeEventListener: (evt, fn) => {
          windowListeners.set(
            evt,
            (windowListeners.get(evt) || []).filter(item => item !== fn)
          );
        },
      },
      document: {
        body: {},
        visibilityState: 'visible',
        addEventListener() {},
        removeEventListener() {},
      },
    }
  );
  const Component = module.exports[page];
  const walk = (node, predicate, results = []) => {
    if (!node || typeof node !== 'object') return results;
    if (Array.isArray(node)) {
      node.forEach(child => walk(child, predicate, results));
      return results;
    }
    if (predicate(node)) results.push(node);
    walk(node.props?.children, predicate, results);
    return results;
  };
  const textOf = node =>
    node == null || typeof node === 'boolean'
      ? ''
      : Array.isArray(node)
        ? node.map(textOf).join('')
        : typeof node === 'object'
          ? textOf(node.props?.children)
          : String(node);

  return {
    calls,
    timers,
    navigate,
    path: () => router.state.location.pathname,
    search: () => router.state.location.search,
    dialog: () => walk(tree, n => n.props?.confirmLabel === 'Leave Anyway')[0],
    async flush() {
      for (let i = 0; i < 16; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = Component();
        }
        const pending = effects.filter(e => e?.pending);
        if (pending.length) {
          for (const effect of pending) {
            effect.pending = false;
            if (typeof effect.cleanup === 'function') effect.cleanup();
            effect.cleanup = effect.callback() || undefined;
          }
        }
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty && !effects.some(e => e?.pending)) break;
      }
      if (dirty) {
        dirty = false;
        cursor = 0;
        tree = Component();
      }
    },
    input(labelPrefix) {
      const found = walk(tree, n => String(n.props?.label || '').startsWith(labelPrefix))[0];
      assert.ok(found, `Missing input starting with "${labelPrefix}"`);
      return found;
    },
    textarea() {
      const found = walk(tree, n => n.type === 'textarea')[0];
      assert.ok(found, 'Missing textarea');
      return found;
    },
    button(label) {
      const found = walk(tree, n => typeof n.props?.onClick === 'function' && textOf(n).includes(label))[0];
      assert.ok(found, `Missing button containing "${label}"`);
      return found;
    },
    allText() {
      return textOf(tree);
    },
    dispatchBeforeUnload() {
      let prevented = false;
      const evt = {
        preventDefault() {
          prevented = true;
        },
        returnValue: undefined,
      };
      for (const fn of windowListeners.get('beforeunload') || []) fn(evt);
      return prevented;
    },
  };
}

test('Web SacramentalRequestPage: 1500ms debounced create, coalesce, update-only follow-up, status, and attachment exclusion', async () => {
  const ui = harness({ page: 'SacramentalRequestPage' });
  await ui.flush();

  // Initial mount with auto-selected parish + Self autofill must NOT create a draft
  assert.equal(ui.calls.filter(c => c[0] === 'req:create').length, 0);
  assert.equal(ui.timers.count(), 0);
  assert.equal(ui.dispatchBeforeUnload(), false);

  // Move to Step 2
  ui.button('Next Step').props.onClick();
  await ui.flush();
  ui.button('Next Step').props.onClick();
  await ui.flush();

  // Rapid edits to Purpose coalesce into one 1500ms timer
  ui.input('Purpose of Request').props.onChange({ target: { value: 'Pass' } });
  await ui.flush();
  ui.input('Purpose of Request').props.onChange({ target: { value: 'Passport application' } });
  await ui.flush();
  assert.equal(ui.timers.count(), 1);
  assert.deepEqual(ui.timers.delays(), [1500]);
  assert.match(ui.allText(), /Unsaved changes/);
  assert.equal(ui.dispatchBeforeUnload(), true);

  // Fire timer -> creates once, never calls upload APIs
  await ui.timers.runLatest();
  await ui.flush();
  assert.equal(ui.calls.filter(c => c[0] === 'req:create').length, 1);
  assert.equal(ui.calls.filter(c => c[0] === 'req:upload' || c[0] === 'req:private-upload').length, 0);
  assert.match(ui.allText(), /All changes saved/);
  assert.equal(ui.dispatchBeforeUnload(), false);

  // Edit again -> updates same draft ID, never calls create again
  ui.input('Purpose of Request').props.onChange({ target: { value: 'Employment requirement' } });
  await ui.flush();
  assert.equal(ui.timers.count(), 1);
  await ui.timers.runLatest();
  await ui.flush();
  assert.equal(ui.calls.filter(c => c[0] === 'req:create').length, 1);
  assert.equal(ui.calls.filter(c => c[0] === 'req:update').length, 1);
  assert.equal(ui.calls.find(c => c[0] === 'req:update')[1], '501');
  assert.match(ui.allText(), /All changes saved/);
});

test('Web SacramentalRequestPage: resumed draft skips hydration save, preserves mid-flight edits, and shows error on failure', async () => {
  let resolveSlowUpdate;
  const ui = harness({
    page: 'SacramentalRequestPage',
    search: '?draftId=446',
    draft: {
      id: '446',
      trackingNumber: 'TRK-446',
      isDraft: true,
      parishId: '3',
      documentType: 'BAPTISMAL_CERTIFICATE',
      rawDocumentType: 'BAPTISMAL_CERTIFICATE',
      applicantName: 'Juan Dela Cruz',
      relationship: 'Self',
      purpose: 'School admission',
      attachments: [],
    },
    api: {
      updateDraft: (id, details) => {
        ui.calls.push(['req:update', id, details]);
        if (details.purpose === 'First edit') {
          return new Promise(resolve => {
            resolveSlowUpdate = () => resolve({
              id: '446',
              trackingNumber: 'TRK-446',
              isDraft: true,
              parishId: '3',
              documentType: 'BAPTISMAL_CERTIFICATE',
              rawDocumentType: 'BAPTISMAL_CERTIFICATE',
              applicantName: 'Juan Dela Cruz',
              relationship: 'Self',
              purpose: 'First edit',
              attachments: [],
            });
          });
        }
        return Promise.reject(new Error('Network error'));
      },
    },
  });
  await ui.flush();

  // Hydration must NOT schedule an autosave
  assert.equal(ui.timers.count(), 0);
  assert.equal(ui.calls.filter(c => c[0] === 'req:update').length, 0);
  assert.match(ui.allText(), /All changes saved/);

  // User makes an edit, timer fires, and while request is in flight user types a newer edit
  ui.input('Purpose of Request').props.onChange({ target: { value: 'First edit' } });
  await ui.flush();
  const inFlightPromise = ui.timers.runLatest();
  await ui.flush();
  assert.match(ui.allText(), /Saving\.\.\./);

  ui.input('Purpose of Request').props.onChange({ target: { value: 'Second newer edit' } });
  await ui.flush();
  resolveSlowUpdate();
  await inFlightPromise;
  await ui.flush();

  // Newer local edit must NOT be overwritten by stale "First edit" response
  assert.equal(ui.input('Purpose of Request').props.value, 'Second newer edit');
  assert.match(ui.allText(), /Unsaved changes/);
  assert.equal(ui.timers.count(), 1);

  // Follow-up save fails -> status indicator shows "Unable to save changes"
  await ui.timers.runLatest();
  await ui.flush();
  assert.match(ui.allText(), /Unable to save changes/);
});

test('Web EventSchedulerPage: requires parish + service, preserves WEDDING venue, and flushes valid edit on Back to Saved Drafts', async () => {
  const ui = harness({ page: 'EventSchedulerPage' });
  await ui.flush();
  assert.equal(ui.calls.filter(c => c[0] === 'sched:create').length, 0);
  assert.equal(ui.timers.count(), 0);

  // Resume existing WEDDING draft -> no immediate autosave on hydration
  const uiResumed = harness({
    page: 'EventSchedulerPage',
    search: '?draftId=701',
    draft: {
      id: '701',
      parishId: '3',
      parishName: 'San Roque Parish',
      rawEventType: 'WEDDING',
      serviceName: 'Marriage (Canonical Interview)',
      displayTitle: 'Marriage (Canonical Interview)',
      preferredDate: '2026-12-01',
      date: '2026-12-01',
      requestedDate: '2026-12-01',
      timeSlot: '09:00 AM - 10:00 AM',
      location: 'San Roque Parish',
      remarks: 'Initial note',
      requestedPriestId: null,
      attachments: [],
    },
  });
  await uiResumed.flush();

  // No immediate autosave on resumed draft hydration
  assert.equal(uiResumed.timers.count(), 0);
  assert.equal(uiResumed.calls.filter(c => c[0] === 'sched:update').length, 0);

  // Edit notes -> triggers 1500ms debounce, preserves WEDDING parish venue
  uiResumed.textarea().props.onChange({ target: { value: 'Updated wedding note' } });
  await uiResumed.flush();
  assert.equal(uiResumed.timers.count(), 1);
  assert.match(uiResumed.allText(), /Unsaved changes/);

  // Navigate Back to Saved Drafts -> flushes pending form update first
  await uiResumed.button('Back to Saved Drafts').props.onClick();
  await uiResumed.flush();
  const updates = uiResumed.calls.filter(c => c[0] === 'sched:update');
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1], '701');
  assert.equal(updates[0][2].location, 'San Roque Parish');
  assert.equal(updates[0][2].remarks, 'Updated wedding note');
  const navCall = uiResumed.calls.find(c => c[0] === 'navigate' && String(c[1]).includes('mode=schedules'));
  assert.ok(navCall);
});

const documentDraft = (purpose = 'School (Approximate Registry Year: 1995)') => ({
  id: '446', trackingNumber: 'TRK-446', isDraft: true, parishId: '3',
  documentType: 'BAPTISMAL_CERTIFICATE', rawDocumentType: 'BAPTISMAL_CERTIFICATE',
  applicantName: 'Juan Dela Cruz', relationship: 'Self', purpose, attachments: [],
});
const scheduleDraft = () => ({
  id: '701', parishId: '3', parishName: 'San Roque Parish', rawEventType: 'WEDDING',
  serviceName: 'Marriage (Canonical Interview)', displayTitle: 'Marriage (Canonical Interview)',
  preferredDate: '2026-12-01', date: '2026-12-01', requestedDate: '2026-12-01',
  timeSlot: '09:00 AM - 10:00 AM', location: 'San Roque Parish', remarks: 'Initial note',
  requestedPriestId: null, attachments: [],
});
const workflows = [
  { page: 'SacramentalRequestPage', id: '446', draft: documentDraft, apiKey: 'api', prefix: 'req',
    edit: (ui, value) => ui.input('Purpose of Request').props.onChange({ target: { value } }),
    value: ui => ui.input('Purpose of Request').props.value },
  { page: 'EventSchedulerPage', id: '701', draft: scheduleDraft, apiKey: 'schedulerApi', prefix: 'sched',
    edit: (ui, value) => ui.textarea().props.onChange({ target: { value } }),
    value: ui => ui.textarea().props.value },
];

test('registry year is restored separately, remains accessible, and can be replaced or cleared without obsolete suffixes', async () => {
  const ui = harness({ draft: documentDraft(), search: '?draftId=446' });
  await ui.flush();
  assert.equal(ui.input('Purpose of Request').props.value, 'School');
  assert.equal(ui.input('Approx. Registry Year').props.value, '1995');
  assert.equal(ui.dispatchBeforeUnload(), false);
  for (const year of ['2001', '', '1999']) {
    ui.input('Approx. Registry Year').props.onChange({ target: { value: year } });
    await ui.flush();
    await ui.timers.runLatest();
    await ui.flush();
    const expected = year ? `School (Approximate Registry Year: ${year})` : 'School';
    assert.equal(ui.calls.filter(c => c[0] === 'req:update').at(-1)[2].purpose, expected);
    assert.equal(ui.input('Approx. Registry Year').props.value, year);
    assert.equal(ui.input('Purpose of Request').props.value, 'School');
    assert.equal(ui.dispatchBeforeUnload(), false);
  }
});

test('new document registry year remains accessible after draft creation, including an initially empty year', async () => {
  const ui = harness();
  await ui.flush();
  ui.button('Next Step').props.onClick(); await ui.flush();
  ui.button('Next Step').props.onClick(); await ui.flush();
  ui.input('Purpose of Request').props.onChange({ target: { value: 'School' } });
  await ui.flush();
  await ui.timers.runLatest(); await ui.flush();
  assert.equal(ui.input('Approx. Registry Year').props.value, '');
  ui.input('Approx. Registry Year').props.onChange({ target: { value: '2000' } });
  await ui.flush();
  await ui.timers.runLatest(); await ui.flush();
  assert.equal(ui.input('Approx. Registry Year').props.value, '2000');
  assert.equal(ui.calls.filter(c => c[0] === 'req:update').at(-1)[2].purpose, 'School (Approximate Registry Year: 2000)');
});

test('a stale document response preserves newer purpose and registry year edits', async () => {
  let resolveSave;
  const ui = harness({ draft: documentDraft(), search: '?draftId=446', api: {
    updateDraft: (id, details) => new Promise(resolve => {
      resolveSave = () => resolve({ ...documentDraft(), purpose: details.purpose });
    }),
  } });
  await ui.flush();
  ui.input('Approx. Registry Year').props.onChange({ target: { value: '2001' } });
  await ui.flush();
  const pending = ui.timers.runLatest(); await ui.flush();
  ui.input('Approx. Registry Year').props.onChange({ target: { value: '' } });
  ui.input('Purpose of Request').props.onChange({ target: { value: 'Newer purpose' } });
  await ui.flush();
  resolveSave(); await pending; await ui.flush();
  assert.equal(ui.input('Purpose of Request').props.value, 'Newer purpose');
  assert.equal(ui.input('Approx. Registry Year').props.value, '');
  assert.equal(ui.dispatchBeforeUnload(), true);
});

test('a new document navigation flush creates exactly once and preserves the requested destination', async () => {
  const ui = harness();
  await ui.flush();
  ui.button('Next Step').props.onClick(); await ui.flush();
  ui.button('Next Step').props.onClick(); await ui.flush();
  ui.input('Purpose of Request').props.onChange({ target: { value: 'School' } });
  await ui.flush();
  await ui.navigate('/dashboard/home'); await ui.flush();
  assert.equal(ui.calls.filter(c => c[0] === 'req:create').length, 1);
  assert.equal(ui.path(), '/dashboard/home');
  assert.equal(ui.search(), '');
  assert.equal(ui.timers.count(), 0);
  assert.equal(ui.calls.some(c => c[0].includes('upload')), false);
});

test('document manual Save Draft and successful submission preserve the registry year and allow navigation', async () => {
  const ui = harness({ draft: { ...documentDraft(), attachments: [{ id: '1', category: 'certificate' }] }, search: '?draftId=446' });
  await ui.flush();
  ui.input('Approx. Registry Year').props.onChange({ target: { value: '2000' } }); await ui.flush();
  await ui.button('Save Draft').props.onClick(); await ui.flush();
  assert.equal(ui.input('Approx. Registry Year').props.value, '2000');
  assert.equal(ui.calls.filter(c => c[0] === 'req:update').at(-1)[2].purpose, 'School (Approximate Registry Year: 2000)');
  ui.button('Next Step').props.onClick(); await ui.flush();
  await ui.button('Submit Request').props.onClick(); await ui.flush();
  assert.equal(ui.calls.filter(c => c[0] === 'req:submit').length, 1);
  await ui.navigate('/dashboard/home'); await ui.flush();
  assert.equal(ui.path(), '/dashboard/home');
  assert.equal(ui.dialog().props.isOpen, false);
});

for (const flow of workflows) {
  const setup = extras => harness({ page: flow.page, draft: flow.draft(), search: `?draftId=${flow.id}`, ...extras });
  test(`${flow.page}: React Router PUSH, REPLACE, and POP save first and clean drafts leave without prompts`, async () => {
    for (const [destination, options, expectedPath] of [
      ['/dashboard/profile', undefined, '/dashboard/profile'],
      ['/dashboard/track', { replace: true }, '/dashboard/track'],
      [-1, undefined, '/dashboard/home'],
    ]) {
      const ui = setup();
      await ui.flush();
      flow.edit(ui, 'Pending navigation edit'); await ui.flush();
      await ui.navigate(destination, options);
      assert.notEqual(ui.path(), expectedPath);
      await ui.flush();
      assert.equal(ui.path(), expectedPath);
      assert.equal(ui.calls.filter(c => c[0] === `${flow.prefix}:update`).length, 1);
      assert.equal(ui.dialog().props.isOpen, false);
      assert.equal(ui.calls.some(c => c[0].includes('upload')), false);
    }
    const clean = setup(); await clean.flush();
    await clean.navigate('/dashboard/home'); await clean.flush();
    assert.equal(clean.path(), '/dashboard/home');
    assert.equal(clean.calls.filter(c => c[0] === `${flow.prefix}:update`).length, 0);
  });

  test(`${flow.page}: failed exit offers Stay and Retry, preserves inputs, and Leave Anyway resumes destination`, async () => {
    let fail = true;
    const ui = setup({ [flow.apiKey]: { updateDraft: async (id, details) => {
      ui.calls.push([`${flow.prefix}:update`, id, details]);
      if (fail) throw new Error('Offline');
      return { ...flow.draft(), ...details };
    } } });
    await ui.flush();
    flow.edit(ui, 'Do not lose this'); await ui.flush();
    await ui.navigate('/dashboard/profile'); await ui.flush();
    assert.notEqual(ui.path(), '/dashboard/profile');
    assert.equal(ui.dialog().props.isOpen, true);
    assert.equal(ui.dialog().props.cancelLabel, 'Stay and Retry');
    assert.equal(flow.value(ui), 'Do not lose this');
    ui.dialog().props.onClose(); await ui.flush();
    assert.notEqual(ui.path(), '/dashboard/profile');
    assert.equal(flow.value(ui), 'Do not lose this');
    assert.equal(ui.dispatchBeforeUnload(), true);
    fail = false;
    await ui.navigate('/dashboard/profile'); await ui.flush();
    assert.equal(ui.path(), '/dashboard/profile');

    const offline = setup({ [flow.apiKey]: { updateDraft: async () => { throw new Error('Offline'); } } });
    await offline.flush();
    flow.edit(offline, 'Leave acknowledged'); await offline.flush();
    await offline.navigate('/dashboard/track'); await offline.flush();
    offline.dialog().props.onConfirm(); await offline.flush();
    assert.equal(offline.path(), '/dashboard/track');
    assert.equal(offline.calls.some(c => c[0].includes('upload')), false);
  });

  test(`${flow.page}: navigation waits for autosave and saves newer edits without overlapping requests`, async () => {
    let resolveSave;
    let count = 0;
    const ui = setup({ [flow.apiKey]: { updateDraft: async (id, details) => {
      ui.calls.push([`${flow.prefix}:update`, id, details]);
      if (++count === 1) await new Promise(resolve => { resolveSave = resolve; });
      return { ...flow.draft(), ...details };
    } } });
    await ui.flush();
    flow.edit(ui, 'First edit'); await ui.flush();
    const pending = ui.timers.runLatest(); await ui.flush();
    await ui.navigate('/dashboard/profile'); await ui.flush();
    flow.edit(ui, 'Newest edit'); await ui.flush();
    assert.equal(count, 1);
    assert.notEqual(ui.path(), '/dashboard/profile');
    resolveSave(); await pending; await ui.flush();
    assert.equal(count, 2);
    assert.equal(flow.value(ui), 'Newest edit');
    assert.equal(ui.path(), '/dashboard/profile');
    assert.equal(ui.timers.count(), 0);
  });

  test(`${flow.page}: navigation waits for manual Save Draft without duplicate saves or failure prompts`, async () => {
    let resolveSave;
    const ui = setup({ [flow.apiKey]: { updateDraft: async (id, details) => {
      ui.calls.push([`${flow.prefix}:update`, id, details]);
      await new Promise(resolve => { resolveSave = resolve; });
      return { ...flow.draft(), ...details };
    } } });
    await ui.flush();
    flow.edit(ui, 'Manual save before navigation'); await ui.flush();
    const manualSave = ui.button('Save Draft').props.onClick(); await ui.flush();
    await ui.navigate('/dashboard/profile'); await ui.flush();
    assert.notEqual(ui.path(), '/dashboard/profile');
    assert.equal(ui.dialog().props.isOpen, false);
    resolveSave(); await manualSave; await ui.flush();
    assert.equal(ui.path(), '/dashboard/profile');
    assert.equal(ui.calls.filter(c => c[0] === `${flow.prefix}:update`).length, 1);
    assert.equal(ui.dialog().props.isOpen, false);
  });

  test(`${flow.page}: authentication navigation bypasses unsaved-form guard`, async () => {
    const ui = setup(); await ui.flush();
    flow.edit(ui, 'Unsaved edit'); await ui.flush();
    await ui.navigate('/login'); await ui.flush();
    assert.equal(ui.path(), '/login');
    assert.equal(ui.calls.filter(c => c[0] === `${flow.prefix}:update`).length, 0);
  });

  test(`${flow.page}: Back to Saved Drafts also requires acknowledgement when the final save fails`, async () => {
    const ui = setup({ [flow.apiKey]: { updateDraft: async () => { throw new Error('Offline'); } } });
    await ui.flush();
    flow.edit(ui, 'Unsaved edit'); await ui.flush();
    await ui.button('Back to Saved Drafts').props.onClick(); await ui.flush();
    assert.equal(ui.dialog().props.isOpen, true);
    assert.notEqual(ui.path(), '/dashboard/track');
    ui.dialog().props.onConfirm(); await ui.flush();
    assert.equal(ui.path(), '/dashboard/track');
  });
}
