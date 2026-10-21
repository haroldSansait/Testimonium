import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as cache from '../src/services/queryClient.ts';

afterEach(() => cache.setQueryScope(null));
function harness(fetchResponse) {
  cache.setQueryScope('fixture', 'PARISHIONER', '3');
  let calls = 0, logouts = 0;
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', '"http://fixture.test/api/v1"');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, URL, Headers, FormData, AbortSignal, console,
    fetch: async (...args) => { calls++; return fetchResponse(...args); },
    require: name => name === '../services/queryClient' ? cache : name === '../firebaseConfig'
      ? { auth: { currentUser: { uid: 'fixture', getIdToken: async () => 'test-token' } } }
      : { SessionService: { logout: () => { logouts++; } } },
  });
  return { client: module.exports.client, calls: () => calls, logouts: () => logouts };
}
const response = (status, data) => ({ ok: status < 400, status, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => data });

test('successful writes invalidate related reads while failed concurrency checks retain their original error', async () => {
  let status = 409;
  const h = harness(async () => response(status, { code: 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT', message: 'Changed', data: { status: 'processing' } }));
  const key = cache.privateQueryKey('requests');
  cache.queryClient.setQueryData(key, ['cached']);
  await assert.rejects(h.client.patch('/requests/7', {}), error => error.statusCode === 409 && error.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT');
  assert.equal(cache.queryClient.getQueryState(key).isInvalidated, false);
  status = 200;
  assert.deepEqual(await h.client.patch('/requests/7', {}), { status: 'processing' });
  assert.equal(cache.queryClient.getQueryState(key).isInvalidated, true);
  assert.deepEqual(cache.queryClient.getQueryData(key), ['cached']); // mutations are never query data
});

test('private binary reads bypass QueryClient and keep the existing blob contract', async () => {
  const evidence = new Blob(['fixture'], { type: 'application/pdf' });
  const h = harness(async () => ({ ...response(200, {}), blob: async () => evidence }));
  assert.equal(await h.client.getBlob('/requests/7/returns/1/file/returned'), evidence);
  assert.equal(cache.queryClient.getQueryCache().getAll().length, 0);
});

test('an old session response cannot log out the next session', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.client.get('/requests').catch(error => error);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  cache.setQueryScope('new-fixture', 'PARISHIONER', '4');
  finish(response(401, {}));
  assert.equal((await pending).name, 'AbortError');
  assert.equal(h.logouts(), 0);
});

test('read-only recommendation POST does not invalidate existing navigation data', async () => {
  const h = harness(async () => response(200, { data: { recommendations: [] } }));
  const key = cache.privateQueryKey('schedules');
  cache.queryClient.setQueryData(key, ['cached']);
  await h.client.post('/schedule-requests/recommendations', {});
  assert.equal(cache.queryClient.getQueryState(key).isInvalidated, false);
});

test('a private-file error body from the previous session cannot expire the new session', async () => {
  let finish;
  const h = harness(async () => ({ ...response(401, {}), json: () => new Promise(resolve => { finish = resolve; }) }));
  const pending = h.client.getBlob('/requests/7/file').catch(error => error);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  cache.setQueryScope('new-fixture', 'PARISHIONER', '4');
  finish({ message: 'Expired' });
  assert.equal((await pending).name, 'AbortError');
  assert.equal(h.logouts(), 0);
});
