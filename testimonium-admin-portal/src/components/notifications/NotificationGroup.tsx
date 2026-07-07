import type { Notification, NotificationGroup as GroupType } from '@/types';
import { NotificationCard } from './NotificationCard';

interface NotificationGroupProps {
  group: GroupType;
  notifications: Notification[];
  onAction?: (notif: Notification) => void;
}

export function NotificationGroup({ group, notifications, onAction }: NotificationGroupProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">{group}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="space-y-3">
        {notifications.map((notif) => (
          <NotificationCard key={notif.id} notification={notif} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}
