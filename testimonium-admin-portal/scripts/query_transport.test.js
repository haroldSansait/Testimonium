import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { AxiosError, CanceledError } from 'axios';
import * as cache from '../src/services/queryClient.ts';

afterEach(() => cache.setQueryScope(null));
function harness() {
  cache.setQueryScope('fixture', 'SECRETARY', '3');
  let request, success, failure, logouts = 0;
  const api = { interceptors: { request: { use: fn => { request = fn; } }, response: { use: (a, b) => { success = a; failure = b; } } } };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/api/interceptors.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, AbortSignal,
    require: name => name === 'axios' ? { AxiosError, CanceledError } : name === '@/services/queryClient' ? cache
      : name === '@/api/api' ? { default: api, __esModule: true } : name === '@/config/firebase'
      ? { auth: { currentUser: { uid: 'fixture', getIdToken: async () => 'test-token' } } }
      : { SessionService: { logout: () => { logouts++; } } },
  });
  module.exports.setupInterceptors();
  return { request, success, failure, logouts: () => logouts };
}

test('successful administrative writes invalidate cached variants without caching the mutation', async () => {
  const h = harness();
  const key = cache.privateQueryKey('schedules', { page: 1 });
  cache.queryClient.setQueryData(key, ['cached']);
  const config = await h.request({ method: 'patch', url: '/schedule-requests/7/status', headers: {} });
  const result = { config, data: { status: 'confirmed' } };
  assert.equal(await h.success(result), result);
  assert.equal(cache.queryClient.getQueryState(key).isInvalidated, true);
  assert.deepEqual(cache.queryClient.getQueryData(key), ['cached']);
});

test('a failed version check retains the backend concurrency code and does not invalidate as success', async () => {
  const h = harness();
  const key = cache.privateQueryKey('requests');
  cache.queryClient.setQueryData(key, ['cached']);
  const config = await h.request({ method: 'patch', url: '/document-requests/7/status', headers: {} });
  const error = new AxiosError('Changed', undefined, config, undefined, { status: 409, data: { code: 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT', message: 'Changed' } });
  await assert.rejects(h.failure(error), result => result.status === 409 && result.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT');
  assert.equal(cache.queryClient.getQueryState(key).isInvalidated, false);
});

test('account switching aborts protected transport and an obsolete 401 cannot log out the new user', async () => {
  const h = harness();
  const config = await h.request({ method: 'get', url: '/notifications', headers: {} });
  cache.setQueryScope('another', 'PRIEST', '4');
  assert.equal(config.signal.aborted, true);
  const error = new AxiosError('Expired', undefined, config, undefined, { status: 401, data: {} });
  await assert.rejects(h.failure(error), result => result instanceof CanceledError);
  assert.equal(h.logouts(), 0);
  await assert.rejects(h.success({ config, data: ['previous session'] }), result => result instanceof CanceledError);
});
