import type { ActivityLogEntry } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';

interface ActivityLogTableProps {
  entries: ActivityLogEntry[];
  selectedIds: string[];
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAllChange: (checked: boolean) => void;
  onRowClick?: (entry: ActivityLogEntry) => void;
}

export function ActivityLogTable({
  entries,
  selectedIds,
  onSelectChange,
  onSelectAllChange,
  onRowClick,
}: ActivityLogTableProps) {
  if (entries.length === 0) {
    return <EmptyState title="No activity records" description="Try adjusting your filters." />;
  }

  // Filter out system logs when calculating checkable entries
  const checkableEntries = entries.filter((entry) => !entry.isSystem);
  const allChecked = checkableEntries.length > 0 && checkableEntries.every((entry) => selectedIds.includes(entry.id));
  const someChecked = checkableEntries.some((entry) => selectedIds.includes(entry.id));

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full">
        <thead>
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someChecked && !allChecked;
                  }
                }}
                onChange={(e) => onSelectAllChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-crimson-700 focus:ring-crimson-700/20 cursor-pointer"
              />
            </th>
            <th className="uppercase w-[180px]">Date &amp; Time</th>
            <th className="uppercase w-[180px]">User</th>
            <th className="uppercase w-[150px]">Role</th>
            <th className="uppercase">Action</th>
            <th className="uppercase w-[120px]">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isArchived = Boolean(entry.archivedAt);
            const isChecked = selectedIds.includes(entry.id);

            return (
              <tr
                key={entry.id}
                onClick={() => onRowClick?.(entry)}
                className={cn(
                  'cursor-pointer hover:bg-gray-50/50 transition-colors',
                  isArchived && 'opacity-65 bg-gray-50/20'
                )}
              >
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()} // Prevent row click when checking box
                >
                  {!entry.isSystem ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onSelectChange(entry.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-crimson-700 focus:ring-crimson-700/20 cursor-pointer"
                    />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 font-bold select-none cursor-default" title="Protected System Log">
                      🔒
                    </div>
                  )}
                </td>
                <td className="whitespace-pre text-gray-600 text-xs leading-relaxed">
                  {entry.dateTime}
                </td>
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
                <td className="text-gray-600 text-sm">
                  {entry.role || 'System'}
                </td>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-950 font-normal">{entry.actionDescription}</span>
                      {isArchived && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200 rounded tracking-wide">
                          Archived
                        </span>
                      )}
                    </div>
                    {isArchived && entry.archivedAt && (
                      <span className="text-[10px] text-gray-400 font-semibold tracking-wide">
                        Archived {new Date(entry.archivedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} by {entry.archivedByName || 'Coordinator'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-gray-500 font-mono text-xs">{entry.referenceId}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
