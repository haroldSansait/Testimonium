import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getNotificationDestination } from '../src/utils/notificationNavigation.ts';

test('assignment provider transmits optional verbal approval and maps canonical acceptance and resolved request', async () => {
  const source = readFileSync(new URL('../src/providers/api/ApiScheduleProvider.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  const calls = [];
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, setTimeout: () => {},
    require: (name) => name === '@/api/api' ? { __esModule: true, default: { post: async (url, payload) => {
      calls.push({ url, payload });
      return { data: { data: { id: 55, parishId: 10, eventType: 'BAPTISM', status: 'PENDING', requestedDate: '2026-12-10', version: 4,
        assignedPriest: { id: 22, name: 'Fr. Mario' }, assignedPriestId: 22, priestResponseStatus: payload.verbalApproval ? 'ACCEPTED' : 'PENDING',
        priestVerbalApproval: Boolean(payload.verbalApproval), priestVerbalApprovalBy: { id: 90, fullName: 'Secretary Clara' },
        priestChangeStatus: 'RESOLVED', priestChangeNote: 'Please change', priestChangeRequestedPriest: { id: 22, name: 'Fr. Mario' } } } };
    } } } : { resolveDisplayTitle: () => 'Baptism' },
  });
  const provider = module.exports.ApiScheduleProvider;
  await provider.assignPriest('55', '22', 3);
  const approved = await provider.assignPriest('55', '22', 3, true);
  assert.equal(calls[0].url, '/schedule-requests/55/assign-priest');
  assert.equal(Object.hasOwn(calls[0].payload, 'verbalApproval'), false);
  assert.equal(calls[1].payload.verbalApproval, true);
  assert.equal(calls[1].payload.expectedVersion, 3);
  assert.equal(approved.priestResponseStatus, 'ACCEPTED');
  assert.equal(approved.priestVerbalApproval, true);
  assert.equal(approved.priestChangeStatus, 'RESOLVED');
  assert.equal(approved.priestChangeNote, 'Please change');
  assert.equal(approved.priestChangeRequestedPriest, 'Fr. Mario');
});

test('priest change notification opens the exact Admin schedule', () => {
  const destination = getNotificationDestination({ title: 'Priest Change Requested', type: 'schedule-request', referenceType: 'SCHEDULE_REQUEST', referenceId: 55 });
  assert.equal(destination.path, '/schedule-requests');
  assert.deepEqual(destination.state, { requestId: '55' });
});

test('assignment modal resets approval on close, priest change and schedule change', () => {
  const source = readFileSync(new URL('../src/pages/ScheduleRequestsPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /\[verbalApprovalConfirmed, setVerbalApprovalConfirmed\] = useState\(false\)/);
  assert.match(source, /setVerbalApprovalConfirmed\(false\);\s*setConfirmPriestModal\(null\);\s*\}, \[request.id\]\)/);
  assert.match(source, /setVerbalApprovalConfirmed\(false\);\s*\}, \[confirmPriestModal\?\.priestId\]\)/);
  assert.match(source, /const closeConfirmPriestModal = \(\) => \{\s*setConfirmPriestModal\(null\);\s*setVerbalApprovalConfirmed\(false\);/);
  assert.match(source, /The selected priest has verbally approved this assignment/);
  assert.match(source, /request.priestResponseStatus !== 'ACCEPTED'/);
});
