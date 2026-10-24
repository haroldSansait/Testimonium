import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  CheckSquare,
  XCircle,
  CreditCard,
  ShieldCheck,
  Calendar,
  CalendarCheck,
  CalendarX,
  Bell,
  Inbox,
  X,
  ExternalLink
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import type { AppNotification } from '../../types';
import { getNotificationUrl } from '../../utils/notificationNavigation';
import {
  TOAST_DURATION_MS,
  MAX_VISIBLE_DESKTOP,
  MAX_VISIBLE_MOBILE,
  toastLayerReducer
} from './toastLayerModel';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'document-submitted':
      return <FilePlus className="text-blue-600 flex-shrink-0" size={18} />;
    case 'document-approved':
    case 'document-ready':
    case 'document-completed':
      return <CheckSquare className="text-emerald-600 flex-shrink-0" size={18} />;
    case 'document-cancelled':
    case 'document-rejected':
      return <XCircle className="text-rose-600 flex-shrink-0" size={18} />;
    case 'payment-requested':
      return <CreditCard className="text-amber-500 flex-shrink-0" size={18} />;
    case 'payment-verified':
      return <ShieldCheck className="text-emerald-600 flex-shrink-0" size={18} />;
    case 'appointment-submitted':
      return <Calendar className="text-blue-600 flex-shrink-0" size={18} />;
    case 'appointment-confirmed':
      return <CalendarCheck className="text-emerald-600 flex-shrink-0" size={18} />;
    case 'appointment-declined':
      return <CalendarX className="text-rose-600 flex-shrink-0" size={18} />;
    case 'announcement':
      return <Bell className="text-purple-600 flex-shrink-0" size={18} />;
    default:
      return <Inbox className="text-crimson flex-shrink-0" size={18} />;
  }
};

export const NotificationToastLayer: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, newlyArrivedIds, markAsRead } = useNotifications();
  const { user } = useAuth();

  const [state, dispatch] = useReducer(toastLayerReducer, {
    visible: [],
    queue: [],
    overflowCount: 0
  });

  const seenNotificationIds = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const overflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive maxVisible calculation (Desktop: 3, Mobile: 2)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth) {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateSize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const maxVisible = isMobile ? MAX_VISIBLE_MOBILE : MAX_VISIBLE_DESKTOP;

  // Session reset: clear state if user logs out
  useEffect(() => {
    if (!user) {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
      if (overflowTimerRef.current) {
        clearTimeout(overflowTimerRef.current);
        overflowTimerRef.current = null;
      }
      seenNotificationIds.current.clear();
      dispatch({ type: 'RESET' });
    }
  }, [user]);

  // Tab visibility listener: pause/resume countdowns when browser tab changes visibility
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        dispatch({ type: 'PAUSE_ALL' });
      } else {
        dispatch({ type: 'RESUME_ALL' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Arrival detection & baseline establishing
  useEffect(() => {
    if (!user) return;

    // 1. Initial baseline: when newlyArrivedIds is empty, seed seen IDs with all current notifications
    if (!newlyArrivedIds || newlyArrivedIds.length === 0) {
      notifications.forEach(n => seenNotificationIds.current.add(n.id));
      return;
    }

    // 2. Genuinely new arrivals: filter out any ID that was already seen in this session
    const genuinelyNew = newlyArrivedIds.filter(id => !seenNotificationIds.current.has(id));
    if (genuinelyNew.length === 0) return;

    // Immediately record in seen set so duplicate renders/polls never process them again
    genuinelyNew.forEach(id => seenNotificationIds.current.add(id));

    // Get actual notification objects, keeping only unread ones
    const newNotifications = genuinelyNew
      .map(id => notifications.find(n => n.id === id))
      .filter((n): n is AppNotification => Boolean(n && !n.read));

    if (newNotifications.length === 0) return;

    dispatch({
      type: 'ENQUEUE_ARRIVALS',
      items: newNotifications,
      maxVisible
    });
  }, [newlyArrivedIds, notifications, user, maxVisible]);

  // Synchronize timers for visible toasts
  useEffect(() => {
    const activeIds = new Set(state.visible.map(t => t.notification.id));

    // Clear timers for toasts no longer visible
    timersRef.current.forEach((timer, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });

    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

    // Ensure timer exists for each unpaused visible toast
    state.visible.forEach(item => {
      const shouldRun = !item.isHovered && !item.isFocused && !isTabHidden;
      const hasTimer = timersRef.current.has(item.notification.id);

      if (shouldRun && !hasTimer) {
        const timer = setTimeout(() => {
          timersRef.current.delete(item.notification.id);
          dispatch({ type: 'REMOVE_VISIBLE', id: item.notification.id, maxVisible });
        }, item.remainingMs);
        timersRef.current.set(item.notification.id, timer);
      } else if (!shouldRun && hasTimer) {
        const timer = timersRef.current.get(item.notification.id);
        if (timer) clearTimeout(timer);
        timersRef.current.delete(item.notification.id);
      }
    });
  }, [state.visible, maxVisible]);

  // Auto-dismiss for the overflow summary card after 7 seconds
  useEffect(() => {
    const showOverflow =
      state.overflowCount > 0 &&
      state.visible.length < maxVisible &&
      state.queue.length === 0;

    if (showOverflow) {
      if (!overflowTimerRef.current) {
        overflowTimerRef.current = setTimeout(() => {
          overflowTimerRef.current = null;
          dispatch({ type: 'DISMISS_OVERFLOW' });
        }, TOAST_DURATION_MS);
      }
    } else if (overflowTimerRef.current) {
      clearTimeout(overflowTimerRef.current);
      overflowTimerRef.current = null;
    }
  }, [state.overflowCount, state.visible.length, state.queue.length, maxVisible]);

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    const overflowTimer = overflowTimerRef;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      if (overflowTimer.current) {
        clearTimeout(overflowTimer.current);
        overflowTimer.current = null;
      }
    };
  }, []);

  const handleToastClick = useCallback((notif: AppNotification) => {
    // 1. Mark as read optimistically if unread without awaiting navigation
    if (!notif.read) {
      void markAsRead(notif.id).catch(err => {
        console.error('[NotificationToastLayer] Failed to mark as read:', err);
      });
    }

    // 2. Remove from visible stack
    dispatch({ type: 'REMOVE_VISIBLE', id: notif.id, maxVisible });

    // 3. Navigate to contextual deep link
    navigate(getNotificationUrl(notif));
  }, [markAsRead, maxVisible, navigate]);

  const handleDismiss = useCallback((id: string) => {
    // Manual dismissal removes the toast without marking as read or modifying backend data
    dispatch({ type: 'REMOVE_VISIBLE', id, maxVisible });
  }, [maxVisible]);

  const handleOverflowClick = useCallback(() => {
    dispatch({ type: 'DISMISS_OVERFLOW' });
    navigate('/dashboard/notifications');
  }, [navigate]);

  const handleDismissOverflow = useCallback(() => {
    if (overflowTimerRef.current) {
      clearTimeout(overflowTimerRef.current);
      overflowTimerRef.current = null;
    }
    dispatch({ type: 'DISMISS_OVERFLOW' });
  }, []);

  const showOverflowCard =
    state.overflowCount > 0 &&
    state.visible.length < maxVisible &&
    state.queue.length === 0;

  if (state.visible.length === 0 && !showOverflowCard) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Notification alerts"
      aria-live="polite"
      className="fixed top-20 right-4 sm:right-6 z-30 flex flex-col space-y-2.5 w-[calc(100vw-2rem)] sm:w-96 max-w-sm sm:max-w-md pointer-events-none"
    >
      {state.visible.map(toast => (
        <div
          key={toast.notification.id}
          role="button"
          tabIndex={0}
          onClick={() => handleToastClick(toast.notification)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToastClick(toast.notification);
            }
          }}
          onMouseEnter={() =>
            dispatch({ type: 'PAUSE_TOAST', id: toast.notification.id, isHovered: true })
          }
          onMouseLeave={() =>
            dispatch({ type: 'RESUME_TOAST', id: toast.notification.id, isHovered: false })
          }
          onFocus={() =>
            dispatch({ type: 'PAUSE_TOAST', id: toast.notification.id, isFocused: true })
          }
          onBlur={() =>
            dispatch({ type: 'RESUME_TOAST', id: toast.notification.id, isFocused: false })
          }
          className="pointer-events-auto bg-white border border-border/80 border-l-4 border-l-crimson rounded-card shadow-card hover:shadow-lg transition-all duration-200 cursor-pointer p-3.5 flex items-start gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
          aria-label={`Notification: ${toast.notification.title}. Click to view details.`}
        >
          <div className="p-2 bg-app-page rounded-button border border-border/40 flex-shrink-0 mt-0.5">
            {getNotificationIcon(toast.notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-crimson uppercase tracking-wider">
                New Notification
              </span>
              <span className="text-[10px] text-text-muted flex-shrink-0">
                Just now
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-text-primary truncate mt-0.5 group-hover:text-crimson transition-colors">
              {toast.notification.title}
            </h4>
            <p className="text-xs text-text-muted line-clamp-2 mt-0.5 leading-relaxed">
              {toast.notification.message}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-crimson group-hover:underline">
              <span>View details</span>
              <ExternalLink size={11} className="inline" />
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handleDismiss(toast.notification.id);
            }}
            className="p-1 rounded-button text-text-muted hover:text-text-primary hover:bg-app-page transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson flex-shrink-0 -mr-1 -mt-1"
            aria-label={`Dismiss notification: ${toast.notification.title}`}
          >
            <X size={15} />
          </button>
        </div>
      ))}

      {showOverflowCard && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleOverflowClick}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOverflowClick();
            }
          }}
          className="pointer-events-auto bg-white border border-border/80 border-l-4 border-l-crimson rounded-card shadow-card hover:shadow-lg transition-all duration-200 cursor-pointer p-3.5 flex items-center justify-between gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
          aria-label={`${state.overflowCount} more new notifications. Click to open notification center.`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-app-page rounded-button border border-border/40 flex-shrink-0">
              <Bell size={18} className="text-crimson" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-text-primary truncate group-hover:text-crimson transition-colors">
                +{state.overflowCount} more new notification{state.overflowCount > 1 ? 's' : ''}
              </h4>
              <p className="text-xs text-text-muted truncate">
                Click to view all in Notification Center
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              handleDismissOverflow();
            }}
            className="p-1 rounded-button text-text-muted hover:text-text-primary hover:bg-app-page transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson flex-shrink-0"
            aria-label="Dismiss notifications summary"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationToastLayer;
