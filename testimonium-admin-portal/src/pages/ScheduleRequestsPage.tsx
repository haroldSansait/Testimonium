import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Filter, X, Check, Calendar, Clock, User, Phone, FileText, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ScheduleRequestTable } from '@/components/schedule-requests/ScheduleRequestTable';
import { getScheduleRequests, updateScheduleStatus } from '@/services/scheduleRequestService';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import { cn } from '@/utils/cn';
import type { ScheduleFilter } from '@/services/scheduleRequestService';

const FILTER_TABS: { label: string; value: ScheduleFilter }[] = [
  { label: 'All Requests', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Upcoming', value: 'upcoming' },
];

// ─── Details Modal ────────────────────────────────────────────────────────────

interface DetailsModalProps {
  request: ScheduleRequest;
  onClose: () => void;
  onStatusChange: (status: ScheduleStatus) => Promise<void>;
}

function ScheduleRequestDetailsModal({ request, onClose, onStatusChange }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAction = async (status: ScheduleStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(status);
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const allowsActions = request.status === 'Pending' || request.status === 'Under Review' || request.status === 'Tentative';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-[#7B1C2A] text-white">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 opacity-90" />
            <div>
              <h2 className="text-base font-bold tracking-wide">Schedule Details</h2>
              <p className="text-[10px] text-white/80 uppercase tracking-widest mt-0.5">{request.referenceNo}</p>
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
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requestor</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <User className="w-4 h-4 text-gray-400" />
                {request.parishionerName}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Event Type</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <FileText className="w-4 h-4 text-gray-400" />
                {request.eventType}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested Date</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <Calendar className="w-4 h-4 text-gray-400" />
                {request.preferredDate}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preferred Time</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <Clock className="w-4 h-4 text-gray-400" />
                {request.preferredTime}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Priest</span>
              <p className="text-gray-800 mt-1 font-medium">{request.assignedPriest || 'TBD'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parish Location</span>
              <p className="text-gray-800 mt-1 font-medium">{request.parish || 'St. Joseph the Worker Parish'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Information</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="truncate max-w-[180px]">{request.contactInfo || 'Not Provided'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
              <p className="mt-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold border",
                  request.status === 'Confirmed' && "bg-green-50 text-green-700 border-green-200",
                  (request.status === 'Pending' || request.status === 'Under Review') && "bg-amber-50 text-amber-700 border-amber-200",
                  request.status === 'Tentative' && "bg-purple-50 text-purple-700 border-purple-200",
                  request.status === 'Cancelled' && "bg-red-50 text-red-700 border-red-200"
                )}>
                  {request.status}
                </span>
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Request Notes</span>
            <p className="text-gray-600 mt-1 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs">
              {request.notes || 'No request notes provided.'}
            </p>
          </div>

          {/* Timeline */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Timeline / History</span>
            <div className="relative border-l-2 border-gray-100 pl-4 ml-2 space-y-4">
              {(request.timeline || [
                { status: 'Pending', date: request.preferredDate, note: 'Schedule request submitted.' }
              ]).map((t, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-crimson-700 border-2 border-white ring-4 ring-gray-50" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{t.status}</span>
                    <span>{t.date}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {allowsActions && (
              <>
                <button
                  onClick={() => void handleAction('Confirmed')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => void handleAction('Tentative')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Request Reschedule
                </button>
                <button
                  onClick={() => void handleAction('Cancelled')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-700 text-white rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4">
      <Check className="w-4 h-4" />
      {message}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleRequestsPage() {
  const location = useLocation();
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('all');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<ScheduleRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async () => {
    const result = await getScheduleRequests({ filter: activeFilter, page, pageSize: PAGE_SIZE });
    setRequests(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [activeFilter, page]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Listen to router state (e.g. from Notifications about schedule conflict)
  useEffect(() => {
    if (location.state?.highlightConflict && requests.length > 0) {
      // Auto open the tentative conflict request
      const conflictReq = requests.find(r => r.status === 'Tentative' || r.id === 'sched-req-3');
      if (conflictReq) {
        setSelectedRequest(conflictReq);
      }
    }
  }, [location.state, requests]);

  const handleFilter = (f: ScheduleFilter) => {
    setActiveFilter(f);
    setPage(1);
  };

  const handleStatusUpdate = async (status: ScheduleStatus) => {
    if (!selectedRequest) return;
    try {
      await updateScheduleStatus(selectedRequest.id, status);
      setToastMessage(`Schedule request status updated to ${status}.`);
      void fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* Header with tab filters */}
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title="Schedule Requests"
          subtitle="Manage incoming scheduling applications for parish events."
          className="mb-0"
        />
        {/* Tab filters */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 flex-shrink-0 ml-4">
          <Filter className="w-4 h-4 text-gray-400 mx-1" />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              id={`schedule-filter-${tab.value}`}
              onClick={() => handleFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
                activeFilter === tab.value
                  ? 'bg-crimson-700 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <ScheduleRequestTable
          requests={requests}
          onViewDetails={setSelectedRequest}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <ScheduleRequestDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusChange={handleStatusUpdate}
        />
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
