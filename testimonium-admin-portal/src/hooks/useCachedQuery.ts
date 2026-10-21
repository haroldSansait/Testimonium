import { useCallback, useSyncExternalStore, useMemo, type SetStateAction } from 'react';
import { hashKey, useQuery } from '@tanstack/react-query';
import { getQueryScope, subscribeQueryScope, privateQueryKey, guardedQuery, queryClient, getSessionSignal } from '@/services/queryClient';

// Query owns the data; useAutoRefresh continues to own the existing timers and
// modal/mutation pauses. No second polling or focus-refresh path is installed.
export function useCachedQuery<T>(resourceKey: readonly unknown[], queryFn: () => Promise<T>, options: { staleTime?: number; enabled?: boolean } = {}) {
  const scope = useSyncExternalStore(subscribeQueryScope, getQueryScope);
  const sessionSignal = getSessionSignal();
  const keyHash = hashKey(privateQueryKey(String(resourceKey[0]), ...resourceKey.slice(1)));
  const queryKey = useMemo(() => JSON.parse(keyHash) as readonly unknown[], [keyHash]);
  const enabled = Boolean(scope) && options.enabled !== false;
  const query = useQuery({ queryKey, queryFn: guardedQuery(queryFn), enabled, staleTime: options.staleTime ?? 30_000 });
  const refetchQuery = query.refetch;
  const refetch = useCallback(async (_silent = false) => {
    if (!sessionSignal.aborted && getQueryScope() === scope && scope) return refetchQuery({ cancelRefetch: false });
  }, [refetchQuery, scope, sessionSignal]);
  const setData = useCallback((update: SetStateAction<T | undefined>) => {
    if (sessionSignal.aborted || getQueryScope() !== scope || !scope) return;
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<T>(queryKey, update);
  }, [queryKey, scope, sessionSignal]);
  return { data: scope ? query.data : undefined, setData, refetch,
    loading: query.isPending, error: query.data === undefined ? query.error?.message ?? null : null, isSuccess: query.isSuccess };
}
