import {
  FileText,
  CreditCard,
  Calendar,
  UserCheck,
  AlertTriangle,
  Bell,
  ChevronRight,
} from 'lucide-react';
import type { Notification } from '@/types';
import { cn } from '@/utils/cn';
import {
  getNotificationDestination,
  getNotificationPresentation,
  type NotificationVisualCategory,
} from '@/utils/notificationNavigation';

interface NotificationCardProps {
  notification: Notification;
  onOpen?: (notification: Notification) => void;
}

const categoryIcons: Record<NotificationVisualCategory, typeof Bell> = {
  document: FileText,
  payment: CreditCard,
  schedule: Calendar,
  pastoral: UserCheck,
  warning: AlertTriangle,
  system: Bell,
};

const unreadIconStyles: Record<NotificationVisualCategory, string> = {
  document: 'bg-crimson-50 text-crimson-700 border-crimson-200/80',
  payment: 'bg-amber-50 text-amber-700 border-amber-200/80',
  schedule: 'bg-sky-50 text-sky-700 border-sky-200/80',
  pastoral: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  warning: 'bg-red-50 text-red-700 border-red-200/80',
  system: 'bg-stone-100 text-stone-700 border-stone-200',
};

const pillToneStyles: Record<'crimson' | 'amber' | 'emerald' | 'slate', { unread: string; read: string }> = {
  crimson: {
    unread: 'bg-crimson-50 text-crimson-800 border-crimson-200',
    read: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  amber: {
    unread: 'bg-amber-50 text-amber-800 border-amber-200',
    read: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  emerald: {
    unread: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    read: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  slate: {
    unread: 'bg-stone-100 text-stone-700 border-stone-200',
    read: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

export function NotificationCard({ notification, onOpen }: NotificationCardProps) {
  const destination = getNotificationDestination(notification);
  const isClickable = destination !== null && Boolean(onOpen);
  const { category, categoryLabel, statusPill } = getNotificationPresentation(notification);
  const Icon = categoryIcons[category];
  const isUnread = !notification.isRead;

  const containerClasses = cn(
    'w-full rounded-xl px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-150',
    isUnread
      ? 'bg-white border border-crimson-200/80 shadow-card'
      : 'bg-[#FAF8F7] border border-gray-200/90',
    isClickable &&
      (isUnread
        ? 'group cursor-pointer text-left hover:border-crimson-300 hover:bg-crimson-50/25 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-700/40 focus-visible:ring-offset-2'
        : 'group cursor-pointer text-left hover:bg-white hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-700/40 focus-visible:ring-offset-2')
  );

  const cardInner = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-5">
      {/* Left: Semantic icon + message hierarchy */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="relative flex-shrink-0 mt-0.5">
          <div
            className={cn(
              'w-10 h-10 rounded-xl border flex items-center justify-center transition-colors',
              isUnread
                ? unreadIconStyles[category]
                : 'bg-gray-100 text-gray-400 border-gray-200/80'
            )}
          >
            <Icon className="w-[18px] h-[18px]" />
          </div>
          {isUnread && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-crimson-700 ring-2 ring-white"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Meta row: Category, Status Pill, Unread/Read badge */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                isUnread ? 'text-gray-600' : 'text-gray-400'
              )}
            >
              {categoryLabel}
            </span>

            {statusPill && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tracking-wide',
                  isUnread
                    ? pillToneStyles[statusPill.tone].unread
                    : pillToneStyles[statusPill.tone].read
                )}
              >
                {statusPill.label}
              </span>
            )}
          </div>

          {/* Notification Title */}
          <h4
            className={cn(
              'text-sm sm:text-[15px] leading-snug',
              isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
            )}
          >
            {notification.title}
          </h4>

          {/* Notification Description */}
          <p
            className={cn(
              'text-xs sm:text-[13px] mt-0.5 leading-relaxed',
              isUnread ? 'text-gray-700' : 'text-gray-500'
            )}
          >
            {notification.description}
          </p>
        </div>
      </div>

      {/* Right: Timestamp & clear interactive vs static indicator */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 flex-shrink-0 pl-[54px] sm:pl-0">
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            isUnread ? 'font-medium text-gray-700' : 'text-gray-400'
          )}
        >
          {notification.timestamp}
        </span>

        {destination ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors',
              isUnread
                ? 'text-crimson-700 group-hover:text-crimson-800'
                : 'text-gray-500 group-hover:text-crimson-700'
            )}
          >
            {destination.actionLabel}
            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap">
            {isUnread ? 'Notice' : 'Read'}
          </span>
        )}
      </div>
    </div>
  );

  if (isClickable && destination) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(notification)}
        data-notification-id={notification.id}
        data-notification-interactive="true"
        aria-label={`${notification.title}. ${destination.actionLabel}`}
        className={containerClasses}
      >
        {cardInner}
      </button>
    );
  }

  return (
    <article
      data-notification-id={notification.id}
      data-notification-interactive="false"
      className={containerClasses}
    >
      {cardInner}
    </article>
  );
}
