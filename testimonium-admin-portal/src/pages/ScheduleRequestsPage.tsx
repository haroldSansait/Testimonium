import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Filter, X, Check, Calendar, Clock, User, FileText, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ScheduleRequestTable } from '@/components/schedule-requests/ScheduleRequestTable';
import { getScheduleRequests, updateScheduleStatus, proposeReschedule, assignPriest } from '@/services/scheduleRequestService';
import { UserManagementService } from '@/services/UserManagementService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import { cn } from '@/utils/cn';
import type { ScheduleFilter } from '@/services/scheduleRequestService';

const FILTER_TABS: { label: string; value: ScheduleFilter }[] = [
  { label: 'All Requests', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Upcoming', value: 'upcoming' },
];

// ─── Details Modal ────────────────────────────────────────────────────────────

import { getPriestColor } from '@/utils/priestColors';

interface DetailsModalProps {
  request: ScheduleRequest;
  onClose: () => void;
  onStatusChange: (status: ScheduleStatus) => Promise<void>;
  onProposeReschedule: (payload: { proposedDate: string; proposedStartDatetime: string; reason: string }) => Promise<void>;
  onAssignPriest: (priestId: string) => Promise<void>;
}

function ScheduleRequestDetailsModal({ request, onClose, onStatusChange, onProposeReschedule, onAssignPriest }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [priests, setPriests] = useState<any[]>([]);
  const [selectedPriestId, setSelectedPriestId] = useState('');
  const [loadingPriests, setLoadingPriests] = useState(false);
  const [priestValidationError, setPriestValidationError] = useState(false);

  useEffect(() => {
    const fetchPriests = async () => {
      setLoadingPriests(true);
      try {
        const list = await UserManagementService.getUsers({
          role: 'PRIEST',
          parishId: request.parishId || undefined
        });
        setPriests(list);
        const match = list.find((u: any) => u.name === request.assignedPriest);
        if (match) {
          setSelectedPriestId(match.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPriests(false);
      }
    };
    void fetchPriests();
  }, [request.parishId, request.assignedPriest]);

  const handleAction = async (status: ScheduleStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(status);
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPriestId) {
      setPriestValidationError(true);
      return;
    }
    setPriestValidationError(false);
    setIsUpdating(true);
    try {
      await onAssignPriest(selectedPriestId);
      await onStatusChange('Confirmed');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProposeReschedule = async () => {
    setIsUpdating(true);
    try {
      let timeOffset = '09:00:00';
      if (proposedTime === '10:30 AM') timeOffset = '10:30:00';
      else if (proposedTime === '01:30 PM') timeOffset = '13:30:00';
      else if (proposedTime === '03:00 PM') timeOffset = '15:00:00';

      const payload = {
        proposedDate,
        proposedStartDatetime: `${proposedDate}T${timeOffset}`,
        reason: rescheduleReason
      };
      await onProposeReschedule(payload);
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const priestColor = getPriestColor(request.assignedPriest || 'TBD');
  const allowsActions = request.status === 'Pending' || request.status === 'Under Review' || request.status === 'Tentative';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Reschedule Proposal Sub-Modal */}
        {showRescheduleModal && (
          <div className="absolute inset-0 bg-white z-20 p-6 flex flex-col justify-between animate-in fade-in duration-150">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900">Propose Alternative Date</h3>
                <button onClick={() => setShowRescheduleModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Propose an alternative slot when the requested schedule conflicts with parish office hours or priest commitments.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Proposed Date</label>
                  <input
                    type="date"
                    value={proposedDate}
                    onChange={e => setProposedDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#7B1C2A]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Proposed Time</label>
                  <select
                    value={proposedTime}
                    onChange={e => setProposedTime(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#7B1C2A] bg-white"
                  >
                    <option value="">Select Time Slot...</option>
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="01:30 PM">01:30 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Reason for Reschedule</label>
                <textarea
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="Explain reason for alternative proposal..."
                  rows={3}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#7B1C2A]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleProposeReschedule()}
                disabled={isUpdating || !proposedDate || !proposedTime}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40"
              >
                Send Proposal to Parishioner
              </button>
            </div>
          </div>
        )}

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
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex items-center gap-2 text-gray-800 font-medium">
                  <FileText className="w-4 h-4 text-gray-400" />
                  {request.appointmentTitle || request.eventType}
                </div>
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

          {/* Priest Assignment Selector */}
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Priest Assignment</span>
            <div className="flex items-center gap-3">
              <select
                value={selectedPriestId}
                onChange={e => setSelectedPriestId(e.target.value)}
                disabled={loadingPriests}
                className="flex-1 p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none bg-white"
              >
                <option value="">{loadingPriests ? 'Loading Priests...' : 'Select Priest (Primary / Assistant)...'}</option>
                {priests.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role === 'PRIEST' ? 'Parish Priest' : 'Assistant Priest'})</option>
                ))}
              </select>
              {request.assignedPriest && (
                <span className={cn('px-2.5 py-1 text-[10px] font-bold rounded-full border', priestColor.bg, priestColor.text, priestColor.border)}>
                  {priestColor.badgeText}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parish Location</span>
              <p className="text-gray-800 mt-1 font-medium">{request.parish || 'St. Joseph the Worker Parish'}</p>
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
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-3 bg-gray-50 flex-shrink-0">
          {/* Inline priest assignment validation banner */}
          {priestValidationError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              A priest must be assigned before this request can be approved. Please select one from the dropdown above.
            </div>
          )}
          <div className="flex items-center gap-2">
            {allowsActions && (
              <>
                <button
                  onClick={() => void handleApprove()}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Approve &amp; Assign
                </button>
                <button
                  onClick={() => setShowRescheduleModal(true)}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Propose Reschedule
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
    </div>,
    document.body
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const result = await getScheduleRequests({ filter: activeFilter, page, pageSize: PAGE_SIZE });
      setRequests(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      console.error('Failed to load schedule requests:', err);
      if (!silent) {
        setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [activeFilter, page]);

  useEffect(() => {
    void fetchRequests(false);
  }, [fetchRequests]);

  // Set up auto-refresh polling (every 60 seconds), paused when loading, or when a request details modal is active
  useAutoRefresh(
    () => void fetchRequests(true),
    { intervalMs: 60000, enabled: !isLoading && !selectedRequest }
  );

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
      void fetchRequests(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProposeReschedule = async (payload: { proposedDate: string; proposedStartDatetime: string; reason: string }) => {
    if (!selectedRequest) return;
    try {
      await proposeReschedule(selectedRequest.id, payload);
      setToastMessage('Reschedule proposal sent successfully.');
      void fetchRequests(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignPriest = async (priestId: string) => {
    if (!selectedRequest) return;
    try {
      await assignPriest(selectedRequest.id, priestId);
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
        {isLoading ? (
          <LoadingState message="Loading schedule requests..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchRequests(false)} />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <ScheduleRequestDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusChange={handleStatusUpdate}
          onProposeReschedule={handleProposeReschedule}
          onAssignPriest={handleAssignPriest}
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
