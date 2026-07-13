import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AppNotification } from '../types';
import services from '../providers/factory';
import { useAuth } from './AuthContext';

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<string[]>([]);
  
  // Use a ref to keep track of the current notifications for comparison in the poll interval
  const notificationsRef = useRef<AppNotification[]>([]);
  notificationsRef.current = notifications;

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const data = await services.notification.getNotifications();
      
      // If we already had notifications, we check for new arrivals
      const prevIds = new Set(notificationsRef.current.map(n => n.id));
      
      // If it's a silent update (polling) and we had previous notifications, identify new ones
      if (silent && prevIds.size > 0) {
        const newIds: string[] = [];
        data.forEach(n => {
          if (!prevIds.has(n.id)) {
            newIds.push(n.id);
          }
        });
        
        if (newIds.length > 0) {
          setNewlyArrivedIds(prev => [...prev, ...newIds]);
          // Clear the highlights after 8 seconds
          setTimeout(() => {
            setNewlyArrivedIds(prev => prev.filter(id => !newIds.includes(id)));
          }, 8000);
        }
      }

      setNotifications(data);
      setError(null);
    } catch (err) {
      console.error("[NotificationProvider] Error fetching notifications:", err);
      // Only set error state if it's not a silent poll to prevent disruptive error states on background failures
      if (!silent) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => fetchNotifications(false), [fetchNotifications]);

  // Initial load when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications(false);
    } else {
      setNotifications([]);
      setNewlyArrivedIds([]);
      setError(null);
    }
  }, [user, fetchNotifications]);

  // Polling loop with tab visibility awareness
  useEffect(() => {
    if (!user) return;

    let intervalId: any = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          fetchNotifications(true);
        }, POLL_INTERVAL_MS);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Start polling initially if tab is active
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Fetch immediately and resume polling when tab becomes visible
        fetchNotifications(true);
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
  }, [user, fetchNotifications]);

  // Derive unread count directly from state
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Optimistic markAsRead
  const markAsRead = async (id: string) => {
    const originalNotifications = [...notifications];
    
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    try {
      await services.notification.markAsRead(id);
    } catch (err) {
      console.error("[NotificationProvider] Failed to mark notification as read, rolling back:", err);
      setNotifications(originalNotifications);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Optimistic markAllAsRead
  const markAllAsRead = async () => {
    const originalNotifications = [...notifications];
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await services.notification.markAllAsRead();
    } catch (err) {
      console.error("[NotificationProvider] Failed to mark all as read, rolling back:", err);
      setNotifications(originalNotifications);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

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
