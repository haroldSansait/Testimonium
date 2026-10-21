import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { AppNotification } from '../types';
import services from '../providers/factory';
import { useAuth } from './AuthContext';
import { useQuery } from '../hooks/useService';
import { getQueryScope, getSessionSignal, queryClient, privateQueryKey } from '../services/queryClient';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  newlyArrivedIds: string[];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 30000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const mutating = useRef(false);
  const query = useQuery(() => services.notification.getNotifications(), ['notifications'], {
    staleTime: 30_000, pollInterval: POLL_INTERVAL_MS, requireFocus: false, respectPause: false,
    refreshAllowed: () => !mutating.current,
  });
  const notifications = user ? query.data ?? [] : [];
  const setNotifications = (update: (previous: AppNotification[]) => AppNotification[]) =>
    query.setData(previous => update(previous ?? []));
  const loading = Boolean(user) && query.loading;
  const [actionError, setError] = useState<Error | null>(null);
  const error = actionError ?? query.error ?? null;
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<string[]>([]);
  const previousIds = useRef<Set<string> | null>(null);
  const highlightTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = highlightTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!query.data) return;
    const ids = new Set(query.data.map(n => n.id));
    const arrived = previousIds.current ? [...ids].filter(id => !previousIds.current!.has(id)) : [];
    previousIds.current = ids;
    if (!arrived.length) return;
    setNewlyArrivedIds(previous => [...previous, ...arrived]);
    const timer = setTimeout(() => {
      setNewlyArrivedIds(previous => previous.filter(id => !arrived.includes(id)));
      highlightTimers.current.delete(timer);
    }, 8000);
    highlightTimers.current.add(timer);
  }, [query.data]);
  const refetchNotifications = query.refetch;
  const refresh = useCallback(async () => { setError(null); await refetchNotifications(); }, [refetchNotifications]);

  // Derive unread count directly from state
  const unreadCount = notifications.filter(n => !n.read).length;

  // Serialize actions so rollback cannot undo a later successful read action.
  const markRead = (id?: string) => {
    const scope = getQueryScope();
    const sessionSignal = getSessionSignal();
    const action = mutationQueue.current.then(async () => {
      if (sessionSignal.aborted || !scope || scope !== getQueryScope()) return;
      mutating.current = true;
      const originals = new Map((queryClient.getQueryData<AppNotification[]>(privateQueryKey('notifications')) ?? []).map(n => [n.id, n.read]));
      setNotifications(previous => previous.map(n => !id || n.id === id ? { ...n, read: true } : n));
      try {
        if (id) await services.notification.markAsRead(id);
        else await services.notification.markAllAsRead();
        if (!sessionSignal.aborted && scope === getQueryScope()) setError(null);
      } catch (err) {
        setNotifications(previous => previous.map(n => ((!id || n.id === id) && originals.has(n.id)) ? { ...n, read: originals.get(n.id)! } : n));
        if (!sessionSignal.aborted && scope === getQueryScope()) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        mutating.current = false;
      }
    });
    mutationQueue.current = action;
    return action;
  };
  const markAsRead = (id: string) => markRead(id);
  const markAllAsRead = () => markRead();

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        newlyArrivedIds,
        markAsRead,
        markAllAsRead,
        refresh
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
