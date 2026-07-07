import type { Notification } from '@/types';
import { cn } from '@/utils/cn';
import {
  CalendarX2,
  Baby,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

const notifIcons: Record<string, React.ReactNode> = {
  'schedule-conflict': <CalendarX2 className="w-5 h-5" />,
  'baptism-request': <Baby className="w-5 h-5" />,
  'document-ready': <CheckCircle className="w-5 h-5" />,
  'system-update': <RefreshCw className="w-5 h-5" />,
  warning: <CalendarX2 className="w-5 h-5" />,
};

const iconBgStyles: Record<string, string> = {
  'schedule-conflict': 'bg-red-100 text-red-600',
  'baptism-request': 'bg-blue-100 text-blue-600',
  'document-ready': 'bg-green-100 text-green-600',
  'system-update': 'bg-gray-100 text-gray-600',
  warning: 'bg-red-100 text-red-600',
};

const urgencyTagStyles: Record<string, string> = {
  urgent: 'bg-red-50 text-red-600 border border-red-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  success: 'bg-green-50 text-green-700 border border-green-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
};

const urgencyLabels: Record<string, string> = {
  urgent: 'Urgent Action Required',
  pending: 'Pending Review',
  success: 'Ready for Pickup',
  info: 'System Info',
};

interface NotificationCardProps {
  notification: Notification;
  onAction?: (notif: Notification) => void;
}

export function NotificationCard({ notification, onAction }: NotificationCardProps) {
  const iconBg = iconBgStyles[notification.type] ?? 'bg-gray-100 text-gray-600';
  const icon = notifIcons[notification.type] ?? notifIcons['system-update'];

  const actionTag = notification.actions[0];
  const actionLink = notification.actions[1];

  return (
    <div
      className={cn(
        'flex gap-4 p-5 bg-white border border-gray-100 border-l-4 rounded-r-lg shadow-sm',
        notification.leftBorderColor,
        !notification.isRead && 'bg-gray-50/40'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 relative">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', iconBg)}>
          {icon}
        </div>
        {!notification.isRead && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h4 className="text-sm font-semibold text-gray-900">{notification.title}</h4>
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
            {notification.timestamp}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{notification.description}</p>
        {(actionTag || actionLink) && (
          <div className="flex items-center gap-3 mt-3">
            {actionTag && (
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                  urgencyTagStyles[notification.urgency] ?? urgencyTagStyles.info
                )}
              >
                {urgencyLabels[notification.urgency]}
              </span>
            )}
            {actionLink && (
              <button
                onClick={() => onAction?.(notification)}
                className="text-sm font-semibold text-gray-800 hover:text-crimson-700 transition-colors underline underline-offset-2 hover:no-underline"
              >
                {actionLink.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
