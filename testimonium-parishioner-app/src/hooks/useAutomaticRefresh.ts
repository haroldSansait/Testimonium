import { useCallback, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

const subscribe = (onChange: () => void) => {
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
};
const isForeground = () => AppState.currentState === "active";

// Only these opted-in observers revalidate on resume; global query defaults stay intact.
export const useForegroundRefresh = (interval: number | false) => {
  const foreground = useSyncExternalStore(subscribe, isForeground);
  const { user } = useAuth();
  return {
    enabled: Boolean(user?.uid) && foreground,
    staleTime: 0,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  } as const;
};

export const useScreenRefresh = (interval: number | false = 10_000, valid = true) => {
  const focused = useIsFocused();
  const options = useForegroundRefresh(interval);
  // A stale, disabled observer fetches once when focus/foreground enables it again.
  // React Query shares any in-flight request for the same key.
  return { ...options, enabled: options.enabled && focused && valid };
};

// Automatic network activity must not animate the pull-to-refresh indicator.
export const useManualRefresh = (refresh: () => Promise<unknown>) => {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, onRefresh };
};
