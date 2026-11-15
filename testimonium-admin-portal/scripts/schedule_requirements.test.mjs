import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/schedule-requests/ScheduleAttachments.tsx', import.meta.url), 'utf8');
function render(query) {
  let queryFn; let queryKey;
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023,
  } });
  runInNewContext(outputText, { module, exports: module.exports, require(name) {
    if (name === '@/api/api') return { get: async (endpoint) => ({ data: { data: [{ endpoint }] } }) };
    if (name === '@/hooks/useCachedQuery') return { useCachedQuery: (key, fn) => { queryKey = key; queryFn = fn; return query; } };
    if (name === '@/components/document-requests/SecureBlobViewer') return { SecureBlobViewer: (props) => React.createElement('a', { href: props.endpoint, download: props.fileName }, 'Secure preview') };
    return require(name);
  } });
  const html = renderToStaticMarkup(React.createElement(module.exports.ScheduleAttachments, { scheduleId: '42' }));
  return { html, queryFn, queryKey };
}

test('Secretary attachment section renders names and existing secure viewer with schedule-scoped endpoints', async () => {
  const { html, queryKey, queryFn } = render({ data: [{ id: 7, requirementLabel: 'CENOMAR', fileName: 'private.pdf', fileType: 'application/pdf' }] });
  assert.match(html, /CENOMAR/); assert.match(html, /private.pdf/);
  assert.match(html, /\/schedule-requests\/42\/attachments\/7\/file/);
  assert.equal(JSON.stringify(queryKey), JSON.stringify(['schedules', '42', 'attachments']));
  assert.equal((await queryFn())[0].endpoint, '/schedule-requests/42/attachments');
});

test('Secretary attachment section handles loading, retry and legacy bookings without attachments', () => {
  assert.match(render({ loading: true }).html, /Loading documents/);
  assert.match(render({ error: 'Unavailable' }).html, /Retry/);
  assert.equal(render({ data: [], loading: false }).html, '');
});

// Execute the real modal with controlled hooks and transport so async requirement
// loading and the submit-time recheck can be exercised without a live backend.
function rejectionModal() {
  const slots = []; let cursor = 0; let dirty = true; let tree;
  const effects = [];
  const transport = { requirements: [], attachments: [], fail: false, hold: false, releases: [] };
  const submissions = [];
  const changed = (previous, next) => !previous || next.some((value, i) => !Object.is(previous[i], value));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    },
  };
  const source = readFileSync(new URL('../src/pages/ScheduleRequestsPage.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(`${source}\nexport { ScheduleRequestDetailsModal };`, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023,
  } });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports, document: { body: {} }, console, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react-dom') return { createPortal: (children) => children };
    if (name === '@/shared/EventTypeCatalog') return { EventTypeCatalog: [], resolveEventType: () => 'BAPTISM' };
    if (name === '@/utils/date') return { getManilaTodayDateString: () => '2099-01-01', isBeforeManilaToday: () => false };
    if (name === '@/utils/cn') return { cn: () => '' };
    if (name === '@/services/UserManagementService') return { UserManagementService: { getUsers: async () => [] } };
    if (name === '@/services/scheduleRequestService') return { getPriestAvailability: async () => [] };
    if (name === '@/api/api') return { get: async (endpoint) => {
      if (transport.hold) await new Promise((resolve) => { transport.releases.push(resolve); });
      if (transport.fail) throw new Error('Network unavailable');
      return { data: { data: endpoint.endsWith('/attachments') ? transport.attachments : {
        services: [], requirementsByEventType: { BAPTISM: transport.requirements },
      } } };
    } };
    if (name.startsWith('@/') || name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    return require(name);
  } });
  const request = { id: '42', parishId: '10', rawEventType: 'BAPTISM', eventType: 'Baptism',
    status: 'Pending', version: 1, timeline: [], attachments: [] };
  const render = () => {
    cursor = 0; dirty = false;
    tree = module.exports.ScheduleRequestDetailsModal({ canManage: true, request, onClose() {},
      onStatusChange: async (...args) => { submissions.push(args); } });
    while (effects.length) effects.shift()();
  };
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      if (dirty) render();
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const nodes = (node) => Array.isArray(node) ? node.flatMap((item) => nodes(item)) :
    node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  const text = (node) => Array.isArray(node) ? node.map(text).join('') :
    node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
  const button = (label) => nodes(tree).find((node) => node.type === 'button' && text(node).trim() === label);
  const select = () => nodes(tree).find((node) => node.props?.id === 'schedule-rejection-reason');
  return { transport, submissions, flush, button, select, nodes: () => nodes(tree), text,
    async open() { await flush(); button('Reject').props.onClick(); await flush(); },
  };
}

test('rejection modal shows four reasons and no checklist after a successful empty requirements response', async () => {
  const modal = rejectionModal(); await modal.open();
  assert.deepEqual(Array.from(modal.select().props.options, (option) => option.value), [
    'INCORRECT_BOOKING_INFO', 'UNAVAILABLE_DATE_TIME', 'SERVICE_UNAVAILABLE', 'OTHER',
  ]);
  assert.equal(modal.text(modal.nodes()).includes('Affected Requirements'), false);
  modal.select().props.onChange('OTHER'); await modal.flush();
  await modal.button('Reject Schedule').props.onClick(); await modal.flush();
  assert.equal(modal.submissions.length, 1);
});

test('rejection modal preserves all reasons, multi-selection, and required selection for documents', async () => {
  const modal = rejectionModal();
  modal.transport.requirements = [{ id: 'birth_cert', label: 'Birth Certificate' }, { id: 'marriage_cert', label: 'Marriage Certificate' }];
  await modal.open(); assert.equal(modal.select().props.options.length, 6);
  modal.select().props.onChange('INVALID_DOCUMENTS'); await modal.flush();
  assert.equal(modal.button('Reject Schedule').props.disabled, true);
  for (const checkbox of modal.nodes().filter((node) => node.type === 'input' && node.props.type === 'checkbox')) {
    checkbox.props.onChange({ target: { checked: true } });
  }
  await modal.flush();
  await modal.button('Reject Schedule').props.onClick(); await modal.flush();
  assert.equal(modal.submissions.length, 1);
  assert.equal(modal.submissions[0][1].affectedRequirementIds.length, 2);
});

test('requirements removed while modal is open clear the document reason and prevent submission', async () => {
  const modal = rejectionModal(); modal.transport.requirements = [{ id: 'birth_cert', label: 'Birth Certificate' }];
  await modal.open(); modal.select().props.onChange('MISSING_REQUIREMENTS');
  modal.nodes().find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  await modal.flush(); modal.transport.requirements = [];
  await modal.button('Reject Schedule').props.onClick(); await modal.flush();
  assert.equal(modal.submissions.length, 0);
  assert.equal(modal.select().props.value, '');
  assert.equal(modal.select().props.options.length, 4);
  assert.equal(modal.text(modal.nodes()).includes('Affected Requirements'), false);
});

test('loading and failed requests keep requirements unknown and prevent rejection', async () => {
  const modal = rejectionModal(); modal.transport.hold = true;
  await modal.open();
  assert.equal(modal.select().props.options.length, 6);
  assert.equal(modal.select().props.disabled, true);
  assert.equal(modal.button('Reject Schedule').props.disabled, true);
  modal.select().props.onChange('OTHER'); await modal.flush();
  modal.button('Reject Schedule').props.onClick(); await modal.flush();
  assert.equal(modal.submissions.length, 0);
  // Release each pending request by failing the held transport on both branches.
  modal.transport.fail = true; modal.transport.hold = false;
  modal.transport.releases.forEach((resolve) => resolve());
  await modal.flush();
  assert.equal(modal.select().props.options.length, 6);
  assert.equal(modal.select().props.disabled, true);
  modal.button('Reject Schedule').props.onClick(); await modal.flush();
  assert.equal(modal.submissions.length, 0);
  assert.match(modal.text(modal.nodes()), /Unable to load applicable requirements/);
});
