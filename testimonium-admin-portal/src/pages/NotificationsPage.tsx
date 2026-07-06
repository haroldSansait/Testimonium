import { useState, useEffect } from 'react';
import { Filter, CheckCheck, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationGroup } from '@/components/notifications/NotificationGroup';
import { NotificationService } from '@/services/NotificationService';
import type { Notification, NotificationGroup as GroupType } from '@/types';

const GROUPS: GroupType[] = ['TODAY', 'YESTERDAY', 'EARLIER'];

export function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    void NotificationService.getNotifications().then(setNotifs);
  }, []);

  const markAllRead = () => {
    // Optimistic UI update
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    // Persist to backend
    void NotificationService.markAllRead();
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
    </div>
  );
}
