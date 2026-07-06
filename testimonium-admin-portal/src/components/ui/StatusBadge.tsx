import { cn } from '@/utils/cn';
import type {
  DocumentStatus,
  ScheduleStatus,
  ActivityStatus,
  NotificationUrgency,
} from '@/types';

type StatusVariant = DocumentStatus | ScheduleStatus | ActivityStatus | NotificationUrgency;

const statusStyles: Record<string, string> = {
  // Document statuses
  'Pending Review': 'bg-amber-50 text-amber-700 border border-amber-200',
  Processing: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Ready for Pickup': 'bg-green-50 text-green-700 border border-green-200',
  Released: 'bg-gray-100 text-gray-500 border border-gray-200',
  Rejected: 'bg-red-50 text-red-600 border border-red-200',
  'Needs Correction': 'bg-orange-50 text-orange-600 border border-orange-200',

  // Schedule statuses
  Pending: 'bg-gray-100 text-gray-600 border border-gray-200',
  'Under Review': 'bg-amber-50 text-amber-700 border border-amber-200',
  Tentative: 'bg-pink-50 text-pink-600 border border-pink-200',
  Confirmed: 'bg-green-50 text-green-700 border border-green-200',
  Cancelled: 'bg-red-50 text-red-600 border border-red-200',

  // Activity log statuses
  Validated: 'bg-green-50 text-green-700 border border-green-200',
  Approved: 'bg-green-50 text-green-700 border border-green-200',

  // Notification urgency
  urgent: 'bg-red-50 text-red-600 border border-red-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  success: 'bg-green-50 text-green-700 border border-green-200',
};

const dotStyles: Record<string, string> = {
  'Pending Review': 'bg-amber-500',
  Processing: 'bg-blue-500',
  'Ready for Pickup': 'bg-green-500',
  Released: 'bg-gray-400',
  Rejected: 'bg-red-500',
  'Needs Correction': 'bg-orange-500',
  Pending: 'bg-gray-400',
  'Under Review': 'bg-amber-500',
  Tentative: 'bg-pink-500',
  Confirmed: 'bg-green-500',
  Cancelled: 'bg-red-500',
  Validated: 'bg-green-500',
  Approved: 'bg-green-500',
};

interface StatusBadgeProps {
  status: StatusVariant;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  const dot = dotStyles[status] ?? 'bg-gray-400';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        style,
        className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />}
      {status}
    </span>
  );
}
