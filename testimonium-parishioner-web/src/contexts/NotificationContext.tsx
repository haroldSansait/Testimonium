import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { AppNotification } from '../types';
import services from '../providers/factory';
import { useAuth } from './AuthContext';
import { useQuery } from '../hooks/useService';
import { getQueryScope, getSessionSignal, queryClient, privateQueryKey, subscribeQueryScope } from '../services/queryClient';
import { NotificationToastLayer } from '../components/notifications/NotificationToastLayer';
import { MAX_VISIBLE_DESKTOP } from '../components/notifications/toastLayerModel';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  newlyArrivedIds: string[];
  loginBacklog: { items: AppNotification[]; remainingCount: number } | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 30000;

// Persist only a per-tab replay marker, never notification content. Keep logout
// cleanup subscribed for the document lifetime, including when protected routes unmount.
const BACKLOG_SESSION_KEY = 'testimonium_notification_toast_backlog';
let claimedUser: string | null = null;
let previousScope = getQueryScope();
subscribeQueryScope(() => {
  const scope = getQueryScope();
  if (previousScope && scope !== previousScope) {
    claimedUser = null;
    try { sessionStorage.removeItem(BACKLOG_SESSION_KEY); } catch { /* Storage may be unavailable. */ }
  }
  previousScope = scope;
});
function claimLoginBacklog(uid: string) {
  try {
    if (sessionStorage.getItem(BACKLOG_SESSION_KEY) === uid) { claimedUser = uid; return false; }
  } catch { /* Retain in-memory deduplication if session storage is unavailable. */ }
  if (claimedUser === uid) return false;
  claimedUser = uid;
  try { sessionStorage.setItem(BACKLOG_SESSION_KEY, uid); } catch { /* In-memory fallback. */ }
  return true;
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Reset arrival IDs, highlights, mutations and toast timers together on logout/account changes.
  return <NotificationSessionProvider key={user?.uid ?? 'anonymous'}>{children}</NotificationSessionProvider>;
};

const NotificationSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  const [loginBacklog, setLoginBacklog] = useState<NotificationContextType['loginBacklog']>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const highlightTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = highlightTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    // An unresolved query is not an empty baseline. Only the first available
    // snapshot establishes history; IDs remain known for this entire session.
    if (!user || !query.data) return;
    const ids = new Set(query.data.map(n => n.id));
    if (seenIds.current === null) {
      seenIds.current = ids;
      if (claimLoginBacklog(user.uid)) {
        const unread = query.data.filter(n => n.read === false)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLoginBacklog({ items: unread.slice(0, MAX_VISIBLE_DESKTOP),
          remainingCount: Math.max(0, unread.length - MAX_VISIBLE_DESKTOP) });
      }
      return;
    }
    const arrived = [...ids].filter(id => !seenIds.current!.has(id));
    arrived.forEach(id => seenIds.current!.add(id));
    if (!arrived.length) return;
    setNewlyArrivedIds(previous => [...previous, ...arrived]);
    const timer = setTimeout(() => {
      setNewlyArrivedIds(previous => previous.filter(id => !arrived.includes(id)));
      highlightTimers.current.delete(timer);
    }, 8000);
    highlightTimers.current.add(timer);
  }, [query.data, user]);
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
        loginBacklog,
        markAsRead,
        markAllAsRead,
        refresh
      }}
    >
      <NotificationToastLayer />
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
