import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS } from '../src/config/documents.ts';

function harness({
  page = 'SacramentalRequestPage',
  draft = null,
  search = '',
  initialProfile = { id: '12', firebaseUid: 'uid-1', fullName: 'Juan Santos Dela Cruz', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', isGovernmentIdVerified: true },
  user = { uid: 'uid-1' },
  api = {},
} = {}) {
  const state = [];
  const effects = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  let currentProfile = initialProfile;
  let currentUser = user;
  const calls = [];
  const parishes = [{ id: '3', name: 'Fixture Parish', availableDocuments: DEFAULT_OFFERED_DOCUMENTS }];
  const location = { search };
  const params = () => new URLSearchParams(location.search);
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

  const request = {
    getRequestById: async id => { calls.push(['get', id]); return draft; },
    getDocumentRequirements: async (...args) => {
      calls.push(['requirements', ...args]);
      const rel = args[2] || 'Self';
      const isFamily = ['Parent', 'Child', 'Spouse', 'Sibling'].includes(rel);
      return {
        requiredDocuments: [{ id: 'valid_id', label: 'Valid Government ID', required: true }],
        relationshipEvidence: rel === 'Self'
          ? []
          : [
              {
                id: 'authorization_letter',
                label: isFamily ? 'Proof of Relationship / Authorization Letter' : 'Authorization Letter',
                description: isFamily
                  ? "Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant."
                  : 'Signed authorization letter for a request made for another person.',
                required: true,
              },
              { id: 'registrant_id_front', label: 'Registrant Government ID - Front', required: true },
              { id: 'registrant_id_back', label: 'Registrant Government ID - Back', required: true },
            ],
      };
    },
    createRequest: async payload => { calls.push(['create', payload]); return { id: '501', isDraft: true, ...payload, attachments: [] }; },
    updateDraft: async (id, details) => {
      calls.push(['update', id, details]);
      const applicantName = details.applicantFirstName === undefined ? draft?.applicantName : [details.applicantFirstName, details.applicantMiddleName, details.applicantLastName].filter(Boolean).join(' ');
      return { ...draft, id, isDraft: true, ...details, applicantName, attachments: [] };
    },
    uploadFiles: async (id, files, category) => { calls.push(['upload', id, files[0]?.name, category]); return [{ id: 1, category, fileName: files[0]?.name }]; },
    uploadRegistrantId: async (id, files) => { calls.push(['private-upload', id, Boolean(files.front), Boolean(files.back)]); },
    submitDraft: async id => { calls.push(['submit', id]); return { id, isDraft: false, trackingNumber: 'SR-2026-000501' }; },
    ...api,
  };

  const modules = {
    react: { ...React, default: React, __esModule: true },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-dom': { createPortal: child => child },
    'react-router-dom': { useSearchParams: () => [params()], useNavigate: () => () => {} },
    '../../providers/factory': { default: { request }, __esModule: true },
    '../../hooks/useService': { useParishes: () => ({ data: parishes, loading: false, refetch() {} }), usePausePolling() {} },
    '../../hooks/useProfileRequirement': { useProfileRequirement: () => ({ isProfileIncomplete: false, openProfileModal() {} }) },
    '../../contexts/AuthContext': { useAuth: () => ({ appProfile: currentProfile, user: currentUser }) },
    '../../config/documents': { CANONICAL_DOCUMENT_TYPES, DEFAULT_OFFERED_DOCUMENTS },
    '../../utils/uploadPolicy': { UPLOAD_POLICIES: new Proxy({}, { get: () => ({ acceptAttribute: '.pdf,.png,.jpg' }) }), validateUploadFile: () => ({ valid: true }) },
  };
  const require = name => modules[name] || new Proxy({ __esModule: true }, { get: (_, prop) => (prop === '__esModule' ? true : prop === 'default' ? name.split('/').at(-1) : String(prop)) });
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
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      globalThis: { crypto: { randomUUID } },
      window: { location },
    }
  );
  const Component = module.exports[page];
  const walk = (node, predicate, results = []) => {
    if (!node || typeof node !== 'object') return results;
    if (Array.isArray(node)) { node.forEach(c => walk(c, predicate, results)); return results; }
    if (predicate(node)) results.push(node);
    walk(node.props?.children, predicate, results);
    return results;
  };
  const textOf = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'object' ? textOf(node.props?.children) : String(node);

  return {
    calls,
    resolveSelfProfileName: module.exports.resolveSelfProfileName,
    async flush() {
      for (let turn = 0; turn < 30; turn++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = Component();
          for (const effect of effects) {
            if (effect?.pending) {
              effect.pending = false;
              effect.cleanup?.();
              effect.cleanup = effect.callback();
            }
          }
        }
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty) return;
      }
      throw new Error('Did not settle');
    },
    setProfile(profile, nextUser = currentUser) {
      currentProfile = profile;
      currentUser = nextUser;
      dirty = true;
    },
    nodes: predicate => walk(tree, predicate),
    button(label) { const n = walk(tree, x => ['Button', 'button'].includes(x.type) && textOf(x) === label)[0]; assert.ok(n, `Missing button ${label}`); return n; },
    input(label) { const n = walk(tree, x => x.type === 'Input' && x.props.label === label)[0]; assert.ok(n, `Missing input ${label}`); return n; },
    selectRelationship(rel) { const s = walk(tree, x => x.type === 'CustomSelect' && ['Self', 'Parent', 'Child', 'Spouse', 'Sibling', 'Other Relative', 'Authorized Representative'].includes(x.props.value))[0]; assert.ok(s, 'Missing relationship select'); s.props.onChange(rel); },
    text: () => textOf(tree),
    unmount() { effects.forEach(e => e?.cleanup?.()); },
  };
}

test('Web Self auto-fill populates First, Middle, Last name and handles rapid switching & delayed profile', async () => {
  const h = harness({ initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: '', isGovernmentIdVerified: true } });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();

  // Delayed profile arrives while on Self
  assert.equal(h.input('First Name *').props.value, '');
  h.setProfile({ id: '12', firebaseUid: 'uid-1', fullName: 'Juan Santos Dela Cruz', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', isGovernmentIdVerified: true });
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan');
  assert.equal(h.input('Middle Name (Optional)').props.value, 'Santos');
  assert.equal(h.input('Last Name *').props.value, 'Dela Cruz');

  // Self -> Parent -> Self -> Child rapid switching
  h.selectRelationship('Parent');
  await h.flush();
  assert.equal(h.input('First Name *').props.value, '');
  h.input('First Name *').props.onChange({ target: { value: 'Maria' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Reyes' } });
  await h.flush();

  h.selectRelationship('Self');
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan');
  assert.equal(h.input('Middle Name (Optional)').props.value, 'Santos');
  assert.equal(h.input('Last Name *').props.value, 'Dela Cruz');

  h.selectRelationship('Child');
  await h.flush();
  assert.equal(h.input('First Name *').props.value, '');
  h.input('First Name *').props.onChange({ target: { value: 'Pedro' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Dela Cruz' } });
  h.input('Purpose of Request *').props.onChange({ target: { value: 'School' } });
  await h.flush();

  h.button('Next Step').props.onClick();
  await h.flush();
  assert.match(h.text(), /Proof of Relationship \/ Authorization Letter/);
  assert.match(h.text(), /Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant\./);
  h.unmount();
});

test('Web delayed profile does not overwrite non-Self registrant name or saved draft name', async () => {
  const h = harness({ initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: '', isGovernmentIdVerified: true } });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.selectRelationship('Parent');
  await h.flush();
  h.input('First Name *').props.onChange({ target: { value: 'Elena' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Gomez' } });
  await h.flush();

  // Delayed profile arrives now — must NOT overwrite Elena Gomez
  h.setProfile({ id: '12', firebaseUid: 'uid-1', fullName: 'Juan Santos Dela Cruz', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', isGovernmentIdVerified: true });
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Elena');
  assert.equal(h.input('Last Name *').props.value, 'Gomez');
  h.unmount();

  // Saved draft must NOT be overwritten when profile loads
  const draft = {
    id: '446', parishId: '3', rawDocumentType: 'BAPTISMAL_CERTIFICATE', isDraft: true,
    applicantName: 'Maria Clara', relationship: 'Self', purpose: 'School', attachments: [],
  };
  const hDraft = harness({
    search: '?draftId=446',
    draft,
    initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: '', isGovernmentIdVerified: true },
  });
  await hDraft.flush();
  hDraft.setProfile({ id: '12', firebaseUid: 'uid-1', fullName: 'Juan Santos Dela Cruz', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', isGovernmentIdVerified: true });
  await hDraft.flush();
  assert.equal(hDraft.input('First Name *').props.value, 'Maria');
  assert.equal(hDraft.input('Last Name *').props.value, 'Clara');
  hDraft.unmount();
});

test('Web stale requirements response from Authorized Representative does not override Parent requirements', async () => {
  let resolveAuthRep;
  const h = harness({
    api: {
      getDocumentRequirements: (docType, parishId, rel) => {
        if (rel === 'Authorized Representative') {
          return new Promise(resolve => {
            resolveAuthRep = () => resolve({
              requiredDocuments: [{ id: 'valid_id', label: 'Valid Government ID', required: true }],
              relationshipEvidence: [
                { id: 'authorization_letter', label: 'Authorization Letter', description: 'Signed authorization letter for a request made for another person.', required: true },
                { id: 'registrant_id_front', label: 'Registrant Government ID - Front', required: true },
                { id: 'registrant_id_back', label: 'Registrant Government ID - Back', required: true },
              ],
            });
          });
        }
        return Promise.resolve({
          requiredDocuments: [{ id: 'valid_id', label: 'Valid Government ID', required: true }],
          relationshipEvidence: [
            {
              id: 'authorization_letter',
              label: 'Proof of Relationship / Authorization Letter',
              description: "Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant.",
              required: true,
            },
            { id: 'registrant_id_front', label: 'Registrant Government ID - Front', required: true },
            { id: 'registrant_id_back', label: 'Registrant Government ID - Back', required: true },
          ],
        });
      },
    },
  });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.selectRelationship('Authorized Representative');
  h.input('First Name *').props.onChange({ target: { value: 'Elena' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Gomez' } });
  h.input('Purpose of Request *').props.onChange({ target: { value: 'School' } });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();

  // Go back, switch to Parent, proceed to Step 4, then resolve stale Authorized Representative response
  h.button('Back').props.onClick(); await h.flush();
  h.selectRelationship('Parent');
  h.button('Next Step').props.onClick(); await h.flush();
  resolveAuthRep?.();
  await h.flush();
  assert.match(h.text(), /Proof of Relationship \/ Authorization Letter/);
  assert.match(h.text(), /Upload the registrant's birth certificate, an authorization letter, or another supporting document that proves your relationship to the registrant\./);
  h.unmount();
});

test('Self profile resolver preserves structured multi-word names and does not guess ambiguous full-name parts', () => {
  const h = harness();
  const resolved = h.resolveSelfProfileName({ firstName: 'Juan Miguel', middleName: 'Santos', lastName: 'Dela Cruz' });
  assert.equal(resolved.firstName, 'Juan Miguel');
  assert.equal(resolved.middleName, 'Santos');
  assert.equal(resolved.lastName, 'Dela Cruz');
  for (const fullName of ['Juan Miguel Santos', 'Juan Santos Dela Cruz', 'Maria Clara Delos Reyes', 'Dela Cruz, Juan Miguel Jr.']) {
    assert.equal(h.resolveSelfProfileName({ fullName }), null, fullName);
  }
  assert.equal(h.resolveSelfProfileName({ fullName: 'Juan Cruz' }).lastName, 'Cruz');
});

test('explicitly switching a resumed draft to Self accepts delayed profile data', async () => {
  const h = harness({
    search: '?draftId=446',
    draft: { id: '446', parishId: '3', rawDocumentType: 'BAPTISMAL_CERTIFICATE', isDraft: true, applicantName: 'Maria Clara', relationship: 'Parent', purpose: 'School', attachments: [] },
    initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: '', isGovernmentIdVerified: true },
  });
  await h.flush();
  h.selectRelationship('Self'); await h.flush();
  h.setProfile({ id: '12', firebaseUid: 'uid-1', firstName: 'Juan Miguel', middleName: 'Santos', lastName: 'Dela Cruz', isGovernmentIdVerified: true });
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan Miguel');
  assert.equal(h.input('Middle Name (Optional)').props.value, 'Santos');
  assert.equal(h.input('Last Name *').props.value, 'Dela Cruz');
  await h.button('Save Draft').props.onClick(); await h.flush();
  const update = h.calls.find(c => c[0] === 'update');
  assert.equal(update[2].applicantFirstName, 'Juan Miguel');
  assert.equal(update[2].relationship, 'Self');
  h.unmount();
});

test('profile refresh during draft creation cannot change the name being saved', async () => {
  let finishCreate;
  const h = harness({
    initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: 'Juan Cruz', isGovernmentIdVerified: true },
    api: { createRequest: payload => new Promise(resolve => { finishCreate = () => resolve({ ...payload, id: '501', isDraft: true, applicantName: 'Juan Cruz', attachments: [] }); }) },
  });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  const saving = h.button('Save Draft').props.onClick(); await h.flush();
  h.setProfile({ id: '12', firebaseUid: 'uid-1', firstName: 'Juan Miguel', lastName: 'Cruz', isGovernmentIdVerified: true });
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan');
  finishCreate(); await saving; await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan');
  h.unmount();
});

test('ambiguous profile names allow manual Self entry and keep required Purpose validation', async () => {
  const h = harness({ initialProfile: { id: '12', firebaseUid: 'uid-1', fullName: 'Juan Miguel Santos', isGovernmentIdVerified: true } });
  await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  h.button('Next Step').props.onClick(); await h.flush();
  assert.equal(h.input('First Name *').props.value, '');
  assert.equal(h.button('Next Step').props.disabled, true);
  h.input('First Name *').props.onChange({ target: { value: 'Juan Miguel' } });
  h.input('Last Name *').props.onChange({ target: { value: 'Santos' } });
  h.input('Purpose of Request *').props.onChange({ target: { value: '   ' } });
  await h.flush();
  h.selectRelationship('Self'); await h.flush();
  h.setProfile({ id: '12', firebaseUid: 'uid-1', firstName: 'Juan', middleName: 'Miguel', lastName: 'Santos', isGovernmentIdVerified: true });
  await h.flush();
  assert.equal(h.input('First Name *').props.value, 'Juan Miguel');
  assert.equal(h.button('Next Step').props.disabled, true);
  h.button('Next Step').props.onClick(); await h.flush();
  assert.equal(h.input('Purpose of Request *').props.value, '   ');
  h.input('Purpose of Request *').props.onChange({ target: { value: 'School' } }); await h.flush();
  assert.equal(h.button('Next Step').props.disabled, false);
  h.button('Next Step').props.onClick(); await h.flush();
  assert.ok(h.button('Submit Request'));
  h.unmount();
});
