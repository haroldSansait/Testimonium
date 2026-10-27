import { useEffect, useCallback, useMemo } from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { NotificationService } from '@/services/NotificationService';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { calculateNotificationBadgeCounts, type NotificationBadgeCounts } from '@/utils/notificationBadgeCounts';

export { calculateNotificationBadgeCounts };
export type { NotificationBadgeCounts };

interface UseNotificationCountsOptions {
  enableAutoRefresh?: boolean;
}

/**
 * Shared hook that provides authoritative notification badge counts
 * backed by TanStack React Query cache and visibility-aware polling.
 */
export function useNotificationCounts(options: UseNotificationCountsOptions = {}) {
  const { enableAutoRefresh = false } = options;

  const query = useCachedQuery(
    ['notifications'],
    () => NotificationService.getNotifications(),
    { staleTime: 30_000 }
  );

  const notifications = query.data ?? [];
  const refetch = query.refetch;

  // Derive counts with pure calculation
  const counts = useMemo(
    () => calculateNotificationBadgeCounts(notifications),
    [notifications]
  );

  // Listen to cross-component updates (mark one read, mark all read)
  useEffect(() => {
    const handleUpdate = () => {
      void refetch(true);
    };
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [refetch]);

  // Periodic visibility-aware auto-refresh (only active when enabled, e.g. in AdminLayout)
  const pollCallback = useCallback(() => {
    void refetch(true);
  }, [refetch]);

  useAutoRefresh(pollCallback, {
    intervalMs: 30_000,
    enabled: enableAutoRefresh,
  });

  return {
    ...counts,
    notifications,
    loading: query.loading,
    refetch,
  };
}
