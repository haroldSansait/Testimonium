import { useState, useEffect, useCallback } from 'react';
import services from '../providers/factory';
import type { UserProfile } from '../types';

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
      
      setData(res);
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
      if (document.visibilityState === 'visible') {
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

export const usePaymentConfiguration = (parishId?: string) => {
  return useQuery(() => services.payment.getPaymentConfiguration(parishId), [parishId]);
};

