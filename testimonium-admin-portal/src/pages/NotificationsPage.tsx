import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronDown, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { NotificationGroup } from '@/components/notifications/NotificationGroup';
import { NotificationService } from '@/services/NotificationService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { Notification, NotificationGroup as GroupType } from '@/types';

const GROUPS: GroupType[] = ['TODAY', 'YESTERDAY', 'EARLIER'];

interface NoticeModalProps {
  notification: Notification;
  onClose: () => void;
}

function NoticeModal({ notification, onClose }: NoticeModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Info className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          {notification.title}
        </h3>
        <p className="text-xs text-gray-400 mb-4">{notification.timestamp}</p>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {notification.description}
        </p>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const fetchNotifs = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await NotificationService.getNotifications();
      setNotifs(data);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      if (!silent) {
        setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchNotifs(false);
  }, [fetchNotifs]);

  // Visibility-aware polling every 30 seconds, paused if loading or notice modal is open
  useAutoRefresh(
    () => void fetchNotifs(true),
    { intervalMs: 30000, enabled: !isLoading && !selectedNotice }
  );

  const markAllRead = () => {
    // Optimistic UI update
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    // Persist to backend
    void NotificationService.markAllRead().then(() => {
      window.dispatchEvent(new Event('notifications-updated'));
    });
  };

  const handleNotificationAction = async (notif: Notification) => {
    // 1. Mark as read
    await NotificationService.markRead(notif.id);
    window.dispatchEvent(new Event('notifications-updated'));
    void fetchNotifs(true);

    // 2. Perform action based on notification type / reference properties
    if (notif.referenceType === 'DOCUMENT_REQUEST' && notif.referenceId) {
      navigate('/document-requests', { state: { requestId: notif.referenceId } });
    } else if (notif.referenceType === 'SCHEDULE_REQUEST' && notif.referenceId) {
      navigate('/schedule-requests', { state: { requestId: notif.referenceId } });
    } else if (notif.type === 'schedule-conflict') {
      navigate('/schedule-requests', { state: { highlightConflict: true } });
    } else if (notif.type === 'system-update') {
      setSelectedNotice(notif);
    } else {
      // Fallback
      setSelectedNotice(notif);
    }
  };

  const filteredNotifs = notifs.filter((n) => {
    if (filterMode === 'unread') return !n.isRead;
    return true;
  });

  const grouped = (group: GroupType) => filteredNotifs.filter((n) => n.group === group);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on administrative alerts and requests."
        actions={
          <div className="flex items-center gap-2">
            {/* Notifications Filter Dropdown */}
            <div className="w-[170px]">
              <CustomSelect
                value={filterMode}
                onChange={(val) => setFilterMode(val as 'all' | 'unread')}
                options={[
                  { value: 'all', label: 'All Notifications' },
                  { value: 'unread', label: 'Unread Only' },
                ]}
                id="notifications-filter"
                aria-label="Filter notifications"
              />
            </div>

            <button
              id="mark-all-read"
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-crimson-700 hover:text-crimson-800 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All as Read
            </button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading notifications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void fetchNotifs(false)} />
      ) : filteredNotifs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center my-6 shadow-card">
          <p className="text-sm text-gray-500 font-medium">
            {filterMode === 'unread' ? 'No unread notifications.' : 'No notifications found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {GROUPS.map((group) => {
            const groupNotifs = grouped(group);
            if (groupNotifs.length === 0) return null;
            return (
              <NotificationGroup
                key={group}
                group={group}
                notifications={groupNotifs}
                onAction={handleNotificationAction}
              />
            );
          })}
        </div>
      )}

      {/* Load Previous (Disabled - not supported by backend) */}
      <div className="flex justify-center mt-4">
        <button
          id="load-previous-notifications"
          disabled
          className="flex items-center gap-2 text-sm font-medium text-gray-400 cursor-not-allowed py-2 opacity-60"
        >
          <ChevronDown className="w-4 h-4" />
          No More Notifications
        </button>
      </div>


      {/* General Notice Modal */}
      {selectedNotice && (
        <NoticeModal
          notification={selectedNotice}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </div>
  );
}
