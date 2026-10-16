import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const noop = () => null;
let currentRole;

// Render the actual page/modal components with inert network calls and portal
// placement. React's server renderer leaves effects inactive; no API is called.
function load(relativePath, dependencies = {}, extraExports = '') {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(`${source}\n${extraExports}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module, exports: module.exports, document: { body: {} }, console,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'react-dom') return { createPortal: (children) => children };
      if (name === 'react-router-dom') return { useLocation: () => ({ state: null }) };
      if (name === '@/hooks/useAuth') return { useAuth: () => ({ role: currentRole }) };
      if (name === '@/utils/cn') return { cn: (...items) => items.filter(Boolean).join(' ') };
      if (name === '@/utils/date') return { getManilaTodayDateString: () => '2099-01-01' };
      if (name === '@/components/ui/CustomSelect') return {
        CustomSelect: ({ disabled }) => React.createElement('select', { disabled, 'data-assignment-select': true }),
      };
      if (name === '@/types') return { DOCUMENT_RETURN_REASONS: [] };
      if (name === '@/config/documents') return { DOCUMENT_TYPE_FILTER_OPTIONS: [] };
      if (name.startsWith('@/') || name === 'lucide-react') return new Proxy({}, { get: () => noop });
      return require(name);
    },
  });
  return module.exports;
}

const permissions = load('../src/permissions/permissions.ts');
const roles = load('../src/permissions/rolePermissions.ts', { '@/permissions/permissions': permissions });
const dependencies = { '@/permissions/rolePermissions': roles };
const schedules = load('../src/pages/ScheduleRequestsPage.tsx', dependencies, 'export { ScheduleRequestDetailsModal };');
const documents = load('../src/pages/DocumentRequestsPage.tsx', dependencies, 'export { DocumentDetailsModal };');
const request = {
  id: '1', referenceNo: 'REQUEST-1', parishionerName: 'Test Requestor',
  parishId: '10', parish: 'Test Parish', version: 1,
  rawEventType: 'FUNERAL', eventType: 'Funeral Mass', preferredDate: 'Oct 20, 2099', preferredTime: '09:00 AM',
  assignedPriest: 'Test Priest', assignedPriestId: '21', priestResponseStatus: 'ACCEPTED',
  relationship: 'Self', documentType: 'Baptismal Certificate', dateSubmitted: 'Oct 1, 2099',
  attachments: [], timeline: [], paymentTransactions: [],
};

const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));
const modalProps = (role, status, extra = {}) => ({
  canManage: roles.canManageScheduleRequests(role), request: { ...request, status, ...extra }, onClose: noop,
});

for (const role of ['PRIEST', 'DIOCESE_COORDINATOR', 'SECRETARY']) {
  test(`${role}: request permission matrix and page notices`, () => {
    currentRole = role;
    const canManage = role === 'SECRETARY';
    for (const name of ['VIEW_DOCUMENT_REQUESTS', 'VIEW_SCHEDULE_REQUESTS']) assert.equal(roles.hasPermission(role, name), true);
    assert.equal(roles.canManageDocumentRequests(role), canManage);
    assert.equal(roles.canManageScheduleRequests(role), canManage);
    for (const [Component, label] of [[schedules.ScheduleRequestsPage, 'schedule'], [documents.DocumentRequestsPage, 'document']]) {
      assert.equal(render(Component).includes(`You have read-only access to ${label} requests.`), !canManage);
    }
  });

  test(`${role}: schedule status, assignment, alternative-date and emergency controls`, () => {
    const canManage = role === 'SECRETARY';
    const pending = render(schedules.ScheduleRequestDetailsModal, modalProps(role, 'Pending'));
    assert.match(pending, /Test Requestor/);
    assert.match(pending, /REQUEST-1/);
    for (const label of ['Approve &amp; Confirm', 'Propose Reschedule', '> Reject']) assert.equal(pending.includes(label), canManage, label);
    // Loading also disables the selector for Secretary in the initial render.
    if (!canManage) assert.match(pending, /<select disabled="" data-assignment-select="true"/);
    const confirmed = render(schedules.ScheduleRequestDetailsModal, modalProps(role, 'Confirmed'));
    assert.equal(confirmed.includes('Emergency Reschedule'), canManage);
    for (const status of ['SUBMITTED', 'PRIEST_PENDING']) {
      const html = render(schedules.ScheduleRequestDetailsModal, modalProps(role, 'Confirmed', {
        alternativeProposal: { id: '2', status, proposedDate: '2099-10-21', proposedStartDatetime: '2099-10-21T09:00:00+08:00', nominatedPriest: { fullName: 'Test Nominee' } },
      }));
      assert.match(html, /Parishioner Alternative-Date Proposal/);
      if (status === 'SUBMITTED') {
        assert.equal(html.includes('Approve &amp; Nominate'), canManage);
        assert.equal(html.includes('Decline Proposal'), canManage);
      } else {
        assert.match(html, /Test Nominee/);
        assert.equal(/<button[^>]*disabled=""[^>]*>Revok/.test(html), !canManage);
      }
    }
  });

  test(`${role}: document processing and corrected-upload controls`, () => {
    const canManage = roles.canManageDocumentRequests(role);
    const pending = render(documents.DocumentDetailsModal, { canManage, request: { ...request, status: 'Pending Review' }, onClose: noop });
    assert.match(pending, /Test Requestor/);
    assert.equal(pending.includes('Start Review'), canManage);
    const returned = render(documents.DocumentDetailsModal, {
      canManage, onClose: noop,
      request: { ...request, status: 'Returned for Correction', returns: [{ id: '2', cycleNumber: 1, reasonCode: 'OTHER' }] },
    });
    assert.match(returned, /Cycle #1/);
    assert.equal(returned.includes('Upload Corrected Document'), canManage);
  });
}

test('missing role and parishioners have no request-management permissions', () => {
  for (const role of [null, undefined, 'PARISHIONER']) {
    assert.equal(roles.canManageDocumentRequests(role), false);
    assert.equal(roles.canManageScheduleRequests(role), false);
  }
});
