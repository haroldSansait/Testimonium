import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Loader, Clock } from 'lucide-react';
import type { TodayScheduleItem } from '@/types';
import { cn } from '@/utils/cn';

interface ScheduleItemProps {
  item: TodayScheduleItem;
}

const statusConfig = {
  Confirmed: {
    label: 'Confirmed',
    classes: 'bg-green-50 text-green-700 border border-green-200',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  'In Progress': {
    label: 'In Progress',
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: <Loader className="w-3.5 h-3.5" />,
  },
  Pending: {
    label: 'Pending',
    classes: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function ScheduleItem({ item }: ScheduleItemProps) {
  const navigate = useNavigate();
  const config = statusConfig[item.status];
  return (
    <div
      onClick={() => navigate('/calendar', { state: { eventId: item.id } })}
      className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50/70 px-2 rounded-lg transition-colors"
    >
      {/* Time */}
      <div className="text-center w-14 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900">{item.time}</p>
        <p className="text-xs text-gray-400">{item.period}</p>
      </div>
      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {item.location} • {item.priest}
        </p>
      </div>
      {/* Status */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0',
          config.classes
        )}
      >
        {config.icon}
        {config.label}
      </span>
    </div>
  );
}

interface TodayScheduleListProps {
  items: TodayScheduleItem[];
}

export function TodayScheduleList({ items }: TodayScheduleListProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h3 className="font-semibold text-gray-900 text-base">Today's Schedule</h3>
        <Link
          to="/calendar"
          className="text-sm font-medium text-crimson-700 hover:text-crimson-800 flex items-center gap-1 transition-colors"
        >
          View Calendar <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="px-5 pb-3">
        {items.map((item) => (
          <ScheduleItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
