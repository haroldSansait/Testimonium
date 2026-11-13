import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, BellOff, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { NotificationGroup } from '@/components/notifications/NotificationGroup';
import { NotificationService } from '@/services/NotificationService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { getNotificationDestination } from '@/utils/notificationNavigation';
import type { Notification, NotificationGroup as GroupType } from '@/types';

const FILTER_OPTIONS = [
  { label: 'All Notifications', value: 'all' },
  { label: 'Unread Only', value: 'unread' },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const notifQuery = useCachedQuery<Notification[]>(
    ['notifications'],
    () => NotificationService.getNotifications()
  );
  const notifications = notifQuery.data ?? [];
  const isLoading = notifQuery.loading;
  const error = notifQuery.error;
  const fetchNotifs = notifQuery.refetch;
  const setNotifications = (
    update: Notification[] | ((prev: Notification[]) => Notification[])
  ) =>
    notifQuery.setData((previous) => {
      const current = previous ?? [];
      return typeof update === 'function' ? update(current) : update;
    });

  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Set up auto-refresh polling (every 60 seconds), paused when loading or mutating
  useAutoRefresh(
    () => void fetchNotifs(true),
    { intervalMs: 60000, enabled: !isLoading && !isMarkingAll }
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    setActionError(null);
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await NotificationService.markAllRead();
      window.dispatchEvent(new Event('notifications-updated'));
      await fetchNotifs(true);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setNotifications(previous);
      setActionError('Unable to mark all notifications as read right now. Please try again.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleOpenNotification = async (notif: Notification) => {
    const destination = getNotificationDestination(notif);
    if (!destination) {
      // Static / non-navigable informational notifications must never redirect
      return;
    }

    setActionError(null);

    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
      );

      try {
        await NotificationService.markRead(notif.id);
        window.dispatchEvent(new Event('notifications-updated'));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
        // Proceed with navigation so the administrator can still review the target request
      }
    }

    try {
      navigate(destination.path, { state: destination.state });
    } catch (err) {
      console.error('Failed to navigate from notification:', err);
      setActionError('Unable to open the linked request. Please access it from the sidebar.');
    }
  };

  const filteredNotifs =
    filterMode === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const groups: GroupType[] = ['TODAY', 'YESTERDAY', 'EARLIER'];

  return (
    <div>
      {/* Header row with filter and Mark All Read action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <PageHeader
          title="Notifications"
          subtitle="Stay updated on administrative alerts and requests."
          className="mb-0"
        />

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="w-[175px]">
            <CustomSelect
              value={filterMode}
              onChange={(val) => setFilterMode(val as 'all' | 'unread')}
              options={FILTER_OPTIONS}
              id="notifications-filter-mode"
              aria-label="Filter notifications"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0 || isMarkingAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-crimson-200 bg-white text-crimson-700 hover:bg-crimson-50 hover:border-crimson-300 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isMarkingAll ? 'Marking...' : 'Mark All as Read'}</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <LoadingState message="Loading notifications..." />
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <ErrorState message={error} onRetry={() => void fetchNotifs(false)} />
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F0EE] border border-gray-200/80 flex items-center justify-center mx-auto mb-3.5">
            <BellOff className="w-5 h-5 text-crimson-700" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">
            {filterMode === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {filterMode === 'unread'
              ? 'You are all caught up. Switch back to All Notifications to view previously read alerts.'
              : 'Administrative alerts for document and schedule requests will appear here.'}
          </p>
          {filterMode === 'unread' && notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="mt-4 px-3.5 py-1.5 text-xs font-medium text-crimson-700 bg-crimson-50 hover:bg-crimson-100 rounded-md transition-colors"
            >
              Show all notifications
            </button>
          )}
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <NotificationGroup
              key={group}
              group={group}
              notifications={filteredNotifs.filter((n) => n.group === group)}
              onOpen={handleOpenNotification}
            />
          ))}
        </div>
      )}
    </div>
  );
}
