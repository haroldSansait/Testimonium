import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock, X, Loader2 } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { getAvailableSlots, emergencyReschedule } from '@/services/scheduleRequestService';
import { getManilaTodayDateString, isBeforeManilaToday } from '@/utils/date';
import { resolveEventType } from '@/shared/EventTypeCatalog';
import type { ScheduleRequest } from '@/types';

interface EmergencyRescheduleModalProps {
  request: ScheduleRequest;
  onClose: () => void;
  onSuccess: (updated: ScheduleRequest) => void;
}

export function EmergencyRescheduleModal({ request, onClose, onSuccess }: EmergencyRescheduleModalProps) {
  const [targetDate, setTargetDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [reason, setReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const minDate = getManilaTodayDateString();
  const slotRequestGen = useRef(0);

  // Load available slots dynamically when targetDate changes
  useEffect(() => {
    if (!targetDate || isBeforeManilaToday(targetDate)) {
      setAvailableSlots([]);
      setTimeSlot('');
      setSlotError(null);
      return;
    }

    const gen = ++slotRequestGen.current;
    setLoadingSlots(true);
    setSlotError(null);
    setAvailableSlots([]);
    setTimeSlot('');

    const rawEventType =
      request.rawEventType ||
      resolveEventType(request.appointmentTitle || request.eventType || '') ||
      'BAPTISM';

    getAvailableSlots(request.parishId || '1', targetDate, rawEventType)
      .then((slots) => {
        if (gen !== slotRequestGen.current) return;
        setAvailableSlots(slots);
        setLoadingSlots(false);
      })
      .catch((err) => {
        if (gen !== slotRequestGen.current) return;
        console.error('Failed to fetch available slots:', err);
        setSlotError('Failed to load available slots for this date.');
        setLoadingSlots(false);
      });
  }, [targetDate, request.parishId, request.rawEventType, request.appointmentTitle, request.eventType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (!targetDate) {
      setErrorMessage('Please select a target date.');
      return;
    }
    if (isBeforeManilaToday(targetDate)) {
      setErrorMessage('Target date cannot be in the past.');
      return;
    }
    if (!timeSlot) {
      setErrorMessage('Please select an authoritative time slot.');
      return;
    }
    if (trimmedReason.length < 5) {
      setErrorMessage('Emergency reschedule reason must be at least 5 characters.');
      return;
    }
    if (trimmedReason.length > 1000) {
      setErrorMessage('Emergency reschedule reason cannot exceed 1000 characters.');
      return;
    }

    if (typeof request.version !== 'number') {
      setErrorMessage('This schedule is missing concurrency metadata. Close, refresh, and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await emergencyReschedule(request.id, {
        targetDate,
        timeSlot,
        reason: trimmedReason,
        expectedVersion: request.version,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Emergency reschedule failed:', err);
      const code = err?.response?.data?.code || err?.code;
      const serverMsg = err?.response?.data?.message || err?.message;

      if (code === 'SCHEDULE_CONCURRENCY_CONFLICT' || err?.response?.status === 409 && code?.includes('CONCURRENCY')) {
        setErrorMessage('Schedule was modified concurrently by another user. Please close and refresh.');
      } else if (code === 'CAPACITY_EXCEEDED') {
        setErrorMessage('The selected slot or parish capacity has been reached. Please choose another slot or date.');
      } else if (code === 'PRIEST_CONFLICT') {
        setErrorMessage(serverMsg || 'The retained priest has a scheduling conflict at the selected time.');
      } else if (code === 'INVALID_STATUS') {
        setErrorMessage('Only CONFIRMED schedules can be emergency-rescheduled.');
      } else if (err?.response?.status === 403 || code === 'FORBIDDEN') {
        setErrorMessage('You do not have permission to emergency-reschedule this appointment.');
      } else {
        setErrorMessage(serverMsg || 'An error occurred while executing the emergency reschedule.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-white flex-shrink-0" />
            <div>
              <h3 className="font-bold text-base text-white">Emergency Reschedule</h3>
              <p className="text-xs text-amber-100">
                Reschedule confirmed appointment #{request.referenceNo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-amber-600 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Event:</span>
              <span className="font-semibold text-gray-800">{request.appointmentTitle || request.eventType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current Schedule:</span>
              <span className="font-semibold text-gray-800">{request.preferredDate} ({request.preferredTime})</span>
            </div>
            {request.assignedPriest && (
              <div className="flex justify-between">
                <span className="text-gray-500">Retained Priest:</span>
                <span className="font-semibold text-gray-800">{request.assignedPriest}</span>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date & Slot selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Target Date <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={minDate}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Available Time Slot <span className="text-rose-600">*</span>
              </label>
              {loadingSlots ? (
                <div className="h-10 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-500 gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  Loading slots...
                </div>
              ) : slotError ? (
                <div className="h-10 flex items-center px-3 border border-rose-200 rounded-lg bg-rose-50 text-xs text-rose-700">
                  {slotError}
                </div>
              ) : (
                <CustomSelect
                  value={timeSlot}
                  onChange={setTimeSlot}
                  options={availableSlots.map((slot) => ({ value: slot, label: slot }))}
                  disabled={!targetDate || isSubmitting || availableSlots.length === 0}
                  placeholder={targetDate ? (availableSlots.length === 0 ? 'No slots available' : 'Select Time Slot…') : 'Pick a date first'}
                />
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
              Emergency Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="State the emergency reason (e.g., parish crisis, priest urgent relocation, facility maintenance)..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              minLength={5}
              maxLength={1000}
              required
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Minimum 5 characters</span>
              <span>{reason.length}/1000</span>
            </div>
          </div>

          {/* Warning notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              This is an administrative emergency action. Prior state will be saved to history, the schedule will remain Confirmed on the new date/slot, and notifications will be dispatched to both the parishioner and priest.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetDate || !timeSlot || reason.trim().length < 5}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Executing...
                </>
              ) : (
                'Confirm Emergency Reschedule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
