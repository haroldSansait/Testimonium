import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ActivityLogTable } from '@/components/activity-log/ActivityLogTable';
import { ActivityLogFilters } from '@/components/activity-log/ActivityLogFilters';
import { ActivityLogService } from '@/services/ActivityLogService';
import type { ActivityLogEntry } from '@/types';
import { X, Clipboard, Clock, Layers, Archive, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

const PAGE_SIZE = 4;

const actionTypeOptions = [
  'All Actions',
  'Authentication',
  'Parish Management',
  'User Management',
  'Staff Assignment',
  'Document Management',
  'System',
  'Activity Logs',
];

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

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Affected Module</span>
            <div className="flex items-center gap-2 text-gray-700 mt-1.5">
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-xs text-gray-700">{affectedModule}</span>
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

type ConfirmType = 'none' | 'archive-selected' | 'archive-all' | 'restore-selected' | 'restore-all' | 'purge';

interface ConfirmModalProps {
  type: ConfirmType;
  selectedCount: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function ConfirmationModal({ type, selectedCount, onConfirm, onClose }: ConfirmModalProps) {
  const [typedConfirm, setTypedConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  if (type === 'none') return null;

  let title = '';
  let description = '';
  let requiresText = '';
  let confirmBtnText = 'Confirm';
  let isDanger = false;

  if (type === 'archive-selected') {
    title = 'Archive Selected Logs';
    description = `Archive ${selectedCount} selected activity logs? They will disappear from Recent Activity, but remain searchable under Archived status filters.`;
    confirmBtnText = 'Archive Logs';
  } else if (type === 'archive-all') {
    title = 'Archive All Active Logs';
    description = 'Are you sure you want to archive all active logs? Type "ARCHIVE" below to confirm this bulk archival operation.';
    requiresText = 'ARCHIVE';
    confirmBtnText = 'Archive All';
  } else if (type === 'restore-selected') {
    title = 'Restore Selected Logs';
    description = `Restore ${selectedCount} selected activity logs to active status?`;
    confirmBtnText = 'Restore Logs';
  } else if (type === 'restore-all') {
    title = 'Restore All Archived Logs';
    description = 'Restore all archived activity logs? they will return to the active log feed.';
    confirmBtnText = 'Restore All';
  } else if (type === 'purge') {
    title = 'Purge Archived Logs';
    description = 'Permanently delete archived activity logs older than the retention limit? This action is IRREVERSIBLE. Type "DELETE" below to confirm.';
    requiresText = 'DELETE';
    confirmBtnText = 'Purge Database';
    isDanger = true;
  }

  const isButtonDisabled = (requiresText && typedConfirm !== requiresText) || loading;

  const handleConfirmSubmit = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{description}</p>

          {requiresText && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Type <span className="font-mono text-gray-900">"{requiresText}"</span> to confirm
              </label>
              <input
                type="text"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder={requiresText}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirmSubmit()}
            disabled={!!isButtonDisabled}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-700/20'
                : 'bg-crimson-700 hover:bg-crimson-800 focus:ring-crimson-700/20'
            }`}
          >
            {loading ? 'Processing...' : confirmBtnText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActivityLogPage() {
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthName = now.toLocaleString('en-US', { month: 'short' });
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return `${monthName} 1, ${year} - ${monthName} ${lastDay}, ${year}`;
  });
  const [role, setRole] = useState('All Roles');
  const [actionType, setActionType] = useState('All Actions');
  const [status, setStatus] = useState<'All' | 'Active' | 'Archived'>('Active');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmType>('none');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ActivityLogService.getActivityLog({
        page,
        pageSize: PAGE_SIZE,
        role,
        actionType,
        dateRange,
        status,
      });
      setEntries(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setActiveCount(result.active ?? 0);
      setArchivedCount(result.archived ?? 0);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to fetch activity logs.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, role, actionType, dateRange, status]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  // Reset selected IDs when filter or page changes
  useEffect(() => {
    setSelectedIds([]);
  }, [page, role, actionType, dateRange, status]);

  const handleRole = (v: string) => { setRole(v); setPage(1); };
  const handleActionType = (v: string) => { setActionType(v); setPage(1); };
  const handleStatus = (v: 'All' | 'Active' | 'Archived') => { setStatus(v); setPage(1); };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const checkable = entries.filter((entry) => !entry.isSystem).map((entry) => entry.id);
      setSelectedIds(checkable);
    } else {
      setSelectedIds([]);
    }
  };

  const triggerConfirm = (type: ConfirmType) => {
    setConfirmModal(type);
  };

  const handleConfirmAction = async () => {
    try {
      if (confirmModal === 'archive-selected') {
        await ActivityLogService.archiveSelected(selectedIds);
        setMessage({ text: `Successfully archived ${selectedIds.length} activity logs.`, type: 'success' });
      } else if (confirmModal === 'archive-all') {
        await ActivityLogService.archiveAll();
        setMessage({ text: 'Successfully archived all active activity logs.', type: 'success' });
      } else if (confirmModal === 'restore-selected') {
        await ActivityLogService.restoreSelected(selectedIds);
        setMessage({ text: `Successfully restored ${selectedIds.length} activity logs.`, type: 'success' });
      } else if (confirmModal === 'restore-all') {
        await ActivityLogService.restoreAll();
        setMessage({ text: 'Successfully restored all archived activity logs.', type: 'success' });
      } else if (confirmModal === 'purge') {
        await ActivityLogService.purgeArchived();
        setMessage({ text: 'Successfully purged old archived logs from database.', type: 'success' });
      }
      setSelectedIds([]);
      void fetchLog();
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: err?.response?.data?.message || err?.message || 'Failed to complete transaction.',
        type: 'error',
      });
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Activity Log"
          subtitle="Comprehensive record of administrative actions, document verifications, and system updates."
        />
        
        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'Active' && (
            <>
              <button
                disabled={selectedIds.length === 0}
                onClick={() => triggerConfirm('archive-selected')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => triggerConfirm('archive-all')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive All Active
              </button>
            </>
          )}

          {status === 'Archived' && (
            <>
              <button
                disabled={selectedIds.length === 0}
                onClick={() => triggerConfirm('restore-selected')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => triggerConfirm('restore-all')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore All Archived
              </button>
              <button
                onClick={() => triggerConfirm('purge')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge Archived
              </button>
            </>
          )}

          {status === 'All' && selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => triggerConfirm('archive-selected')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => triggerConfirm('restore-selected')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border border-gray-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Selected ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Activity Logs</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-gray-900">{activeCount + archivedCount}</span>
            <span className="text-xs text-gray-400">records in database</span>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Logs</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
            <span className="text-xs text-gray-400">showing in recent feeds</span>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm border-l-4 border-l-gray-400">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Archived Logs</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-gray-600">{archivedCount}</span>
            <span className="text-xs text-gray-400">hidden from feeds</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ActivityLogFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        role={role}
        onRoleChange={handleRole}
        actionType={actionType}
        onActionTypeChange={handleActionType}
        actionTypeOptions={actionTypeOptions}
        status={status}
        onStatusChange={handleStatus}
      />

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-crimson-700 rounded-full animate-spin" />
          </div>
        )}

        <ActivityLogTable
          entries={entries}
          selectedIds={selectedIds}
          onSelectChange={handleSelect}
          onSelectAllChange={handleSelectAll}
          onRowClick={setSelectedEntry}
        />
        
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Feedback Toast Notification */}
      {message && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white ${
          message.type === 'success' ? 'bg-green-700' : 'bg-red-700'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <ActivityDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal !== 'none' && (
        <ConfirmationModal
          type={confirmModal}
          selectedCount={selectedIds.length}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmModal('none')}
        />
      )}
    </div>
  );
}
