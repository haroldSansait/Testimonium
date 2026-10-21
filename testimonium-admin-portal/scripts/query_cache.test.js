import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryObserver, hashKey } from '@tanstack/react-query';
import {
  queryClient, freshness, setQueryScope, privateQueryKey, guardedQuery,
  mutationCache, getQueryScope, getSessionSignal, subscribeQueryScope, schedulePreload,
} from '../src/services/queryClient.ts';

const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const createdQueries = new Set();
queryClient.getQueryCache().subscribe(event => { if (event.type === 'added') createdQueries.add(event.query); });
beforeEach(() => setQueryScope('fixture-a', 'SECRETARY', '3'));
afterEach(async () => {
  setQueryScope(null);
  await flush();
  createdQueries.forEach(query => query.destroy());
  createdQueries.clear();
  delete globalThis.document;
});

test('initial fetch is reused on navigation and concurrent identical reads deduplicate', async () => {
  const pending = defer();
  let calls = 0;
  const options = { queryKey: privateQueryKey('requests', { page: 1 }),
    queryFn: guardedQuery(async () => { calls++; return pending.promise; }), staleTime: freshness.requests };
  const first = queryClient.fetchQuery(options);
  const second = queryClient.fetchQuery(options);
  pending.resolve([{ id: 1 }]);
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
  await queryClient.fetchQuery(options);
  assert.equal(calls, 1);
});

test('a returning observer immediately receives stale data during background refresh', async () => {
  const key = privateQueryKey('schedules', 'list');
  queryClient.setQueryData(key, ['cached'], { updatedAt: 1 });
  const pending = defer();
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: guardedQuery(() => pending.promise), staleTime: 0 });
  const unsubscribe = observer.subscribe(() => {});
  assert.deepEqual(observer.getCurrentResult().data, ['cached']);
  assert.equal(observer.getCurrentResult().isPending, false);
  assert.equal(observer.getCurrentResult().isFetching, true);
  pending.resolve(['authoritative']);
  await flush();
  assert.deepEqual(observer.getCurrentResult().data, ['authoritative']);
  unsubscribe();
});

test('a failed read remains retryable and is not cached as success', async () => {
  const key = privateQueryKey('requests');
  await assert.rejects(queryClient.fetchQuery({ queryKey: key, queryFn: async () => { throw new Error('offline'); }, retry: false }));
  assert.equal(queryClient.getQueryData(key), undefined);
  assert.equal(await queryClient.fetchQuery({ queryKey: key, queryFn: async () => 'recovered' }), 'recovered');
});

test('UID, role, parish and complete filter parameters produce separate keys', () => {
  const first = privateQueryKey('requests', { search: 'a', status: 'pending', page: 1, pageSize: 5 });
  const otherPage = privateQueryKey('requests', { search: 'a', status: 'pending', page: 2, pageSize: 5 });
  assert.notEqual(hashKey(first), hashKey(otherPage));
  queryClient.setQueryData(first, ['private']);
  for (const [uid, role, parish] of [['fixture-b', 'SECRETARY', '3'], ['fixture-a', 'PRIEST', '3'], ['fixture-a', 'SECRETARY', '4']]) {
    setQueryScope(uid, role, parish);
    assert.equal(queryClient.getQueryData(first), undefined);
    assert.notEqual(hashKey(first), hashKey(privateQueryKey('requests', { search: 'a', status: 'pending', page: 1, pageSize: 5 })));
  }
});

test('logout aborts session transport and prevents a late protected response from repopulating cache', async () => {
  const pending = defer();
  const key = privateQueryKey('requests');
  const signal = getSessionSignal();
  const result = queryClient.fetchQuery({ queryKey: key, queryFn: guardedQuery(() => pending.promise) }).catch(() => null);
  setQueryScope(null);
  assert.equal(signal.aborted, true);
  pending.resolve(['previous user']);
  await result;
  await flush();
  assert.equal(getQueryScope(), null);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
});

test('scope listeners fire once per actual scope change and stable profile refresh preserves cache', () => {
  let changes = 0;
  const unsubscribe = subscribeQueryScope(() => changes++);
  queryClient.setQueryData(privateQueryKey('profile'), 'cached');
  setQueryScope('fixture-a', 'SECRETARY', 3);
  assert.equal(changes, 0);
  assert.equal(queryClient.getQueryData(privateQueryKey('profile')), 'cached');
  setQueryScope('fixture-a', 'SECRETARY', 4);
  assert.equal(changes, 1);
  unsubscribe();
});

test('mutation cancellation prevents older reads from overwriting a newer authoritative result', async () => {
  const pending = defer();
  const key = privateQueryKey('requests', 'detail', '7');
  const result = queryClient.fetchQuery({ queryKey: key, queryFn: guardedQuery(() => pending.promise) }).catch(() => null);
  const mutation = mutationCache('/requests/7/corrections');
  await mutation.cancel();
  await mutation.invalidate();
  queryClient.setQueryData(key, { status: 'processing' });
  pending.resolve({ status: 'pending' });
  await result;
  await flush();
  assert.deepEqual(queryClient.getQueryData(key), { status: 'processing' });
});

test('successful mutation invalidation refreshes active queries and keeps inactive variants stale', async () => {
  let calls = 0;
  const key = privateQueryKey('requests', 'list', { page: 1 });
  const inactive = privateQueryKey('requests', 'list', { page: 2 });
  queryClient.setQueryData(key, ['cached']);
  queryClient.setQueryData(inactive, ['other page']);
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: guardedQuery(async () => [++calls]), staleTime: 600_000 });
  const unsubscribe = observer.subscribe(() => {});
  await mutationCache('/document-requests/7/status').invalidate();
  assert.deepEqual(queryClient.getQueryData(key), [1]);
  assert.equal(queryClient.getQueryState(inactive).isInvalidated, true);
  unsubscribe();
});

test('disabled modal/mutation observers retain data without automatic invalidation fetches', async () => {
  let calls = 0;
  const key = privateQueryKey('schedules', 'list');
  queryClient.setQueryData(key, ['cached']);
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: guardedQuery(async () => { calls++; return ['fresh']; }), enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  await mutationCache('/schedule-requests/7/priest-respond').invalidate();
  assert.equal(calls, 0);
  assert.deepEqual(observer.getCurrentResult().data, ['cached']);
  observer.setOptions({ ...observer.options, enabled: true });
  await flush();
  assert.equal(calls, 1);
  unsubscribe();
});

test('global form pauses invalidate data without bypassing the existing refresh pause', async () => {
  let calls = 0;
  const key = privateQueryKey('requests');
  queryClient.setQueryData(key, ['cached']);
  const observer = new QueryObserver(queryClient, { queryKey: key,
    queryFn: guardedQuery(async () => { calls++; return ['fresh']; }), staleTime: 600_000 });
  const unsubscribe = observer.subscribe(() => {});
  const previousWindow = globalThis.window;
  globalThis.window = { __pollingPauseCount: 1 };
  try {
    await mutationCache('/requests/7/receipt').invalidate();
    assert.equal(queryClient.getQueryState(key).isInvalidated, true);
    assert.equal(calls, 0);
  } finally {
    if (previousWindow) globalThis.window = previousWindow;
    else delete globalThis.window;
    unsubscribe();
  }
});

test('old-session mutation completion cannot invalidate the new user cache', async () => {
  const mutation = mutationCache('/requests/7');
  setQueryScope('fixture-b', 'SECRETARY', '3');
  const key = privateQueryKey('requests');
  queryClient.setQueryData(key, ['new user']);
  await mutation.invalidate();
  assert.equal(queryClient.getQueryState(key).isInvalidated, false);
});

test('logout and re-login to the same UID also reject obsolete mutation and preload callbacks', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.document = { visibilityState: 'visible' };
  const mutation = mutationCache('/requests/7');
  let preloads = 0;
  schedulePreload([async () => { preloads++; }]);
  setQueryScope(null);
  setQueryScope('fixture-a', 'SECRETARY', '3');
  const key = privateQueryKey('requests');
  queryClient.setQueryData(key, ['current session']);
  await mutation.invalidate();
  t.mock.timers.tick(1500); await flush();
  assert.equal(queryClient.getQueryState(key).isInvalidated, false);
  assert.equal(preloads, 0);
});

test('explicit polling/manual refetch bypasses freshness and still deduplicates in-flight requests', async () => {
  let calls = 0;
  const key = privateQueryKey('notifications');
  const observer = new QueryObserver(queryClient, { queryKey: key, queryFn: guardedQuery(async () => ++calls), staleTime: 600_000 });
  const unsubscribe = observer.subscribe(() => {});
  await flush();
  await observer.refetch({ cancelRefetch: false });
  assert.equal(calls, 2);
  unsubscribe();
});

test('freshness is bounded and availability is immediately stale', () => {
  assert.equal(freshness.parishes, 600_000);
  assert.equal(freshness.events, 300_000);
  assert.equal(freshness.notifications, 30_000);
  assert.equal(freshness.requests, 30_000);
  assert.equal(freshness.schedules, 30_000);
  assert.equal(freshness.availability, 0);
  assert.equal(queryClient.getDefaultOptions().queries.gcTime, 600_000);
});

test('preload is deferred, sequential, and reuses an already cached/in-flight query', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.document = { visibilityState: 'visible' };
  const order = [];
  const stop = schedulePreload([async () => order.push(1), async () => order.push(2)]);
  assert.deepEqual(order, []);
  t.mock.timers.tick(1500);
  await flush();
  assert.deepEqual(order, [1, 2]);
  const key = privateQueryKey('parishes');
  queryClient.setQueryData(key, ['cached']);
  schedulePreload([() => queryClient.prefetchQuery({ queryKey: key, queryFn: async () => { throw new Error('must reuse cache'); }, staleTime: 600_000 })]);
  t.mock.timers.tick(1500);
  await flush();
  assert.deepEqual(queryClient.getQueryData(key), ['cached']);
  stop();
});

test('preload stops on hidden tabs, pauses, cancellation, foreground reads and account switches', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.document = { visibilityState: 'hidden' };
  let calls = 0;
  const task = async () => { calls++; };
  schedulePreload([task]);
  t.mock.timers.tick(1500); await flush();
  document.visibilityState = 'visible';
  schedulePreload([task], () => false);
  t.mock.timers.tick(1500); await flush();
  const stop = schedulePreload([task]); stop();
  t.mock.timers.tick(1500); await flush();
  schedulePreload([task]); setQueryScope('fixture-b', 'PRIEST', '4');
  t.mock.timers.tick(1500); await flush();
  const pending = defer();
  const request = queryClient.fetchQuery({ queryKey: privateQueryKey('requests'), queryFn: () => pending.promise });
  schedulePreload([task]);
  t.mock.timers.tick(1500); await flush();
  pending.resolve([]); await request;
  assert.equal(calls, 0);
});
