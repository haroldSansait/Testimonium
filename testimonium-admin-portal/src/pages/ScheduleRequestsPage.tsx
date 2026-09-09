import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Filter, X, Check, Calendar, Clock, User, FileText, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ScheduleRequestTable } from '@/components/schedule-requests/ScheduleRequestTable';
import { getScheduleRequests, updateScheduleStatus, proposeReschedule, assignPriest, getAvailableSlots, getPriestAvailability } from '@/services/scheduleRequestService';
import { UserManagementService } from '@/services/UserManagementService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import { cn } from '@/utils/cn';
import { resolveEventType } from '@/shared/EventTypeCatalog';
import type { ScheduleFilter } from '@/services/scheduleRequestService';
import { EmergencyRescheduleModal } from '@/components/schedule-requests/EmergencyRescheduleModal';

const FILTER_TABS: { label: string; value: ScheduleFilter }[] = [
  { label: 'All Requests', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Upcoming', value: 'upcoming' },
];

// ─── Details Modal ────────────────────────────────────────────────────────────

import { getManilaTodayDateString, isBeforeManilaToday } from '@/utils/date';

interface DetailsModalProps {
  request: ScheduleRequest;
  onClose: () => void;
  onStatusChange: (status: ScheduleStatus) => Promise<void>;
  onProposeReschedule: (payload: { proposedDate: string; proposedStartDatetime: string; reason: string }) => Promise<void>;
  onAssignPriest: (priestId: string, priestName: string) => Promise<void>;
  onEmergencyRescheduleSuccess?: (updated: ScheduleRequest) => void;
}

function ScheduleRequestDetailsModal({ request, onClose, onStatusChange, onProposeReschedule, onAssignPriest, onEmergencyRescheduleSuccess }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showEmergencyRescheduleModal, setShowEmergencyRescheduleModal] = useState(false);
  const [confirmPriestModal, setConfirmPriestModal] = useState<{ priestId: string; priestName: string } | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [priests, setPriests] = useState<any[]>([]);
  const [selectedPriestId, setSelectedPriestId] = useState('');
  const [loadingPriests, setLoadingPriests] = useState(false);
  const [priestValidationError, setPriestValidationError] = useState(false);
  // Dynamic slot state — replaces hardcoded 4-option list
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotLoadError, setSlotLoadError] = useState(false);
  // Request generation counter to discard stale slot responses (race protection)
  const slotRequestGen = useRef(0);

  // Priest availability states
  const [priestAvailability, setPriestAvailability] = useState<Record<string, boolean | null>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const availabilityRequestGen = useRef(0);

  const minDate = getManilaTodayDateString();

  const fetchAvailability = useCallback(async () => {
    if (!request.id) return;
    const gen = ++availabilityRequestGen.current;
    setLoadingAvailability(true);
    setAvailabilityError(false);
    try {
      const availabilities = await getPriestAvailability(String(request.id));
      if (gen !== availabilityRequestGen.current) return;
      const map: Record<string, boolean | null> = {};
      for (const item of availabilities) {
        map[String(item.priestId)] = item.available;
      }
      setPriestAvailability(map);
    } catch (err) {
      if (gen !== availabilityRequestGen.current) return;
      console.error('Failed to load priest availability:', err);
      setAvailabilityError(true);
      // Fail conservatively: do not assume priests are available
      setPriestAvailability({});
    } finally {
      if (gen === availabilityRequestGen.current) {
        setLoadingAvailability(false);
      }
    }
  }, [request.id]);

  useEffect(() => {
    void fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    const fetchPriests = async () => {
      setLoadingPriests(true);
      try {
        const list = await UserManagementService.getUsers({
          role: 'PRIEST',
          parishId: request.parishId || undefined
        });
        setPriests(list);
        if (request.assignedPriestId) {
          setSelectedPriestId(String(request.assignedPriestId));
        } else {
          setSelectedPriestId('');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPriests(false);
      }
    };
    void fetchPriests();
  }, [request.parishId, request.assignedPriestId]);

  // Fetch available slots from the canonical endpoint whenever proposedDate changes.
  // Race protection: increment a generation counter so an older request cannot
  // overwrite state set by a newer one.
  useEffect(() => {
    if (!proposedDate || isBeforeManilaToday(proposedDate)) {
      setAvailableSlots([]);
      setSlotLoadError(false);
      setProposedTime('');
      return;
    }
    const gen = ++slotRequestGen.current;
    setLoadingSlots(true);
    setSlotLoadError(false);
    setAvailableSlots([]);
    setProposedTime('');

    // Use the parish's backend eventType string for slot resolution.
    const rawEventType =
      request.rawEventType ||
      resolveEventType(request.appointmentTitle || request.eventType || '') ||
      'BAPTISM';

    getAvailableSlots(String(request.parishId), proposedDate, rawEventType)
      .then((slots) => {
        if (gen !== slotRequestGen.current) return; // stale response discarded
        setAvailableSlots(slots);
        setLoadingSlots(false);
      })
      .catch(() => {
        if (gen !== slotRequestGen.current) return;
        setSlotLoadError(true);
        setLoadingSlots(false);
      });
  }, [proposedDate, request.parishId, request.eventType, request.appointmentTitle, request.rawEventType]);

  const handleAction = async (status: ScheduleStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(status);
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriestSelectChange = (newPriestId: string) => {
    if (!newPriestId) {
      setSelectedPriestId('');
      return;
    }
    const priest = priests.find((p: any) => String(p.id) === String(newPriestId));
    const priestName = priest?.name || 'Selected Priest';
    setPriestValidationError(false);
    setConfirmPriestModal({ priestId: newPriestId, priestName });
  };

  const handleConfirmPriestAssignment = async () => {
    if (!confirmPriestModal) return;
    setIsUpdating(true);
    try {
      await onAssignPriest(confirmPriestModal.priestId, confirmPriestModal.priestName);
      setSelectedPriestId(confirmPriestModal.priestId);
      setConfirmPriestModal(null);
    } catch (err) {
      console.error(err);
      // Stale availability handling: refresh availability, mark priest unavailable, clear selected
      await fetchAvailability();
      setSelectedPriestId('');
      setConfirmPriestModal(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!request.assignedPriest || request.assignedPriest === 'TBD') {
      setPriestValidationError(true);
      return;
    }
    setIsUpdating(true);
    try {
      await onStatusChange('Confirmed');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProposeReschedule = async () => {
    if (!proposedDate || isBeforeManilaToday(proposedDate) || !proposedTime || loadingSlots) {
      return;
    }
    setIsUpdating(true);
    try {
      // Derive proposedStartDatetime from the canonical time slot string ("HH:MM AM/PM")
      // with explicit Asia/Manila (+08:00) offset.
      let proposedStartDatetime = `${proposedDate}T09:00:00+08:00`;
      const slotMatch = proposedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (slotMatch) {
        let h = parseInt(slotMatch[1], 10);
        const m = slotMatch[2];
        const period = slotMatch[3].toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        proposedStartDatetime = `${proposedDate}T${String(h).padStart(2, '0')}:${m}:00+08:00`;
      }

      const payload = {
        proposedDate,
        proposedStartDatetime,
        reason: rescheduleReason
      };
      await onProposeReschedule(payload);
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  const unavailablePriests = priests.filter(
    (p: any) => !loadingAvailability && !availabilityError && priestAvailability[String(p.id)] === false
  );
  const unverifiedPriests = priests.filter(
    (p: any) => !loadingAvailability && !availabilityError && priestAvailability[String(p.id)] === null
  );
  const allPriestsUnavailable =
    priests.length > 0 &&
    !loadingAvailability &&
    !availabilityError &&
    unavailablePriests.length === priests.length;

  const allowsActions = request.status === 'Pending' || request.status === 'Under Review' || request.status === 'Tentative';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Reschedule Proposal Sub-Modal */}
        {showRescheduleModal && (
          <div className="absolute inset-0 bg-white z-20 p-6 flex flex-col justify-between animate-in fade-in duration-150 rounded-2xl">
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
                    min={minDate}
                    value={proposedDate}
                    onChange={e => {
                      const val = e.target.value;
                      if (val && isBeforeManilaToday(val)) {
                        return;
                      }
                      setProposedDate(val);
                      setProposedTime('');
                    }}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#7B1C2A]"
                  />
                </div>
                <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Proposed Time</label>
                {loadingSlots ? (
                  <div className="w-full p-2.5 border border-gray-200 rounded-lg text-xs text-gray-400 bg-gray-50">
                    Loading available slots…
                  </div>
                ) : slotLoadError ? (
                  <div className="w-full p-2.5 border border-red-200 rounded-lg text-xs text-red-600 bg-red-50">
                    Could not load slots. Select another date.
                  </div>
                ) : availableSlots.length === 0 && proposedDate ? (
                  <div className="w-full p-2.5 border border-amber-200 rounded-lg text-xs text-amber-700 bg-amber-50">
                    No slots available for this date.
                  </div>
                ) : (
                  <CustomSelect
                    value={proposedTime}
                    onChange={setProposedTime}
                    options={availableSlots.map(slot => ({ value: slot, label: slot }))}
                    disabled={!proposedDate || loadingSlots || availableSlots.length === 0}
                    placeholder={proposedDate ? 'Select Time Slot…' : 'Select a date first'}
                  />
                )}
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
                disabled={isUpdating || !proposedDate || !proposedTime || loadingSlots || isBeforeManilaToday(proposedDate)}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40"
              >
                Send Proposal to Parishioner
              </button>
            </div>
          </div>
        )}

        {/* Priest Assignment Confirmation Sub-Modal */}
        {confirmPriestModal && (
          <div className="absolute inset-0 bg-white z-30 p-6 flex flex-col justify-between animate-in fade-in duration-150 rounded-2xl">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-crimson-700" />
                  <h3 className="text-base font-bold text-gray-900">Confirm Priest Assignment</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmPriestModal(null)}
                  disabled={isUpdating}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 text-xs">
                <p className="text-gray-700">
                  Assign <strong className="text-gray-900">{confirmPriestModal.priestName}</strong> to this schedule request?
                </p>
                <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-500 block text-[10px] uppercase">Reference No</span>
                    <span className="font-medium text-gray-800">{request.referenceNo}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500 block text-[10px] uppercase">Service</span>
                    <span className="font-medium text-gray-800">{request.appointmentTitle || request.eventType}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500 block text-[10px] uppercase">Date &amp; Time</span>
                    <span className="font-medium text-gray-800">{request.preferredDate} ({request.preferredTime})</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500 block text-[10px] uppercase">Requestor</span>
                    <span className="font-medium text-gray-800">{request.parishionerName}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p>
                  A notification will be dispatched to the priest&apos;s account. Confirmation will remain awaiting priest acceptance until the priest reviews and accepts the schedule.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmPriestModal(null)}
                disabled={isUpdating}
                className="px-4 py-2 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPriestAssignment()}
                disabled={isUpdating}
                className="px-4 py-2 text-xs font-semibold bg-crimson-700 hover:bg-crimson-800 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isUpdating ? 'Assigning...' : 'Confirm Assignment'}
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

          {/* Requested vs Assigned Priest Display */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50/70 border border-gray-100 rounded-xl">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Requested Priest</span>
              <div className="mt-1">
                {request.requestedPriest ? (
                  <div>
                    <div className="text-gray-900 font-medium flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{typeof request.requestedPriest === 'object' ? request.requestedPriest.name : request.requestedPriest}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal italic block">Preference only</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 italic">No preference requested</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Assigned Priest</span>
              <div className="mt-1">
                {request.assignedPriest ? (
                  <div>
                    <div className="text-gray-900 font-medium flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{request.assignedPriest}</span>
                    </div>
                    {request.priestResponseStatus && (
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                        request.priestResponseStatus === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : request.priestResponseStatus === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {request.priestResponseStatus}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 italic">Not yet assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Conservative Availability Error State */}
          {availabilityError && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Unable to verify priest availability right now. Please try again.</span>
              </div>
              <button
                type="button"
                onClick={() => void fetchAvailability()}
                className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Unverified Priest Availability Advisory */}
          {unverifiedPriests.length > 0 && !availabilityError && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Unable to verify availability for {unverifiedPriests.map((p: any) => p.name).join(', ')}. Selection disabled.</span>
              </div>
              <button
                type="button"
                onClick={() => void fetchAvailability()}
                className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* IMPORTANT! Section: All Priests Unavailable */}
          {allPriestsUnavailable && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase tracking-wider text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                IMPORTANT!
              </div>
              <p className="text-amber-900 leading-relaxed font-medium">
                No priests are available for this date and time.
                <br />
                Please propose a new schedule or reject the request.
              </p>
            </div>
          )}

          {/* IMPORTANT! Section: Some Priests Unavailable */}
          {unavailablePriests.length > 0 && !allPriestsUnavailable && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase tracking-wider text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                IMPORTANT!
              </div>
              <p className="text-gray-700">
                Some priests are unavailable for the selected date and time.
              </p>
              <div className="text-gray-800 font-medium">
                Unavailable for {request.preferredDate} at {request.preferredTime}:
                <ul className="mt-1 space-y-0.5 ml-1">
                  {unavailablePriests.map((p: any) => (
                    <li key={p.id} className="text-gray-700 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0" />
                      <span className="font-semibold text-gray-900">{p.name}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-amber-700 font-medium">Unavailable</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-gray-600 pt-0.5">
                Choose another available priest or propose a different schedule.
              </p>
            </div>
          )}

          {/* Priest Assignment Selector */}
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Priest Assignment</span>
            <CustomSelect
              value={selectedPriestId}
              onChange={handlePriestSelectChange}
              disabled={loadingPriests || loadingAvailability || availabilityError || isUpdating}
              loading={loadingPriests || loadingAvailability}
              placeholder={
                loadingPriests
                  ? 'Loading Priests...'
                  : loadingAvailability
                  ? 'Checking priest availability...'
                  : availabilityError
                  ? 'Unable to verify priest availability'
                  : 'Select Priest (Primary / Assistant)...'
              }
              options={priests.map((p: any) => {
                const isAvail = priestAvailability[String(p.id)];
                const isUnavailable = !loadingAvailability && !availabilityError && isAvail === false;
                const isUnverified = !loadingAvailability && !availabilityError && isAvail === null;
                return {
                  value: String(p.id),
                  label: p.name,
                  secondary: p.role === 'PRIEST' ? 'Parish Priest' : 'Assistant Priest',
                  badge: isUnavailable ? 'Unavailable' : isUnverified ? 'Unable to verify' : undefined,
                  disabled: isUnavailable || isUnverified,
                };
              })}
            />
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

          {/* Priest confirmation readiness indicator */}
          {allowsActions && (() => {
            const hasPriest = !!request.assignedPriest && request.assignedPriest !== 'TBD';
            const priestStatus = request.priestResponseStatus;
            if (!hasPriest) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                  Assign a priest before confirming this schedule.
                </div>
              );
            }
            if (priestStatus === 'REJECTED') {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                  The assigned priest has declined. Assign a different priest before confirming.
                </div>
              );
            }
            if (!priestStatus || priestStatus === 'PENDING') {
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                  Awaiting priest acceptance — confirmation will be available once they accept.
                </div>
              );
            }
            return null;
          })()}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {allowsActions && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={
                      isUpdating ||
                      !request.assignedPriest ||
                      request.assignedPriest === 'TBD' ||
                      request.priestResponseStatus !== 'ACCEPTED'
                    }
                    title={
                      !request.assignedPriest || request.assignedPriest === 'TBD'
                        ? 'Assign a priest first'
                        : request.priestResponseStatus !== 'ACCEPTED'
                        ? 'Waiting for priest to accept this assignment'
                        : 'Approve & Confirm Schedule'
                    }
                    className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition-colors shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve &amp; Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(true)}
                    disabled={isUpdating}
                    className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap transition-colors shadow-xs"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Propose Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction('Cancelled')}
                    disabled={isUpdating}
                    className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap transition-colors shadow-xs"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </>
              )}
              {request.status === 'Confirmed' && (
                <button
                  type="button"
                  onClick={() => setShowEmergencyRescheduleModal(true)}
                  disabled={isUpdating}
                  className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap transition-colors shadow-xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Emergency Reschedule
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 inline-flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors shadow-xs"
            >
              Close
            </button>
          </div>
        </div>

        {/* Emergency Reschedule Modal */}
        {showEmergencyRescheduleModal && (
          <EmergencyRescheduleModal
            request={request}
            onClose={() => setShowEmergencyRescheduleModal(false)}
            onSuccess={(updated) => {
              setShowEmergencyRescheduleModal(false);
              onEmergencyRescheduleSuccess?.(updated);
            }}
          />
        )}
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
  const [isMutating, setIsMutating] = useState(false);

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

  // Set up auto-refresh polling (every 60 seconds), paused when loading, modal active, or mutating
  useAutoRefresh(
    () => void fetchRequests(true),
    { intervalMs: 60000, enabled: !isLoading && !selectedRequest && !isMutating }
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
    if (typeof selectedRequest.version !== 'number') {
      setToastMessage('This schedule is missing concurrency metadata. Refresh and try again.');
      void fetchRequests(true);
      return;
    }
    setIsMutating(true);
    const originalRequest = { ...selectedRequest };
    const originalRequests = [...requests];

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status } : r));
    setSelectedRequest(prev => prev ? { ...prev, status } : null);

    try {
      await updateScheduleStatus(selectedRequest.id, status, selectedRequest.version);
      setToastMessage(`Schedule request status updated to ${status}.`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setRequests(originalRequests);
      setSelectedRequest(originalRequest);
      setToastMessage(`Error updating status: ${err.message || 'Failed.'}`);
    } finally {
      setIsMutating(false);
      void fetchRequests(true);
    }
  };

  const handleProposeReschedule = async (payload: { proposedDate: string; proposedStartDatetime: string; reason: string }) => {
    if (!selectedRequest) return;
    if (typeof selectedRequest.version !== 'number') {
      setToastMessage('This schedule is missing concurrency metadata. Refresh and try again.');
      void fetchRequests(true);
      return;
    }
    setIsMutating(true);
    const originalRequest = { ...selectedRequest };
    const originalRequests = [...requests];

    let timeStr = '09:00 AM';
    if (payload.proposedStartDatetime.includes('10:30:00')) timeStr = '10:30 AM';
    else if (payload.proposedStartDatetime.includes('13:30:00')) timeStr = '01:30 PM';
    else if (payload.proposedStartDatetime.includes('15:00:00')) timeStr = '03:00 PM';
    else {
      const match = payload.proposedStartDatetime.match(/T(\d{2}):(\d{2}):/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const period = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        timeStr = `${String(h).padStart(2, '0')}:${m} ${period}`;
      }
    }

    const preferredDate = new Date(payload.proposedDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { 
      ...r, 
      status: 'Tentative', 
      proposedDate: preferredDate, 
      proposedTime: timeStr, 
      rescheduleReason: payload.reason 
    } : r));
    setSelectedRequest(prev => prev ? { 
      ...prev, 
      status: 'Tentative', 
      proposedDate: preferredDate, 
      proposedTime: timeStr, 
      rescheduleReason: payload.reason 
    } : null);

    try {
      await proposeReschedule(selectedRequest.id, {
        ...payload,
        expectedVersion: selectedRequest.version,
      });
      setToastMessage('Reschedule proposal sent successfully.');
    } catch (err: any) {
      console.error('Failed to propose reschedule:', err);
      setRequests(originalRequests);
      setSelectedRequest(originalRequest);
      setToastMessage(`Error proposing reschedule: ${err.message || 'Failed.'}`);
    } finally {
      setIsMutating(false);
      void fetchRequests(true);
    }
  };

  const handleAssignPriest = async (priestId: string, priestName: string) => {
    if (!selectedRequest) return;
    if (typeof selectedRequest.version !== 'number') {
      setToastMessage('This schedule is missing concurrency metadata. Refresh and try again.');
      void fetchRequests(true);
      return;
    }
    setIsMutating(true);
    const originalRequest = { ...selectedRequest };
    const originalRequests = [...requests];

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? {
      ...r,
      assignedPriest: priestName,
      assignedPriestId: priestId,
      priestResponseStatus: 'PENDING'
    } : r));
    setSelectedRequest(prev => prev ? {
      ...prev,
      assignedPriest: priestName,
      assignedPriestId: priestId,
      priestResponseStatus: 'PENDING'
    } : null);

    try {
      await assignPriest(selectedRequest.id, priestId, selectedRequest.version);
      setToastMessage(`Priest ${priestName} assigned successfully. Notification dispatched.`);
    } catch (err: any) {
      console.error('Failed to assign priest:', err);
      setRequests(originalRequests);
      setSelectedRequest(originalRequest);
      const conflictMsg = err?.response?.data?.error || err?.message || 'Failed.';
      setToastMessage(`Error assigning priest: ${conflictMsg}`);
      throw err;
    } finally {
      setIsMutating(false);
      void fetchRequests(true);
    }
  };

  const handleEmergencyRescheduleSuccess = () => {
    setToastMessage('Appointment emergency rescheduled successfully.');
    setSelectedRequest(null);
    void fetchRequests(true);
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
          onEmergencyRescheduleSuccess={handleEmergencyRescheduleSuccess}
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
