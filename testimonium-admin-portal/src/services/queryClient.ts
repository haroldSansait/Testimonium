import { CancelledError, QueryClient, type QueryKey } from '@tanstack/react-query';

// Each portal owns one memory-only client. Never persist this cache.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => {
        const status = (error as { status?: number; statusCode?: number }).status
          ?? (error as { statusCode?: number }).statusCode;
        return count < 1 && (!status || status >= 500);
      },
      // Existing refresh hooks own polling, focus, visibility and pause handling.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: false },
  },
});

export const freshness = {
  parishes: 600_000, events: 300_000, notifications: 30_000,
  requests: 30_000, schedules: 30_000, profile: 30_000, availability: 0,
} as const;

let scope: string | null = null;
let generation = 0;
let sessionController = new AbortController();
export const getSessionSignal = () => sessionController.signal;
const listeners = new Set<() => void>();
export const getQueryScope = () => scope;
export const subscribeQueryScope = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function setQueryScope(uid: string | null, role = '', parishId: unknown = null) {
  const next = uid ? JSON.stringify([uid, role, parishId == null ? null : String(parishId)]) : null;
  if (next === scope) return;
  generation++;
  if (scope) sessionController.abort();
  sessionController = new AbortController();
  scope = next;
  void queryClient.cancelQueries();
  queryClient.clear();
  listeners.forEach(listener => listener());
}

export function privateQueryKey(resource: string, ...parts: unknown[]): QueryKey {
  return ['protected', ...(scope ? JSON.parse(scope) : [null, null, null]), resource, ...parts];
}

// Consume the query signal even where an existing provider cannot accept it yet.
// A cancelled read can finish on the wire but cannot publish obsolete results.
export function guardedQuery<T>(queryFn: () => Promise<T>) {
  const expectedScope = scope;
  const expectedGeneration = generation;
  return async ({ signal }: { signal: AbortSignal }): Promise<T> => {
    if (!expectedScope || expectedScope !== scope || expectedGeneration !== generation || signal.aborted) {
      throw new CancelledError();
    }
    const result = await queryFn();
    if (expectedScope !== scope || expectedGeneration !== generation || signal.aborted) throw new CancelledError();
    return result;
  };
}

export function affectedResources(endpoint: string): string[] {
  // Recommendation generation is an existing read-only POST.
  if (endpoint === '/schedule-requests/recommendations') return [];
  if (/^\/notifications(?:\/|$)/.test(endpoint)) return ['notifications', 'dashboard', 'diocese'];
  if (/^\/(?:requests|document-requests|payment)(?:\/|$)/.test(endpoint)) return ['requests', 'payment', 'dashboard', 'diocese', 'notifications'];
  if (/^\/(?:schedule-requests|schedule-availability|mass-schedules|parish-events|calendar|parish-availabilities|priest)(?:\/|$)/.test(endpoint)) return ['schedules', 'availability', 'calendar', 'events', 'parishes', 'dashboard', 'diocese', 'notifications'];
  if (/^\/(?:parishes|users|auth)(?:\/|$)/.test(endpoint)) return ['parishes', 'users', 'profile', 'requests', 'schedules', 'availability', 'calendar', 'payment', 'dashboard', 'diocese', 'notifications'];
  if (/^\/document-requirements(?:\/|$)/.test(endpoint)) return ['requests', 'requirements'];
  return [];
}

export function mutationCache(endpoint: string) {
  const expectedScope = scope;
  const expectedGeneration = generation;
  const resources = affectedResources(endpoint);
  const filter = { predicate: (query: { queryKey: QueryKey }) =>
    expectedScope === scope && expectedGeneration === generation && query.queryKey[0] === 'protected'
      && resources.includes(String(query.queryKey[4])) };
  return {
    cancel: () => queryClient.cancelQueries(filter),
    invalidate: async () => {
      if (expectedScope !== scope || expectedGeneration !== generation) return;
      await queryClient.cancelQueries(filter);
      const paused = typeof window !== 'undefined'
        && ((window as Window & { __pollingPauseCount?: number }).__pollingPauseCount ?? 0) > 0;
      await queryClient.invalidateQueries({ ...filter, refetchType: paused ? 'none' : 'active' });
    },
  };
}

// Called only after visible dashboard data is ready. One background read at a
// time; stop on navigation/session changes, hidden tabs, or foreground requests.
export function schedulePreload(tasks: Array<() => Promise<unknown>>, allowed = () => true) {
  let stopped = false;
  const expectedScope = scope;
  const expectedGeneration = generation;
  const run = async () => {
    for (const task of tasks) {
      if (stopped || !expectedScope || scope !== expectedScope || expectedGeneration !== generation || !allowed()
        || document.visibilityState !== 'visible' || queryClient.isFetching() > 0) return;
      try { await task(); } catch { /* Navigation must not depend on prefetch success. */ }
    }
  };
  const timer = setTimeout(() => { void run(); }, 1500);
  return () => { stopped = true; clearTimeout(timer); };
}
