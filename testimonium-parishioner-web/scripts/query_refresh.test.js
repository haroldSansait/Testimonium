import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { QueryObserver, hashKey } from '@tanstack/react-query';
import * as cache from '../src/services/queryClient.ts';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let dispose;
afterEach(async () => { dispose?.(); cache.setQueryScope(null); await flush(); });

// Controlled React effects/timers, real TanStack observers and QueryClient.
// This tests hook wiring without a browser, Firebase or live API calls.
function harness() {
  cache.setQueryScope('fixture', 'PARISHIONER', '3');
  const timers = new Map();
  const listeners = new Map();
  const cleanups = [];
  const queries = new Set();
  let focused = true;
  const add = (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); };
  const remove = (name, callback) => listeners.get(name)?.delete(callback);
  const window = { addEventListener: add, removeEventListener: remove, __pollingPauseCount: 0 };
  const document = { visibilityState: 'visible', hasFocus: () => focused, addEventListener: add, removeEventListener: remove };
  const react = {
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useMemo: fn => fn(), useRef: value => ({ current: value }),
    useCallback: fn => fn, useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/hooks/useService.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, window, document,
    setInterval: (callback, ms) => { const key = {}; timers.set(key, { callback, ms }); return key; },
    clearInterval: key => timers.delete(key),
    require: name => {
      if (name === 'react') return react;
      if (name === '../services/queryClient') return cache;
      if (name === '@tanstack/react-query') return { hashKey, useQuery: options => {
        const observer = new QueryObserver(cache.queryClient, options);
        const unsubscribe = observer.subscribe(() => {}); cleanups.push(unsubscribe);
        queries.add(cache.queryClient.getQueryCache().find({ queryKey: options.queryKey }));
        return observer.getCurrentResult();
      } };
      return { default: {}, getManilaCalendarDate: () => '2026-10-21' };
    },
  });
  dispose = () => {
    cleanups.reverse().forEach(fn => fn());
    queries.forEach(query => query?.destroy());
    module.exports.clearAllPollingTimers();
  };
  return { hook: module.exports, timers, window, document, focused: value => { focused = value; },
    emit: name => listeners.get(name)?.forEach(fn => fn()), cleanupLast: () => cleanups.pop()?.() };
}

test('useService returns cached data immediately and shares one 10s poller per explicit key', async () => {
  const h = harness();
  const key = cache.privateQueryKey('requests', 'list');
  cache.queryClient.setQueryData(key, ['cached']);
  let calls = 0;
  const fn = async () => { calls++; return ['new']; };
  const first = h.hook.useQuery(fn, ['requests', 'list']);
  h.hook.useQuery(fn, ['requests', 'list']);
  assert.equal(first.loading, false);
  assert.deepEqual(first.data, ['cached']);
  assert.equal(h.timers.size, 1);
  const timer = [...h.timers.values()][0];
  assert.equal(timer.ms, 10_000);
  timer.callback(); await flush();
  assert.equal(calls, 1);
  assert.deepEqual(cache.queryClient.getQueryData(key), ['new']);
});

test('polling and focus restoration respect hidden tabs, focus and nested pauses', async () => {
  const h = harness();
  let calls = 0;
  h.hook.useQuery(async () => ++calls, ['parishes'], { staleTime: 600_000 });
  await flush(); assert.equal(calls, 1);
  const tick = [...h.timers.values()][0].callback;
  h.document.visibilityState = 'hidden'; tick(); h.emit('focus'); await flush(); assert.equal(calls, 1);
  h.document.visibilityState = 'visible'; h.focused(false); tick(); await flush(); assert.equal(calls, 1);
  h.focused(true);
  h.hook.usePausePolling(true); h.hook.usePausePolling(true);
  assert.equal(h.window.__pollingPauseCount, 2);
  tick(); h.emit('visibilitychange'); await flush(); assert.equal(calls, 1);
  h.cleanupLast(); assert.equal(h.window.__pollingPauseCount, 1);
  tick(); await flush(); assert.equal(calls, 1);
  h.cleanupLast(); assert.equal(h.window.__pollingPauseCount, 0);
  h.emit('focus'); h.emit('visibilitychange'); await flush(); assert.equal(calls, 2);
  tick(); await flush(); assert.equal(calls, 3); // freshness does not suppress polling
});

test('notification polling stays at 30s and remains visible-tab aware during form pauses', async () => {
  const h = harness();
  let calls = 0;
  let mutating = false;
  h.hook.useQuery(async () => ++calls, ['notifications'], {
    pollInterval: 30_000, requireFocus: false, respectPause: false, refreshAllowed: () => !mutating,
  });
  await flush();
  const timer = [...h.timers.values()][0];
  assert.equal(timer.ms, 30_000);
  h.focused(false); h.hook.usePausePolling(true);
  timer.callback(); await flush(); assert.equal(calls, 2);
  mutating = true; timer.callback(); await flush(); assert.equal(calls, 2);
  mutating = false; h.document.visibilityState = 'hidden'; timer.callback(); await flush(); assert.equal(calls, 2);
});

test('setData updates the shared cache and obsolete session callbacks cannot write or refetch', async () => {
  const h = harness();
  const key = cache.privateQueryKey('requests');
  cache.queryClient.setQueryData(key, ['before']);
  const query = h.hook.useQuery(async () => ['network'], ['requests']);
  query.setData(previous => [...previous, 'optimistic']);
  assert.deepEqual(cache.queryClient.getQueryData(key), ['before', 'optimistic']);
  cache.setQueryScope('another', 'PARISHIONER', '4');
  query.setData(['leak']); await query.refetch();
  assert.equal(cache.queryClient.getQueryData(key), undefined);
  assert.equal(cache.queryClient.getQueryData(cache.privateQueryKey('requests')), undefined);
  cache.setQueryScope(null);
  cache.setQueryScope('fixture', 'PARISHIONER', '3');
  query.setData(['old session']); await query.refetch();
  assert.equal(cache.queryClient.getQueryData(key), undefined);
});

test('shared polling and event listeners are cleaned up on unmount', async () => {
  const h = harness();
  let calls = 0;
  h.hook.useQuery(async () => ++calls, ['requests']); await flush();
  dispose(); dispose = undefined;
  assert.equal(h.timers.size, 0);
  h.emit('focus'); await flush();
  assert.equal(calls, 1);
});

test('a protected query waiting for a session stays pending and automatically fetches when reenabled', async () => {
  const h = harness();
  cache.setQueryScope(null);
  let calls = 0;
  const read = async () => { calls++; return ['restored']; };
  const waiting = h.hook.useQuery(read, ['requests']);
  assert.equal(waiting.loading, true);
  assert.equal(waiting.data, undefined);
  assert.equal(calls, 0);
  cache.setQueryScope('fixture', 'PARISHIONER', '3');
  const first = h.hook.useQuery(read, ['requests']);
  assert.equal(first.loading, true);
  await flush();
  const restored = h.hook.useQuery(read, ['requests']);
  assert.equal(restored.loading, false);
  assert.deepEqual(restored.data, ['restored']);
  assert.equal(calls, 1);
});
