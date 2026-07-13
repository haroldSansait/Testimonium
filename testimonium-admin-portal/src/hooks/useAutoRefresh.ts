import { useEffect, useRef } from 'react';

interface AutoRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * useAutoRefresh — visibility-aware polling hook.
 *
 * Automatically refreshes page data at specified intervals while:
 * 1. The tab is active (visible).
 * 2. Enabled condition is met (e.g. not loading, no active admin modal/actions).
 */
export function useAutoRefresh(
  refreshFn: () => void | Promise<void>,
  options: AutoRefreshOptions = {}
) {
  const { intervalMs = 30000, enabled = true } = options;
  const savedCallback = useRef(refreshFn);

  // Keep callback reference updated
  useEffect(() => {
    savedCallback.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: any = null;

    const tick = () => {
      if (document.visibilityState === 'visible' && enabled) {
        void savedCallback.current();
      }
    };

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(tick, intervalMs);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Start polling initially if visible
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Trigger immediate fetch and start interval
        void savedCallback.current();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
