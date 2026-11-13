import type { Notification, NotificationGroup as GroupType } from '@/types';
import { NotificationCard } from './NotificationCard';

interface NotificationGroupProps {
  group: GroupType;
  notifications: Notification[];
  onOpen?: (notification: Notification) => void;
}

export function NotificationGroup({
  group,
  notifications,
  onOpen,
}: NotificationGroupProps) {
  if (notifications.length === 0) return null;

  return (
    <section className="mb-7 last:mb-0" aria-label={`${group} notifications`}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {group}
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-500">
          {notifications.length}
        </span>
        <div className="flex-1 h-px bg-gray-200/80" />
      </div>

      <div className="space-y-2.5">
        {notifications.map((notif) => (
          <NotificationCard
            key={notif.id}
            notification={notif}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
