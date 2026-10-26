import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { buildApplicantName } from '../../testimonium-backend/utils/nameUtils.js';
import { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS } from '../src/config/documents.ts';

// Execute the actual TSX handlers and effects with a small controlled hook runtime.
// No browser, Firebase, database, file storage or network calls are made.
function harness({ page = 'SacramentalRequestPage', draft, requests = [], search = '?draftId=446', api = {}, storage = new Map(), mobile = false } = {}) {
  const state = [];
  const effects = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  let Component;
  const calls = [];
  let currentRequests = requests;
  const parishes = [{ id: '3', name: 'Fixture Parish', availableDocuments: DEFAULT_OFFERED_DOCUMENTS }];
  const location = { search };
  const params = () => new URLSearchParams(location.search);
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (callback, deps) => { const index = cursor++; if (!same(state[index]?.deps, deps)) state[index] = { value: callback(), deps }; return state[index].value; };
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { const next = typeof value === 'function' ? value(state[index]) : value; if (!Object.is(next, state[index])) { state[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return state[index] ||= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(effects[index]?.deps, deps)) effects[index] = { callback, deps, pending: true, cleanup: effects[index]?.cleanup };
    },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
  };
  const request = {
    getRequestById: async id => { calls.push(['get', id]); return draft; },
    getDocumentRequirements: async (...args) => { calls.push(['requirements', ...args]); return { requiredDocuments: [{ id: 'valid_id', required: true }, { id: 'certificate', label: 'Certificate', required: true }] }; },
    createRequest: async payload => { calls.push(['create', payload]); draft = { ...sampleDraft(), ...payload, id: '446', applicantName: buildApplicantName({ firstName: payload.applicantFirstName, middleName: payload.applicantMiddleName, lastName: payload.applicantLastName }) }; return draft; },
    updateDraft: async (id, details) => {
      calls.push(['update', id, details]);
      const { applicantFirstName, applicantMiddleName, applicantLastName, ...savedDetails } = details;
      if (applicantFirstName !== undefined) savedDetails.applicantName = buildApplicantName({ firstName: applicantFirstName, middleName: applicantMiddleName, lastName: applicantLastName });
      draft = { ...draft, ...savedDetails };
      return draft;
    },
    submitDraft: async id => { calls.push(['submit', id]); draft = { ...draft, isDraft: false }; return draft; },
    uploadFiles: async (id, files, category) => { calls.push(['upload', id, files, category]); const uploaded = [{ id: 22, category, fileName: files[0].name, fileSize: files[0].size }]; draft = { ...draft, attachments: [...(draft.attachments || []).filter(a => a.category !== category), ...uploaded] }; return uploaded; },
    uploadRegistrantId: async (id, files) => { calls.push(['private-upload', id, files]); },
    getRequestByTrackingNumber: async value => { calls.push(['search', value]); return draft; },
    deleteDraft: async id => { calls.push(['delete', id]); return { id, cleanupQueued: true }; },
    ...api,
  };
  const navigate = (url, options) => { calls.push(['navigate', url, options]); if (url.startsWith('/dashboard/request?')) { location.search = url.slice(url.indexOf('?')); dirty = true; } };
  const modules = {
    react: { ...React, default: React, __esModule: true },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-dom': { createPortal: child => child },
    'react-router-dom': { useSearchParams: () => [params()], useNavigate: () => navigate },
    '../../providers/factory': { default: { request }, __esModule: true },
    '../../hooks/useService': { useParishes: () => ({ data: parishes, loading: false, refetch() {} }), usePausePolling() {}, useRequests: () => ({ data: currentRequests, loading: false, refetch() {} }) },
    '../../hooks/useProfileRequirement': { useProfileRequirement: () => ({ isProfileIncomplete: false, openProfileModal() {}, requireCompleteProfile: fn => fn() }) },
    '../../contexts/AuthContext': { useAuth: () => ({ appProfile: { id: '12', fullName: 'Juan Dela Cruz', isGovernmentIdVerified: true } }) },
    '../../api/client': { client: {} },
    '../../config/documents': { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS },
    '../../types': { DOCUMENT_RETURN_REASONS: [] },
    '../../utils/uploadPolicy': { UPLOAD_POLICIES: new Proxy({}, { get: () => ({ acceptAttribute: '.pdf,.png' }) }), validateUploadFile: () => ({ valid: true }) },
  };
  const require = name => modules[name] || new Proxy({ __esModule: true }, { get: (_, prop) => prop === '__esModule' ? true : prop === 'default' ? name.split('/').at(-1) : String(prop) });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/pages/dashboard/${page}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    require, module, exports: module.exports, URLSearchParams, console: { error() {} },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    globalThis: { crypto: { randomUUID } },
    window: { location, innerWidth: mobile ? 390 : 1280, matchMedia: () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} },
    document: { body: {} },
  });
  Component = module.exports[page];
  const walk = (node, predicate, results = []) => {
    if (!node || typeof node !== 'object') return results;
    if (Array.isArray(node)) { node.forEach(child => walk(child, predicate, results)); return results; }
    if (predicate(node)) results.push(node);
    walk(node.props?.children, predicate, results);
    return results;
  };
  const textOf = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'object' ? textOf(node.props?.children) : String(node);
  return {
    calls, request, storage,
    async flush() {
      for (let turn = 0; turn < 30; turn++) {
        if (dirty) {
          dirty = false; cursor = 0; tree = Component();
          for (const effect of effects) if (effect?.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.callback(); }
        }
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty) return;
      }
      throw new Error('Hook runtime did not settle');
    },
    nodes: predicate => walk(tree, predicate),
    button(label) { const node = walk(tree, n => ['Button', 'button'].includes(n.type) && textOf(n) === label)[0]; assert.ok(node, `Missing button ${label}`); return node; },
    input(label) { const node = walk(tree, n => n.type === 'Input' && n.props.label === label)[0]; assert.ok(node, `Missing input ${label}`); return node; },
    text: () => textOf(tree),
    rerender() { dirty = true; },
    setRequests(value) { currentRequests = value; dirty = true; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

function sampleDraft(overrides = {}) {
  return {
    id: '446', parishId: '3', parish: { parishName: 'Fixture Parish' }, rawDocumentType: 'BAPTISMAL_CERTIFICATE', documentType: 'baptism',
    isDraft: true, status: 'pending', trackingNumber: 'SR-2026-000446', applicantName: 'Juan Santos Cruz',
    relationship: 'Self', purpose: 'School (Approximate Registry Year: 1995)', updatedAt: '2026-10-17',
    attachments: [{ id: 1, category: 'certificate', fileName: 'saved.pdf', fileType: 'application/pdf', fileSize: 123 }],
    ...overrides,
  };
}

test('dynamic Endorsement Letter checklist blocks missing uploads, submits its category and honors disabled metadata for all seven types', async () => {
  const endorsement = { id: 'endorsement_letter', label: 'Endorsement Letter', category: 'supporting', required: true };
  for (const doc of CANONICAL_DOCUMENT_TYPES) {
    for (const enabled of [true, false]) {
      const h = harness({
        draft: sampleDraft({ rawDocumentType: doc.id, attachments: [] }),
        api: { getDocumentRequirements: async () => ({ requiredDocuments: [{ id: 'valid_id', label: 'Valid Government ID', required: true }, ...(enabled ? [endorsement] : [])] }) },
      });
      await h.flush();
      h.button('Next Step').props.onClick(); await h.flush();
      assert.equal(h.text().includes('Endorsement Letter'), enabled);
      assert.equal(h.button('Submit Request').props.disabled, enabled);
      if (enabled) {
        const picker = h.nodes((n) => n.type === 'input' && n.props.type === 'file')[0];
        assert.ok(picker, 'dynamic supporting requirement must use the existing file input');
        picker.props.onChange({ target: { files: [{ name: 'endorsement.pdf', size: 1234 }], value: 'local' } });
        await h.flush();
        assert.equal(h.button('Submit Request').props.disabled, false);
      }
      await h.button('Submit Request').props.onClick(); await h.flush();
      assert.match(h.text(), /Request Submitted Successfully/);
      assert.deepEqual(h.calls.filter((c) => c[0] === 'upload').map((c) => c[3]), enabled ? ['endorsement_letter'] : []);
      assert.equal(h.calls.filter((c) => c[0] === 'submit').length, 1);
      h.unmount();
    }
  }
});

test('saved Endorsement Letter satisfies a resumed draft and can be replaced without duplicate attachments', async () => {
  const h = harness({
    draft: sampleDraft({ attachments: [{ id: 1, category: 'endorsement_letter', fileName: 'existing-endorsement.pdf' }] }),
    api: { getDocumentRequirements: async () => ({ requiredDocuments: [{ id: 'endorsement_letter', label: 'Endorsement Letter', category: 'supporting', required: true }] }) },
  });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  assert.equal(h.button('Submit Request').props.disabled, false);
  assert.match(h.text(), /Already uploaded: existing-endorsement.pdf/);
  h.nodes((n) => n.type === 'input' && n.props.type === 'file')[0].props.onChange({ target: { files: [{ name: 'replacement.pdf', size: 100 }], value: 'local' } });
  await h.flush();
  await h.button('Submit Request').props.onClick(); await h.flush();
  const saved = await h.request.getRequestById('446');
  assert.equal(saved.attachments.length, 1);
  assert.equal(saved.attachments[0].category, 'endorsement_letter');
  assert.equal(saved.attachments[0].fileName, 'replacement.pdf');
});

test('tracking displays Endorsement Letter corrections and submits a replacement through the existing endpoint', async () => {
  const request = sampleDraft({ isDraft: false, status: 'needs-correction', correctionRequirementIds: ['endorsement_letter'], attachments: [{ id: 1, category: 'endorsement_letter', fileName: 'original.pdf' }] });
  const h = harness({
    page: 'RequestTrackingPage', requests: [request], draft: request, search: '?requestId=446',
    api: {
      getDocumentRequirements: async () => ({ requiredDocuments: [{ id: 'endorsement_letter', label: 'Endorsement Letter', category: 'supporting', required: true }] }),
      resubmitCorrections: async (id) => { h.calls.push(['resubmit', id]); return { ...request, status: 'under-review' }; },
    },
  });
  await h.flush();
  assert.match(h.text(), /Endorsement Letter/);
  assert.match(h.text(), /Current: original.pdf/);
  assert.equal(h.button('Submit Corrections').props.disabled, true);
  h.nodes((n) => n.type === 'input' && n.props.type === 'file')[0].props.onChange({ target: { files: [{ name: 'corrected-endorsement.pdf', size: 100 }], value: 'local' } });
  await h.flush();
  assert.equal(h.button('Submit Corrections').props.disabled, false);
  await h.button('Submit Corrections').props.onClick(); await h.flush();
  assert.deepEqual(h.calls.filter((c) => c[0] === 'upload').map((c) => c[3]), ['endorsement_letter']);
  assert.deepEqual(h.calls.filter((c) => c[0] === 'resubmit').map((c) => c[1]), ['446']);
});

test('opening and refreshing restore the canonical saved draft into first, middle, and last name inputs without banners or validation errors', async () => {
  for (let refresh = 0; refresh < 2; refresh++) {
    const h = harness({ draft: sampleDraft() });
    await h.flush();
    assert.equal(h.text().includes('Saved registrant name'), false);
    assert.equal(h.text().includes('Leave the name fields unchanged'), false);
    assert.equal(h.input('First Name *').props.value, 'Juan');
    assert.equal(h.input('Middle Name (Optional)').props.value, 'Santos');
    assert.equal(h.input('Last Name *').props.value, 'Cruz');
    assert.equal(h.input('Purpose of Request').props.value, 'School (Approximate Registry Year: 1995)');
    assert.equal(h.button('Next Step').props.disabled, false);

    // Clearing First Name disables Next Step using original behavior, without error messages
    h.input('First Name *').props.onChange({ target: { value: '' } });
    await h.flush();
    assert.equal(h.button('Next Step').props.disabled, true);
    assert.equal(h.text().includes('First name is required'), false);

    // Restoring First Name and clearing Last Name disables Next Step
    h.input('First Name *').props.onChange({ target: { value: 'Juan' } });
    h.input('Last Name *').props.onChange({ target: { value: '' } });
    await h.flush();
    assert.equal(h.button('Next Step').props.disabled, true);
    assert.equal(h.text().includes('Last name is required'), false);

    // Correcting name saves to the existing draft and retains editable fields
    h.input('Last Name *').props.onChange({ target: { value: 'Dela Cruz' } });
    await h.flush();
    assert.equal(h.button('Next Step').props.disabled, false);
    await h.button('Save Draft').props.onClick();
    await h.flush();
    await h.button('Save Draft').props.onClick();
    await h.flush();
    const updates = h.calls.filter(c => c[0] === 'update');
    assert.equal(updates.length, 2);
    assert.equal(updates[0][1], '446');
    assert.equal(updates[1][2].purpose, 'School (Approximate Registry Year: 1995)');
    assert.equal(updates[0][2].applicantFirstName, 'Juan');
    assert.equal(updates[0][2].applicantLastName, 'Dela Cruz');
    assert.ok(!Object.hasOwn(updates[1][2], 'applicantName'));
    assert.ok(!Object.hasOwn(updates[1][2], 'applicantFirstName'));
    assert.equal(h.input('First Name *').props.value, 'Juan');
    assert.equal(h.input('Last Name *').props.value, 'Dela Cruz');
    assert.equal(h.calls.filter(c => ['create', 'upload', 'private-upload', 'submit'].includes(c[0])).length, 0);
    assert.ok(h.calls.some(c => c[0] === 'requirements' && c[1] === 'BAPTISMAL_CERTIFICATE' && c[2] === '3' && c[3] === 'Self'));
    h.unmount();
  }
});

test('legacy combined names with ambiguous boundaries preserve the stored value conservatively without banners or corruption', async () => {
  const legacyDraft = sampleDraft({ applicantName: 'Dela Cruz, Juan Miguel Jr.' });
  const h = harness({ draft: legacyDraft });
  await h.flush();
  assert.equal(h.text().includes('Saved registrant name'), false);
  assert.equal(h.text().includes('Leave the name fields unchanged'), false);
  assert.equal(h.input('First Name *').props.value, '');
  assert.equal(h.input('Middle Name (Optional)').props.value, '');
  assert.equal(h.input('Last Name *').props.value, '');
  assert.equal(h.button('Next Step').props.disabled, true);
  // Editing purpose only preserves original legacy name in database
  h.input('Purpose of Request').props.onChange({ target: { value: 'Passport' } });
  await h.flush();
  await h.button('Save Draft').props.onClick();
  await h.flush();
  const updates = h.calls.filter(c => c[0] === 'update');
  assert.equal(updates.length, 1);
  assert.equal(updates[0][2].purpose, 'Passport');
  assert.ok(!Object.hasOwn(updates[0][2], 'applicantName'));
  assert.ok(!Object.hasOwn(updates[0][2], 'applicantFirstName'));
  assert.equal((await h.request.getRequestById('446')).applicantName, 'Dela Cruz, Juan Miguel Jr.');
});

test('new requests and resumed drafts render the same three name fields, attributes and layout', async () => {
  const newRequest = harness({ search: '' });
  await newRequest.flush();
  newRequest.button('Next Step').props.onClick(); await newRequest.flush();
  newRequest.button('Next Step').props.onClick(); await newRequest.flush();
  const resumed = harness({ draft: sampleDraft() });
  await resumed.flush();
  const labels = ['First Name *', 'Middle Name (Optional)', 'Last Name *'];
  const fields = h => labels.map(label => {
    const input = h.input(label);
    return [input.props.label, input.props.placeholder, input.props.maxLength, Boolean(input.props.required)];
  });
  assert.deepEqual(fields(resumed), fields(newRequest));
  for (const h of [newRequest, resumed]) {
    assert.equal(h.nodes(n => n.type === 'Input' && n.props.label === 'Full Legal Name *').length, 0);
    const grid = h.nodes(n => n.type === 'div' && n.props.className === 'grid grid-cols-1 sm:grid-cols-3 gap-3')[0];
    assert.deepEqual(Array.from(grid.props.children, input => input.props.label), labels);
  }
});

test('purpose-only and relationship-only edits omit all name fields and retain the exact saved name', async () => {
  const originalName = '  Dela Cruz,  Juan Miguel Jr.  ';
  const h = harness({ draft: sampleDraft({ applicantName: originalName }) });
  await h.flush();
  assert.equal(h.text().includes('Saved registrant name'), false);
  h.input('Purpose of Request').props.onChange({ target: { value: 'Passport' } }); await h.flush();
  await h.button('Save Draft').props.onClick(); await h.flush();
  h.nodes(n => n.type === 'CustomSelect' && n.props.value === 'Self')[0].props.onChange('Parent'); await h.flush();
  await h.button('Save Draft').props.onClick(); await h.flush();
  for (const update of h.calls.filter(c => c[0] === 'update')) {
    assert.equal(update[1], '446');
    for (const field of ['applicantName', 'applicantFirstName', 'applicantMiddleName', 'applicantLastName']) assert.equal(Object.hasOwn(update[2], field), false);
  }
  assert.equal((await h.request.getRequestById('446')).applicantName, originalName);
  assert.equal(h.text().includes('Saved registrant name'), false);
  for (const label of ['First Name *', 'Middle Name (Optional)', 'Last Name *']) assert.equal(h.input(label).props.value, '');
  assert.equal(h.calls.filter(c => c[0] === 'create').length, 0);

  // Also verify for standard restored names (e.g. Juan Santos Cruz): editing only purpose does not change saved name
  const standardDraft = harness({ draft: sampleDraft() });
  await standardDraft.flush();
  assert.equal(standardDraft.input('First Name *').props.value, 'Juan');
  standardDraft.input('Purpose of Request').props.onChange({ target: { value: 'Personal Copy' } });
  await standardDraft.flush();
  await standardDraft.button('Save Draft').props.onClick();
  await standardDraft.flush();
  const standardUpdates = standardDraft.calls.filter(c => c[0] === 'update');
  assert.equal(standardUpdates.length, 1);
  assert.equal(standardUpdates[0][2].purpose, 'Personal Copy');
  for (const field of ['applicantName', 'applicantFirstName', 'applicantMiddleName', 'applicantLastName']) {
    assert.equal(Object.hasOwn(standardUpdates[0][2], field), false);
  }
  assert.equal((await standardDraft.request.getRequestById('446')).applicantName, 'Juan Santos Cruz');
});

test('blank or incomplete explicit name edits cannot save or replace the original name', async () => {
  for (const [first, middle, last] of [['Juan', '', ''], ['', 'Santos', ''], ['', '', 'Dela Cruz'], ['', '', '']]) {
    const h = harness({ draft: sampleDraft() });
    await h.flush();
    h.input('First Name *').props.onChange({ target: { value: first } });
    h.input('Middle Name (Optional)').props.onChange({ target: { value: middle } });
    h.input('Last Name *').props.onChange({ target: { value: last } }); await h.flush();
    assert.equal(h.button('Save Draft').props.disabled, true);
    assert.equal(h.button('Next Step').props.disabled, true);
    // Handler guards also prevent an incomplete save independently of the button state.
    await h.button('Save Draft').props.onClick(); await h.flush();
    assert.match(h.text(), /First name and last name are required/);
    assert.equal((await h.request.getRequestById('446')).applicantName, sampleDraft().applicantName);
    assert.equal(h.calls.filter(c => ['create', 'update'].includes(c[0])).length, 0);
  }
});

test('explicit name corrections preserve ordering, optional middle name and the existing draft ID', async () => {
  for (const middle of [' Santos ', '']) {
    const h = harness({ draft: sampleDraft() });
    await h.flush();
    h.input('First Name *').props.onChange({ target: { value: ' Juan  Miguel ' } });
    h.input('Middle Name (Optional)').props.onChange({ target: { value: middle } });
    h.input('Last Name *').props.onChange({ target: { value: ' Dela  Cruz ' } }); await h.flush();
    await h.button('Save Draft').props.onClick(); await h.flush();
    assert.equal((await h.request.getRequestById('446')).applicantName, middle ? 'Juan Miguel Santos Dela Cruz' : 'Juan Miguel Dela Cruz');
    assert.deepEqual(h.calls.filter(c => c[0] === 'update').map(c => c[1]), ['446']);
    assert.equal(h.calls.filter(c => c[0] === 'create').length, 0);
    // Known name parts stay available during the current wizard session.
    assert.equal(h.input('First Name *').props.value, ' Juan  Miguel ');
    assert.equal(h.input('Last Name *').props.value, ' Dela  Cruz ');
  }
});

test('resume preserves saved parish and document type as explicit read-only selections', async () => {
  const h = harness({ draft: sampleDraft() });
  await h.flush();
  h.button('Back').props.onClick(); await h.flush();
  assert.match(h.text(), /Baptismal Certificate — Saved document type \(read-only\)/);
  h.button('Back').props.onClick(); await h.flush();
  assert.match(h.text(), /Fixture Parish — Saved parish \(read-only\)/);
});

test('missing, forbidden and already submitted drafts never enable creation or submission', async () => {
  for (const draft of [null, sampleDraft({ isDraft: false }), 'forbidden']) {
    const h = harness({ draft, api: draft === 'forbidden' ? { getRequestById: async () => { throw new Error('Access denied'); } } : {} });
    await h.flush();
    assert.equal(h.nodes(n => n.type === 'ErrorState').length, 1);
    assert.equal(h.calls.filter(c => ['create', 'submit', 'update'].includes(c[0])).length, 0);
  }
});

test('submission reuses saved requirements, keeps the error above actions, and retries the original draft after a legal-name correction', async () => {
  let attempts = 0;
  const h = harness({ draft: sampleDraft(), api: { submitDraft: async id => { h.calls.push(['submit', id]); if (++attempts === 1) throw { code: 'SELF_REGISTRANT_NAME_MISMATCH', message: 'Correct the legal name.' }; return sampleDraft({ isDraft: false }); } } });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  assert.match(h.text(), /Already uploaded: saved.pdf/);
  assert.equal(h.button('Submit Request').props.disabled, false);
  await h.button('Submit Request').props.onClick(); await h.flush();
  assert.equal(h.nodes(n => n.props?.role === 'alert')[0].props.children[1].props.children, 'Correct the legal name.');
  assert.ok(h.text().indexOf('Correct the legal name.') < h.text().indexOf('Submit Request'));
  h.button('Back').props.onClick(); await h.flush();
  h.input('First Name *').props.onChange({ target: { value: 'Juan' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Dela Cruz' } }); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  await h.button('Submit Request').props.onClick(); await h.flush();
  assert.match(h.text(), /Request Submitted Successfully/);
  assert.deepEqual(h.calls.filter(c => c[0] === 'submit').map(c => c[1]), ['446', '446']);
  assert.equal(h.calls.filter(c => ['create', 'upload', 'private-upload'].includes(c[0])).length, 0);
});

test('new draft rapid saves create once, preserve selected files locally, and write a resumable URL', async () => {
  const h = harness({ search: '' });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.input('First Name *').props.onChange({ target: { value: 'Juan' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Dela Cruz' } }); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  const file = { name: 'new.pdf', size: 1234 };
  h.nodes(n => n.type === 'input' && n.props.type === 'file')[0].props.onChange({ target: { files: [file], value: 'local' } }); await h.flush();
  const save = h.button('Save Draft').props.onClick;
  await Promise.all([save(), save()]); await h.flush();
  assert.equal(h.calls.filter(c => c[0] === 'create').length, 1);
  assert.ok(h.calls.some(c => c[0] === 'navigate' && c[1] === '/dashboard/request?draftId=446' && c[2].replace));
  assert.match(h.text(), /new.pdf.*Selected locally/);
  assert.equal(h.calls.filter(c => ['upload', 'private-upload', 'submit'].includes(c[0])).length, 0);
});

test('failed creation retries reuse the idempotency key across refreshes', async () => {
  const storage = new Map();
  const keys = [];
  for (let refresh = 0; refresh < 2; refresh++) {
    const h = harness({ search: '', storage, api: { createRequest: async payload => { keys.push(payload.idempotencyKey); throw new Error('Connection interrupted. Retry saving.'); } } });
    await h.flush();
    h.button('Next Step').props.onClick(); await h.flush(); h.button('Next Step').props.onClick(); await h.flush();
    h.input('First Name *').props.onChange({ target: { value: 'Juan' } }); h.input('Last Name *').props.onChange({ target: { value: 'Dela Cruz' } }); await h.flush();
    await h.button('Save Draft').props.onClick(); await h.flush();
    assert.match(h.text(), /Connection interrupted/);
    h.unmount();
  }
  assert.equal(keys[0], keys[1]);
});

test('partial upload failure preserves successful uploads and uploads only the remaining selected files on retry', async () => {
  let uploads = 0;
  const draft = sampleDraft({ attachments: [] });
  const h = harness({ draft, api: {
    getDocumentRequirements: async () => ({ requiredDocuments: [{ id: 'one', label: 'One', required: true }, { id: 'two', label: 'Two', required: true }] }),
    uploadFiles: async (id, files, category) => { h.calls.push(['upload', id, files, category]); if (++uploads === 2) throw new Error('Second upload failed'); const result = [{ id: uploads, fileName: files[0].name, category }]; draft.attachments.push(...result); return result; },
  } });
  await h.flush(); h.button('Next Step').props.onClick(); await h.flush();
  for (const [index, input] of h.nodes(n => n.type === 'input' && n.props.type === 'file').entries()) input.props.onChange({ target: { files: [{ name: `${index}.pdf`, size: 100 }], value: '' } });
  await h.flush();
  await h.button('Submit Request').props.onClick(); await h.flush();
  assert.match(h.text(), /Second upload failed/);
  await h.button('Submit Request').props.onClick(); await h.flush();
  assert.deepEqual(h.calls.filter(c => c[0] === 'upload').map(c => c[3]), ['one', 'two', 'two']);
  assert.equal(h.calls.filter(c => c[0] === 'create').length, 0);
  assert.match(h.text(), /Request Submitted Successfully/);
});

test('non-Self drafts restore uploaded private ID sides and authorization letter and do not upload them twice', async () => {
  const h = harness({ draft: sampleDraft({ relationship: 'Parent', attachments: [...sampleDraft().attachments, { category: 'authorization_letter', fileName: 'authorization.pdf' }], registrantIdEvidence: { frontUploadedAt: '2026-10-16', backUploadedAt: '2026-10-16' } }) });
  await h.flush(); h.button('Next Step').props.onClick(); await h.flush();
  assert.match(h.text(), /Private registrant ID front image already uploaded/);
  assert.match(h.text(), /Private registrant ID back image already uploaded/);
  assert.match(h.text(), /Already uploaded: authorization.pdf/);
  assert.equal(h.button('Submit Request').props.disabled, false);
  await h.button('Submit Request').props.onClick(); await h.flush();
  assert.equal(h.calls.filter(c => ['upload', 'private-upload', 'create'].includes(c[0])).length, 0);
});

test('missing non-Self evidence and failed authoritative checklist loading keep submission disabled', async () => {
  for (const api of [{}, { getDocumentRequirements: async () => { throw new Error('Requirements unavailable'); } }]) {
    const h = harness({ draft: sampleDraft({ relationship: 'Parent' }), api });
    await h.flush();
    if (h.nodes(n => n.type === 'ErrorState').length) continue;
    h.button('Next Step').props.onClick(); await h.flush();
    assert.ok(h.button('Submit Request').props.disabled);
  }
});

test('tracking separates drafts from submitted requests, shows neutral Draft badges and moves finalized drafts', async () => {
  for (const mobile of [false, true]) {
    const requests = [sampleDraft(), sampleDraft({ id: '447', trackingNumber: 'SUBMITTED-447', isDraft: false })];
    const h = harness({ page: 'RequestTrackingPage', requests, draft: requests[0], search: '', mobile });
    await h.flush();
    const lists = h.nodes(n => n.type === 'div' && n.props.className === 'bg-white rounded-card border border-border p-5 shadow-xs');
    const saved = lists.find(n => JSON.stringify(n).includes('Saved Drafts'));
    const submitted = lists.find(n => JSON.stringify(n).includes('My Submitted Requests'));
    assert.ok(JSON.stringify(saved).includes('SR-2026-000446'));
    assert.ok(!JSON.stringify(submitted).includes('SR-2026-000446'));
    assert.ok(JSON.stringify(submitted).includes('SUBMITTED-447'));
    assert.ok(h.nodes(n => n.type === 'Badge' && n.props.variant === 'neutral' && n.props.children === 'Draft').length);
    assert.equal(h.nodes(n => ['PaymentInstructionsCard', 'ReceiptUploadCard'].includes(n.type)).length, 0);
    h.setRequests([{ ...requests[0], isDraft: false }, requests[1]]); await h.flush();
    assert.match(h.text(), /No saved drafts/);
    assert.equal(h.nodes(n => n.type === 'Badge' && n.props.children === 'Draft').length, 0);
  }
});

test('tracking-number search identifies a draft and offers Resume Draft without payment or processing actions', async () => {
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft({ id: '99', isDraft: false })], draft: sampleDraft({ status: 'payment-pending' }), search: '' });
  await h.flush();
  h.nodes(n => n.type === 'SearchInput' && n.props.id === 'search-tracking-input')[0].props.onChange({ target: { value: 'SR-2026-000446' } }); await h.flush();
  await h.nodes(n => n.type === 'form' && n.props.onSubmit)[0].props.onSubmit({ preventDefault() {} }); await h.flush();
  assert.match(h.text(), /This is a saved draft. It has not been submitted/);
  h.button('Resume Draft').props.onClick();
  assert.ok(h.calls.some(c => c[0] === 'navigate' && c[1] === '/dashboard/request?draftId=446'));
  assert.equal(h.nodes(n => ['PaymentInstructionsCard', 'ReceiptUploadCard'].includes(n.type)).length, 0);
});

test('API provider traverses list pages so drafts older than page one remain discoverable; PATCH and submit preserve the ID', async () => {
  const calls = [];
  const module = { exports: {} };
  const draft = sampleDraft({ documentType: 'BAPTISMAL_CERTIFICATE' });
  const client = {
    get: async (url, query) => { calls.push(['get', url, query]); return query.page === 1 ? Array.from({ length: 100 }, (_, index) => ({ ...draft, id: index + 1, isDraft: false })) : [draft]; },
    patch: async (url, details) => { calls.push(['patch', url, details]); return { ...draft, ...details }; },
    post: async url => { calls.push(['post', url]); return { ...draft, isDraft: false }; },
    delete: async url => { calls.push(['delete', url]); return { id: 446, cleanupQueued: true }; },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/providers/api/request.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require: () => ({ client }) });
  const provider = new module.exports.ApiRequestProvider();
  const result = await provider.getRequests();
  assert.equal(result.length, 101);
  assert.equal(result[100].isDraft, true);
  assert.equal(result[100].id, '446');
  await provider.updateDraft('446', { applicantName: 'Juan', relationship: 'Self', purpose: 'School' });
  await provider.submitDraft('446');
  assert.equal((await provider.deleteDraft('446')).id, '446');
  assert.deepEqual(calls.filter(c => c[0] !== 'get').map(c => c.slice(0, 2)), [['patch', '/requests/446'], ['post', '/requests/446/submit'], ['delete', '/requests/446']]);
});

test('Discard Draft requires confirmation; Keep Draft leaves the request and uploads untouched', async () => {
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft()], search: '' });
  await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal').length, 0);
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 0);
  h.button('Discard Draft').props.onClick(); await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal')[0].props.title, 'Discard saved draft?');
  assert.match(h.text(), /including private registrant-ID images/);
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 0);
  h.button('Keep Draft').props.onClick(); await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal').length, 0);
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 0);
  assert.match(h.text(), /SR-2026-000446/);
});

test('confirmed deletion removes the draft immediately on desktop/mobile and stale polls cannot restore it', async () => {
  for (const mobile of [false, true]) {
    const requests = [sampleDraft()];
    const h = harness({ page: 'RequestTrackingPage', requests, search: '', mobile });
    await h.flush();
    h.button('Discard Draft').props.onClick(); await h.flush();
    await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
    assert.deepEqual(h.calls.filter(c => c[0] === 'delete'), [['delete', '446']]);
    assert.equal(h.nodes(n => n.type === 'Modal').length, 0);
    assert.match(h.text(), /Draft deleted. Uploaded files are queued for secure cleanup/);
    assert.doesNotMatch(h.text(), /SR-2026-000446/);
    assert.equal(h.nodes(n => n.props?.role === 'status').length, 1);
    h.setRequests([...requests]); await h.flush();
    assert.doesNotMatch(h.text(), /SR-2026-000446/);
  }
});

test('duplicate confirmation clicks issue only one DELETE request', async () => {
  let complete;
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft()], search: '', api: { deleteDraft: id => {
    h.calls.push(['delete', id]); return new Promise(resolve => { complete = () => resolve({ id, cleanupQueued: false }); });
  } } });
  await h.flush(); h.button('Discard Draft').props.onClick(); await h.flush();
  const confirm = h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick;
  const first = confirm(); const second = confirm(); await h.flush();
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 1);
  assert.equal(h.button('Keep Draft').props.disabled, true);
  h.nodes(n => n.type === 'Modal')[0].props.onClose(); await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal').length, 1);
  complete(); await Promise.all([first, second]); await h.flush();
  assert.match(h.text(), /Draft deleted successfully/);
});

test('deletion failures remain visible in the confirmation dialog and allow a safe retry', async () => {
  let attempts = 0;
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft()], search: '', api: { deleteDraft: async id => {
    h.calls.push(['delete', id]); if (++attempts === 1) throw new Error('Unable to delete. Please try again.'); return { id, cleanupQueued: false };
  } } });
  await h.flush(); h.button('Discard Draft').props.onClick(); await h.flush();
  await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal').length, 1);
  assert.match(h.text(), /Unable to delete. Please try again/);
  assert.equal(h.nodes(n => n.props?.role === 'alert').length, 1);
  assert.match(h.text(), /SR-2026-000446/);
  await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
  assert.equal(h.nodes(n => n.type === 'Modal').length, 0);
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 2);
});

test('submitted requests expose no draft deletion action', async () => {
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft({ isDraft: false })], search: '' });
  await h.flush();
  assert.equal(h.nodes(n => n.type === 'Button' && n.props.children === 'Discard Draft').length, 0);
  assert.equal(h.calls.filter(c => c[0] === 'delete').length, 0);
});

test('deletion clears an old requestId link without redirecting to notifications', async () => {
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft()], draft: sampleDraft(), search: '?requestId=446' });
  await h.flush();
  h.button('Discard Draft').props.onClick(); await h.flush();
  await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
  assert.ok(h.calls.some(c => c[0] === 'navigate' && c[1] === '/dashboard/track' && c[2].replace));
  assert.ok(!h.calls.some(c => c[0] === 'navigate' && c[1] === '/dashboard/notifications'));
  assert.doesNotMatch(h.text(), /SR-2026-000446/);
});

test('a draft found by tracking-number search can be deleted without affecting submitted requests', async () => {
  const submitted = sampleDraft({ id: '447', trackingNumber: 'SUBMITTED-447', isDraft: false });
  const h = harness({ page: 'RequestTrackingPage', requests: [submitted], draft: sampleDraft(), search: '' });
  await h.flush();
  h.nodes(n => n.type === 'SearchInput' && n.props.id === 'search-tracking-input')[0].props.onChange({ target: { value: 'SR-2026-000446' } }); await h.flush();
  await h.nodes(n => n.type === 'form' && n.props.onSubmit)[0].props.onSubmit({ preventDefault() {} }); await h.flush();
  h.button('Discard Draft').props.onClick(); await h.flush();
  await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
  assert.match(h.text(), /SUBMITTED-447/);
  assert.doesNotMatch(h.text(), /SR-2026-000446/);
  assert.deepEqual(h.calls.filter(c => c[0] === 'delete'), [['delete', '446']]);
});

test('submission in another tab is reported as a deletion error and leaves the submitted record intact', async () => {
  const h = harness({ page: 'RequestTrackingPage', requests: [sampleDraft()], search: '', api: { deleteDraft: async () => {
    throw { code: 'REQUEST_NOT_DRAFT', message: 'Submitted requests cannot be deleted.' };
  } } });
  await h.flush();
  h.button('Discard Draft').props.onClick(); await h.flush();
  h.setRequests([sampleDraft({ isDraft: false })]); await h.flush();
  await h.nodes(n => n.type === 'Button' && n.props.variant === 'primary').at(-1).props.onClick(); await h.flush();
  assert.match(h.text(), /Submitted requests cannot be deleted/);
  assert.match(h.text(), /SR-2026-000446/);
  assert.equal(h.nodes(n => n.props?.role === 'status').length, 0);
});
