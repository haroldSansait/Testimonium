import type { ActivityLogEntry } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

interface ActivityLogTableProps {
  entries: ActivityLogEntry[];
  onRowClick?: (entry: ActivityLogEntry) => void;
}

export function ActivityLogTable({ entries, onRowClick }: ActivityLogTableProps) {
  if (entries.length === 0) {
    return <EmptyState title="No activity records" description="Try adjusting your filters." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="uppercase">Date &amp; Time</th>
            <th className="uppercase">Personnel Name</th>
            <th className="uppercase">Action Description</th>
            <th className="uppercase">Reference ID</th>
            <th className="uppercase">Status Update</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => onRowClick?.(entry)}
              className="cursor-pointer hover:bg-gray-50/50 transition-colors"
            >
              <td className="whitespace-pre text-gray-600 text-xs leading-relaxed">{entry.dateTime}</td>
              <td>
                <div className="flex items-center gap-2.5">
                  <Avatar
                    initials={entry.avatar.initials}
                    bgColor={entry.avatar.bgColor}
                    size="sm"
                  />
                  <span className="text-gray-700 font-medium text-sm">{entry.personnel}</span>
                </div>
              </td>
              <td className="text-gray-600">{entry.actionDescription}</td>
              <td className="text-gray-500 font-mono text-xs">{entry.referenceId}</td>
              <td>
                <StatusBadge status={entry.statusUpdate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
