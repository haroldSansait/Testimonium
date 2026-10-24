import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
const noop = () => null;
function load(path, dependencies, extra = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(source + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText, {
    module, exports: module.exports, document: { body: {} }, console: { error: noop },
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'react-dom') return { createPortal: children => children };
      if (name === 'react-router-dom') return { useLocation: () => ({ state: null }) };
      if (name === '@/utils/cn') return { cn: (...items) => items.filter(Boolean).join(' ') };
      if (name === '@/types') return { DOCUMENT_RETURN_REASONS: [] };
      if (name === '@/config/documents') return { DOCUMENT_TYPE_FILTER_OPTIONS: [], getDocumentLabel: () => 'Baptismal Certificate' };
      if (name.startsWith('@/') || name === 'lucide-react') return new Proxy({}, { get: () => noop });
      return require(name);
    },
  });
  return module.exports;
}

const dto = { id: 1, parishId: 5, trackingNumber: 'SR-CASH-1', applicantName: 'Fixture',
  documentType: 'BAPTISMAL_CERTIFICATE', status: 'PAYMENT_VERIFIED', paymentStatus: 'CONFIRMED',
  createdAt: '2026-10-24T02:00:00Z', paymentTransactions: [{ id: 100, provider: 'CASH', amount: '175.35', status: 'VERIFIED' }],
  requestHistory: [{ id: 30, newStatus: 'PAYMENT_VERIFIED', remarks: 'Payment verified as CASH', createdAt: '2026-10-24T02:00:00Z' }],
};
const request = { id: '1', referenceNo: 'SR-CASH-1', parishId: '5', parishionerName: 'Fixture',
  documentType: 'Baptismal Certificate', dateSubmitted: 'Oct 20, 2026', status: 'Payment Pending', paymentStatus: 'Pending',
  attachments: [], timeline: [], paymentTransactions: [],
};

function providerHarness(api) {
  const mapping = load('../src/providers/api/documentStatusMapping.ts', {});
  const { ApiDocumentProvider } = load('../src/providers/api/ApiDocumentProvider.ts', {
    '@/api/api': { __esModule: true, default: api }, './documentStatusMapping': mapping,
  });
  return load('../src/services/documentRequestService.ts', {
    '@/providers/providerFactory': { providerFactory: { getDocumentProvider: () => ApiDocumentProvider } },
  });
}

test('real service/provider posts explicit cash endpoint and maps authoritative paid status, payment and history', async () => {
  const calls = [];
  const services = providerHarness({ post: async (...args) => { calls.push(args); return { data: { data: dto } }; } });
  const result = await services.verifyCashPayment('1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/document-requests/1/verify-cash');
  assert.equal(calls[0].length, 1, 'client must not supply a fee or reporting date');
  assert.equal(result.status, 'Payment Verified');
  assert.equal(result.paymentStatus, 'Paid');
  assert.equal(result.paymentTransactions[0].provider, 'CASH');
  assert.equal(result.paymentTransactions[0].amount, '175.35');
  assert.match(result.timeline[0].note, /verified as CASH/);
});
test('ordinary receipt verification retains PATCH status endpoint', async () => {
  const calls = [];
  const services = providerHarness({ patch: async (...args) => { calls.push(args); return { data: { data: dto } }; } });
  await services.updateDocumentStatus('1', 'Payment Verified');
  assert.equal(calls[0][0], '/document-requests/1/status');
  assert.equal(calls[0][1].status, 'PAYMENT_VERIFIED');
});
test('cash backend error propagates through service/provider unchanged', async () => {
  const error = { status: 400, message: 'Authoritative request fee amount is unavailable.' };
  const services = providerHarness({ post: async () => { throw error; } });
  await assert.rejects(services.verifyCashPayment('1'), e => e === error);
});

// Execute the real page and modal event handlers with deterministic hook state,
// using the same transpilation approach as existing Admin regression tests.
// This does not claim DOM/browser validation.
function uiHarness(services, role = 'SECRETARY') {
  let active;
  const hooks = {
    ...React,
    useState(initial) {
      const slot = active.index++, owner = active;
      if (!(slot in owner.values)) owner.values[slot] = typeof initial === 'function' ? initial() : initial;
      return [owner.values[slot], value => {
        owner.values[slot] = typeof value === 'function' ? value(owner.values[slot]) : value;
      }];
    },
    useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
    useEffect: noop,
    useCallback: fn => fn,
  };
  let cache = { data: [request], total: 1, totalPages: 1 }, refreshes = 0;
  const query = {
    get data() { return cache; }, loading: false, error: null,
    setData: update => { cache = typeof update === 'function' ? update(cache) : update; },
    refetch: async () => { refreshes++; return { data: cache }; },
  };
  const components = load('../src/pages/DocumentRequestsPage.tsx', {
    react: hooks, '@/services/documentRequestService': services,
    '@/hooks/useAuth': { useAuth: () => ({ role }) },
    '@/permissions/rolePermissions': { canManageDocumentRequests: value => value === 'SECRETARY' },
    '@/hooks/useCachedQuery': { useCachedQuery: () => query },
  }, '\nexport { DocumentDetailsModal };');
  function renderer(Component, props) {
    const state = { values: [], index: 0 };
    return { render: () => { active = state; state.index = 0; return Component(props); } };
  }
  return { ...components, renderer, cache: () => cache, refreshes: () => refreshes };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && n.props.children === label);
const modal = (tree, h) => nodes(tree).find(n => n.type === h.DocumentDetailsModal);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

for (const status of ['Payment Pending', 'Payment Needs Correction']) {
  test(`${status}: actual Cash Override button calls cash handler once, disables, then hydrates page/cache and success feedback`, async () => {
    let resolve, calls = 0, ordinaryCalls = 0;
    const result = { ...request, status: 'Payment Verified', paymentStatus: 'Paid', paymentTransactions: dto.paymentTransactions };
    const services = {
      verifyCashPayment: async id => { assert.equal(id, '1'); calls++; return new Promise(r => { resolve = r; }); },
      updateDocumentStatus: async () => { ordinaryCalls++; },
    };
    const h = uiHarness(services);
    const page = h.renderer(h.DocumentRequestsPage);
    const table = nodes(page.render()).find(n => typeof n.props?.onViewDetails === 'function');
    assert.ok(table, 'actual request table must expose its view callback');
    table.props.onViewDetails({ ...request, status });
    const detail = modal(page.render(), h);
    const view = h.renderer(h.DocumentDetailsModal, detail.props);
    const cash = button(view.render(), 'Verify Payment (Cash Override)');
    assert.ok(cash);
    cash.props.onClick(); cash.props.onClick();
    assert.equal(calls, 1);
    assert.equal(ordinaryCalls, 0);
    assert.equal(button(view.render(), 'Verify Payment (Cash Override)').props.disabled, true);
    resolve(result); await flush();
    assert.equal(h.cache().data[0], result);
    assert.equal(h.refreshes(), 1);
    const updated = page.render();
    assert.equal(modal(updated, h), undefined, 'modal closes after successful verification');
    assert.ok(nodes(updated).some(n => n.props?.message === 'Request status updated to Payment Verified.'));
  });
}
test('Cash Override surfaces actual backend failure, keeps modal open, and allows retry without success feedback', async () => {
  let calls = 0;
  const error = { status: 400, message: 'Authoritative request fee amount is unavailable.' };
  const h = uiHarness({ verifyCashPayment: async () => { calls++; throw error; } });
  const page = h.renderer(h.DocumentRequestsPage);
  nodes(page.render()).find(n => typeof n.props?.onViewDetails === 'function').props.onViewDetails(request);
  const view = h.renderer(h.DocumentDetailsModal, modal(page.render(), h).props);
  button(view.render(), 'Verify Payment (Cash Override)').props.onClick(); await flush();
  const tree = view.render();
  assert.ok(nodes(tree).some(n => n.props?.children === error.message));
  assert.equal(button(tree, 'Verify Payment (Cash Override)').props.disabled, false);
  assert.ok(modal(page.render(), h));
  assert.equal(h.cache().data[0], request);
  assert.equal(h.refreshes(), 0);
  assert.equal(nodes(page.render()).some(n => typeof n.props?.message === 'string'), false);
  button(tree, 'Verify Payment (Cash Override)').props.onClick(); await flush();
  assert.equal(calls, 2);
});
test('Awaiting Payment Review button invokes ordinary verification; read-only staff see no cash action', async () => {
  let cashCalls = 0, ordinaryCalls = 0;
  const h = uiHarness({});
  const view = h.renderer(h.DocumentDetailsModal, {
    request: { ...request, status: 'Awaiting Payment Review' }, canManage: true,
    onClose: noop, onVerifyCash: async () => { cashCalls++; },
    onStatusChange: async status => { assert.equal(status, 'Payment Verified'); ordinaryCalls++; },
  });
  button(view.render(), 'Verify Payment').props.onClick(); await flush();
  assert.equal(ordinaryCalls, 1); assert.equal(cashCalls, 0);
  for (const role of ['PRIEST', 'DIOCESE_COORDINATOR']) {
    const readonly = uiHarness({}, role);
    const view = readonly.renderer(readonly.DocumentDetailsModal, { request, canManage: false, onClose: noop });
    assert.equal(button(view.render(), 'Verify Payment (Cash Override)'), undefined);
  }
});
