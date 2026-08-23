import { useState, useEffect, useCallback } from 'react';
import services from '../providers/factory';
import type { UserProfile } from '../types';

const sharedPollers: Record<string, {
  refetchCallbacks: Set<() => void>;
  timer: any;
}> = {};

export function clearAllPollingTimers() {
  for (const queryKey in sharedPollers) {
    const entry = sharedPollers[queryKey];
    if (entry.timer) {
      clearInterval(entry.timer);
    }
  }
  // Clear the keys
  for (const queryKey of Object.keys(sharedPollers)) {
    delete sharedPollers[queryKey];
  }
}

export function usePausePolling(shouldPause = true) {
  useEffect(() => {
    if (!shouldPause) return;
    if (typeof window !== 'undefined') {
      (window as any).__pollingPauseCount = ((window as any).__pollingPauseCount || 0) + 1;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__pollingPauseCount = Math.max(0, ((window as any).__pollingPauseCount || 0) - 1);
      }
    };
  }, [shouldPause]);
}

export function useQuery<T>(queryFn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const refetch = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    const startTime = Date.now();
    try {
      const res = await queryFn();
      
      if (!silent) {
        // Ensure minimum display duration of 300ms to prevent skeleton flickering
        const elapsed = Date.now() - startTime;
        if (elapsed < 300) {
          await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
        }
      }
      
      setData(prev => {
        if (prev === undefined) return res;
        // Deep compare using JSON serialization to avoid re-renders if data is unchanged
        if (JSON.stringify(prev) === JSON.stringify(res)) {
          return prev;
        }
        return res;
      });
      setError(undefined);
    } catch (err) {
      console.error("[useQuery Error] Failed query:", queryFn.toString(), err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        void refetch(true); // silent update on window focus / visibility change
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [refetch]);

  // Shared background polling timer (10s)
  useEffect(() => {
    // Generate a unique query key from the function and dependencies
    const queryKey = queryFn.toString() + '_' + JSON.stringify(deps);

    if (!sharedPollers[queryKey]) {
      sharedPollers[queryKey] = {
        refetchCallbacks: new Set(),
        timer: null,
      };
    }

    const entry = sharedPollers[queryKey];

    const localRefetch = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        return;
      }
      if (typeof window !== 'undefined' && (window as any).__pollingPauseCount > 0) {
        return;
      }
      void refetch(true);
    };

    entry.refetchCallbacks.add(localRefetch);

    if (!entry.timer) {
      entry.timer = setInterval(() => {
        entry.refetchCallbacks.forEach(cb => cb());
      }, 10000); // 10s polling interval
    }

    return () => {
      entry.refetchCallbacks.delete(localRefetch);
      if (entry.refetchCallbacks.size === 0) {
        if (entry.timer) {
          clearInterval(entry.timer);
        }
        delete sharedPollers[queryKey];
      }
    };
  }, [refetch]);

  return { data, loading, error, setData, refetch };
}

export const useParishes = () => {
  return useQuery(() => services.parish.getParishes(), []);
};

export const useParish = (id: string) => {
  return useQuery(() => services.parish.getParishById(id), [id]);
};

export const useRequests = () => {
  return useQuery(() => services.request.getRequests(), []);
};

export const useRequest = (id: string) => {
  return useQuery(() => {
    if (!id) return Promise.resolve(null);
    return services.request.getRequestById(id);
  }, [id]);
};

export const useRequestTracking = (trackingNumber: string) => {
  return useQuery(() => {
    if (!trackingNumber) return Promise.resolve(null);
    return services.request.getRequestByTrackingNumber(trackingNumber);
  }, [trackingNumber]);
};

export const useAppointments = () => {
  return useQuery(() => services.scheduler.getAppointments(), []);
};

export const useAnnouncements = () => {
  return useQuery(() => services.announcement.getAnnouncements(), []);
};

export const useProfile = (uid: string) => {
  const query = useQuery(() => {
    if (!uid) return Promise.resolve(undefined);
    return services.profile.getProfile(uid);
  }, [uid]);
  
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!uid) return;
    await services.profile.updateProfile(uid, updates);
    await query.refetch();
  }, [uid, query.refetch]);

  return { 
    data: query.data, 
    loading: query.loading, 
    error: query.error, 
    refetch: query.refetch, 
    updateProfile 
  };
};

export const useEvents = () => {
  return useQuery(() => services.event.getEvents(), []);
};

export const useFeaturedEvents = () => {
  return useQuery(() => services.event.getFeaturedEvents(), []);
};

export const useEvent = (id: string) => {
  return useQuery(() => services.event.getEventById(id), [id]);
};

export const usePaymentConfiguration = (requestId?: string) => {
  return useQuery(() => requestId ? services.payment.getPaymentConfiguration(requestId) : Promise.reject(new Error("A request ID is required.")), [requestId]);
};
