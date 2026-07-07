import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, CheckCheck, ChevronDown, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationGroup } from '@/components/notifications/NotificationGroup';
import { NotificationService } from '@/services/NotificationService';
import type { Notification, NotificationGroup as GroupType } from '@/types';

const GROUPS: GroupType[] = ['TODAY', 'YESTERDAY', 'EARLIER'];

interface NoticeModalProps {
  notification: Notification;
  onClose: () => void;
}

function NoticeModal({ notification, onClose }: NoticeModalProps) {
  return (
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
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notification | null>(null);

  const fetchNotifs = () => {
    void NotificationService.getNotifications().then(setNotifs);
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

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
    fetchNotifs();

    // 2. Perform action based on notification type
    if (notif.type === 'baptism-request') {
      // Document request
      navigate('/document-requests', { state: { requestId: 'doc-1' } });
    } else if (notif.type === 'document-ready') {
      navigate('/document-requests', { state: { requestId: 'doc-3' } });
    } else if (notif.type === 'schedule-conflict') {
      // Schedule conflict
      navigate('/schedule-requests', { state: { highlightConflict: true } });
    } else if (notif.type === 'system-update') {
      // General Notice modal
      setSelectedNotice(notif);
    } else {
      // Fallback
      setSelectedNotice(notif);
    }
  };

  const grouped = (group: GroupType) => notifs.filter((n) => n.group === group);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on administrative alerts and requests."
        actions={
          <div className="flex items-center gap-2">
            <button
              id="notifications-filter"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filter
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
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

      {/* Grouped notifications */}
      <div className="space-y-2">
        {GROUPS.map((group) => (
          <NotificationGroup
            key={group}
            group={group}
            notifications={grouped(group)}
            onAction={handleNotificationAction}
          />
        ))}
      </div>

      {/* Load Previous */}
      <div className="flex justify-center mt-4">
        <button
          id="load-previous-notifications"
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-2"
        >
          <ChevronDown className="w-4 h-4" />
          Load Previous Notifications
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
