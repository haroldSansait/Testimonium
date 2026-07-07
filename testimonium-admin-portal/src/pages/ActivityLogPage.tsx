import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ActivityLogTable } from '@/components/activity-log/ActivityLogTable';
import { ActivityLogFilters } from '@/components/activity-log/ActivityLogFilters';
import { ActivityLogService } from '@/services/ActivityLogService';
import type { ActivityLogEntry } from '@/types';
import { X, Clipboard, Clock, Layers, CheckCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

const PAGE_SIZE = 4;

interface DetailModalProps {
  entry: ActivityLogEntry;
  onClose: () => void;
}

function ActivityDetailModal({ entry, onClose }: DetailModalProps) {
  const affectedModule = entry.referenceId.startsWith('REQ') || entry.referenceId.startsWith('DOC')
    ? 'Document Requests'
    : entry.referenceId.startsWith('SCH')
    ? 'Schedule Requests'
    : 'Parish/User Management';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-[#7B1C2A] text-white">
          <div className="flex items-center gap-3">
            <Clipboard className="w-5 h-5 opacity-90" />
            <div>
              <h2 className="text-base font-bold tracking-wide">Activity Details</h2>
              <p className="text-[10px] text-white/80 uppercase tracking-widest mt-0.5">Read-Only log entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Performed</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">{entry.actionDescription}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Performed By</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1.5">
                <Avatar initials={entry.avatar.initials} bgColor={entry.avatar.bgColor} size="sm" />
                <span className="font-semibold text-xs text-gray-800">{entry.personnel}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timestamp</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs text-gray-600">{entry.dateTime.replace('\n', ' ')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Affected Module</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1.5">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-xs text-gray-700">{affectedModule}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Update</span>
              <div className="flex items-center gap-2 mt-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-xs text-gray-800">{entry.statusUpdate}</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Related Record Reference</span>
            <p className="font-mono text-xs text-gray-600 mt-1 bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
              {entry.referenceId}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActivityLogPage() {
  const [dateRange, setDateRange] = useState('Oct 1, 2023 - Oct 31, 2023');
  const [personnel, setPersonnel] = useState('All Personnel');
  const [actionType, setActionType] = useState('All Actions');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);

  const fetchLog = useCallback(async () => {
    const result = await ActivityLogService.getActivityLog({
      page,
      pageSize: PAGE_SIZE,
      personnel,
      actionType,
      dateRange,
    });
    setEntries(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [page, personnel, actionType, dateRange]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  const handlePersonnel = (v: string) => { setPersonnel(v); setPage(1); };
  const handleActionType = (v: string) => { setActionType(v); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Comprehensive record of administrative actions, document verifications, and system updates."
      />

      <ActivityLogFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        personnel={personnel}
        onPersonnelChange={handlePersonnel}
        actionType={actionType}
        onActionTypeChange={handleActionType}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <ActivityLogTable entries={entries} onRowClick={setSelectedEntry} />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <ActivityDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
