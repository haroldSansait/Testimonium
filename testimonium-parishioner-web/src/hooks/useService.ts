import { useEffect, useCallback, useSyncExternalStore, useMemo, useRef, type SetStateAction } from 'react';
import { hashKey, useQuery as useTanstackQuery } from '@tanstack/react-query';
import services from '../providers/factory';
import type { UserProfile, Event } from '../types';
import { getManilaCalendarDate } from '../utils/date';
import { freshness, queryClient, privateQueryKey, guardedQuery, getQueryScope, subscribeQueryScope, getSessionSignal } from '../services/queryClient';

const sharedPollers = new Map<string, { callbacks: Set<() => void>; timer: ReturnType<typeof setInterval> }>();
export function clearAllPollingTimers() {
  sharedPollers.forEach(entry => clearInterval(entry.timer));
  sharedPollers.clear();
}

export function isPollingPaused() {
  return ((window as Window & { __pollingPauseCount?: number }).__pollingPauseCount || 0) > 0;
}

export function usePausePolling(shouldPause = true) {
  useEffect(() => {
    if (!shouldPause) return;
    const target = window as Window & { __pollingPauseCount?: number };
    target.__pollingPauseCount = (target.__pollingPauseCount || 0) + 1;
    return () => { target.__pollingPauseCount = Math.max(0, (target.__pollingPauseCount || 0) - 1); };
  }, [shouldPause]);
}

export function useQuery<T>(queryFn: () => Promise<T>, resourceKey: readonly unknown[], options: { staleTime?: number; enabled?: boolean; pollInterval?: number | false; requireFocus?: boolean; respectPause?: boolean; refreshAllowed?: () => boolean } = {}) {
  const scope = useSyncExternalStore(subscribeQueryScope, getQueryScope);
  const sessionSignal = getSessionSignal();
  const keyHash = hashKey(privateQueryKey(String(resourceKey[0]), ...resourceKey.slice(1)));
  const queryKey = useMemo(() => JSON.parse(keyHash) as readonly unknown[], [keyHash]);
  const enabled = Boolean(scope) && options.enabled !== false;
  const query = useTanstackQuery({
    queryKey, queryFn: guardedQuery(queryFn), enabled,
    staleTime: options.staleTime ?? 30_000,
  });
  const refetchQuery = query.refetch;
  const refetch = useCallback(async (_silent = false) => {
    if (sessionSignal.aborted || getQueryScope() !== scope || !enabled) return;
    await refetchQuery({ cancelRefetch: false });
  }, [refetchQuery, scope, enabled, sessionSignal]);
  const setData = useCallback((update: SetStateAction<T | undefined>) => {
    if (sessionSignal.aborted || getQueryScope() !== scope || !enabled) return;
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<T>(queryKey, update);
  }, [queryKey, scope, enabled, sessionSignal]);

  const { requireFocus, pollInterval, refreshAllowed, respectPause } = options;
  const refreshAllowedRef = useRef(refreshAllowed);
  refreshAllowedRef.current = refreshAllowed;
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && (requireFocus === false || document.hasFocus())
        && (respectPause === false || !isPollingPaused()) && refreshAllowedRef.current?.() !== false) void refetch(true);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = pollInterval ?? 10_000;
    let entry = sharedPollers.get(keyHash);
    if (interval !== false) {
      if (!entry) {
        const callbacks = new Set<() => void>();
        entry = { callbacks, timer: setInterval(() => callbacks.values().next().value?.(), interval) };
        sharedPollers.set(keyHash, entry);
      }
      entry.callbacks.add(refresh);
    }
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      entry?.callbacks.delete(refresh);
      if (entry && entry.callbacks.size === 0) {
        clearInterval(entry.timer);
        sharedPollers.delete(keyHash);
      }
    };
  }, [keyHash, enabled, refetch, pollInterval, requireFocus, respectPause]);

  return { data: enabled ? query.data : undefined, loading: options.enabled !== false && query.isPending,
    error: query.data === undefined ? query.error ?? undefined : undefined, setData, refetch };
}

export const useParishes = () => {
  return useQuery(() => services.parish.getParishes(), ['parishes'], { staleTime: freshness.parishes });
};

export const useParish = (id: string) => {
  return useQuery(() => services.parish.getParishById(id), ['parishes', id], { staleTime: freshness.parishes });
};

export const useRequests = () => {
  return useQuery(() => services.request.getRequests(), ['requests', 'list'], { staleTime: freshness.requests });
};

export const useRequest = (id: string) => {
  return useQuery(() => {
    if (!id) return Promise.resolve(null);
    return services.request.getRequestById(id);
  }, ['requests', 'detail', id]);
};

export const useRequestTracking = (trackingNumber: string) => {
  return useQuery(() => {
    if (!trackingNumber) return Promise.resolve(null);
    return services.request.getRequestByTrackingNumber(trackingNumber);
  }, ['requests', 'tracking', trackingNumber]);
};

export const useAppointments = () => {
  return useQuery(() => services.scheduler.getAppointments(), ['schedules', 'list'], { staleTime: freshness.schedules });
};

export const useProfile = (uid: string) => {
  const query = useQuery(() => {
    if (!uid) return Promise.resolve(undefined);
    return services.profile.getProfile(uid);
  }, ['profile', uid], { enabled: Boolean(uid), staleTime: freshness.profile });
  
  const refetchProfile = query.refetch;
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!uid) return;
    await services.profile.updateProfile(uid, updates);
    await refetchProfile();
  }, [uid, refetchProfile]);

  return { 
    data: query.data, 
    loading: query.loading, 
    error: query.error, 
    refetch: query.refetch, 
    updateProfile 
  };
};

export const useEvents = () => {
  return useQuery(() => services.event.getEvents(), ['events', 'list', getManilaCalendarDate().slice(0, 7)], { staleTime: freshness.events });
};

export const useFeaturedEvents = () => {
  return useQuery(() => services.event.getFeaturedEvents(), ['events', 'list', getManilaCalendarDate().slice(0, 7)], { staleTime: freshness.events });
};

export const useEvent = (id: string) => {
  const events = useEvents();
  const setEvents = events.setData;
  const setData = useCallback((update: SetStateAction<Event | null | undefined>) => {
    setEvents(previous => {
      const current = previous?.find(event => event.id === id);
      const next = typeof update === 'function' ? update(current) : update;
      if (!next) return previous?.filter(event => event.id !== id);
      return [...(previous ?? []).filter(event => event.id !== id), next];
    });
  }, [setEvents, id]);
  return { ...events, data: events.data?.find(event => event.id === id) ?? null, setData };
};

export const usePaymentConfiguration = (requestId?: string) => {
  return useQuery(() => requestId ? services.payment.getPaymentConfiguration(requestId) : Promise.reject(new Error("A request ID is required.")), ['payment', requestId], { enabled: Boolean(requestId), staleTime: 30_000 });
};
