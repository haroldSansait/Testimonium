import type { ScheduleRequest, EventType } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Baby,
  Heart,
  Music,
  Church,
  Home,
  MoreHorizontal,
} from 'lucide-react';

const eventTypeIcons: Record<EventType, React.ReactNode> = {
  Baptism: <Baby className="w-3.5 h-3.5" />,
  Wedding: <Heart className="w-3.5 h-3.5" />,
  'Venue Use': <Music className="w-3.5 h-3.5" />,
  'Mass Intention': <Church className="w-3.5 h-3.5" />,
  'House Blessing': <Home className="w-3.5 h-3.5" />,
  'Funeral Mass': <Church className="w-3.5 h-3.5" />,
  Confirmation: <Church className="w-3.5 h-3.5" />,
  Other: <MoreHorizontal className="w-3.5 h-3.5" />,
};

interface ScheduleRequestTableProps {
  requests: ScheduleRequest[];
  onViewDetails?: (req: ScheduleRequest) => void;
}

export function ScheduleRequestTable({ requests, onViewDetails }: ScheduleRequestTableProps) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No schedule requests"
        description="No requests match the current filter."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Parishioner Name</th>
            <th>Event Type</th>
            <th>Preferred Date &amp; Time</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td className="font-semibold text-gray-900 whitespace-nowrap">{req.referenceNo}</td>
              <td>
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={req.initials}
                    bgColor={req.avatarColor}
                    size="sm"
                  />
                  <span className="text-gray-700 text-sm">{req.parishionerName}</span>
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <span className="text-gray-400">{eventTypeIcons[req.eventType]}</span>
                    <span>{req.appointmentTitle || req.eventType}</span>
                  </div>
                  {req.appointmentTitle && req.appointmentTitle !== req.eventType && (
                    <span className="text-[11px] text-gray-500 font-normal" style={{ marginLeft: '1.375rem' }}>
                      {req.eventType}
                    </span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap text-gray-600">
                {req.preferredDate}
                <span className="mx-1.5 text-gray-300">•</span>
                {req.preferredTime}
              </td>
              <td>
                <StatusBadge status={req.status} showDot={false} />
              </td>
              <td>
                <button
                  onClick={() => onViewDetails?.(req)}
                  className="text-sm font-medium text-crimson-700 hover:text-crimson-800 hover:underline transition-colors"
                  id={`view-sched-${req.id}`}
                  aria-label={`View schedule ${req.referenceNo}`}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
