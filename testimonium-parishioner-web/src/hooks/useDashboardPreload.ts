import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import services from '../providers/factory';
import { isPollingPaused } from './useService';
import { privateQueryKey, guardedQuery, queryClient, schedulePreload, freshness } from '../services/queryClient';

export function useDashboardPreload(ready: boolean) {
  const { user, appProfile } = useAuth();
  const uid = user?.uid;
  useEffect(() => {
    if (!ready || !uid || appProfile?.role !== 'PARISHIONER'
      || !appProfile.termsAccepted || !appProfile.privacyAccepted) return;
    return schedulePreload([
      () => queryClient.prefetchQuery({ queryKey: privateQueryKey('parishes'),
        queryFn: guardedQuery(() => services.parish.getParishes()), staleTime: freshness.parishes }),
      () => queryClient.prefetchQuery({ queryKey: privateQueryKey('requests', 'list'),
        queryFn: guardedQuery(() => services.request.getRequests()), staleTime: freshness.requests }),
      () => queryClient.prefetchQuery({ queryKey: privateQueryKey('schedules', 'list'),
        queryFn: guardedQuery(() => services.scheduler.getAppointments()), staleTime: freshness.schedules }),
      () => import('../pages/dashboard/ParishDirectoryPage'),
      () => import('../pages/dashboard/RequestTrackingPage'),
    ], () => !isPollingPaused());
  }, [ready, uid, appProfile?.role, appProfile?.parish?.id, appProfile?.termsAccepted, appProfile?.privacyAccepted]);
}
