import { useQuery } from '../../hooks/useService';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, XCircle,
  AlertCircle, Building, Loader2, User, AlertTriangle,
} from 'lucide-react';
import services from '../../providers/factory';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import ScheduleRescheduleHistory from '../../features/scheduler/components/ScheduleRescheduleHistory';
import { ScheduleAttachments } from '../../features/scheduler/components/ScheduleAttachments';
import { DatePickerCalendar } from '../../features/scheduler/components/DatePickerCalendar';

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked / Under Review',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled / Rejected',
  proposed: 'Reschedule Proposed',
};

const STATUS_STYLES: Record<string, string> = {
  booked: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-green-50 text-green-800 border-green-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
  proposed: 'bg-blue-50 text-blue-800 border-blue-200',
};

export const ScheduleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null);
  const [alternativeDate, setAlternativeDate] = useState('');
  const [alternativeSlot, setAlternativeSlot] = useState('');
  const [alternativeNote, setAlternativeNote] = useState('');
  const [alternativeSlots, setAlternativeSlots] = useState<string[]>([]);
  const [alternativeBusy, setAlternativeBusy] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const scheduleQuery = useQuery(() => services.scheduler.getAppointmentById(id!), ['schedules', 'detail', id], {
    enabled: Boolean(id), staleTime: 30_000, pollInterval: false,
  });
  const appointment = scheduleQuery.data;
  const loading = scheduleQuery.loading;
  const load = scheduleQuery.refetch;
  const code = (scheduleQuery.error as { status?: number; statusCode?: number })?.status
    ?? (scheduleQuery.error as { statusCode?: number })?.statusCode;
  const error = !scheduleQuery.error ? null : code === 404
    ? 'This schedule could not be found. It may have been removed or the link is invalid.'
    : code === 403 ? 'You do not have access to this schedule.'
    : 'Failed to load schedule details. Please check your connection and try again.';

  const fetchAvailableDates = useCallback(async () => {
    if (!appointment || !appointment.parishId || !appointment.rawEventType || !appointment.canProposeAlternativeDate) {
      setAvailableDates([]);
      return;
    }
    setLoadingDates(true);
    setDatesError(null);
    try {
      const res = await services.scheduler.getAvailabilityDates(String(appointment.parishId), appointment.rawEventType);
      setAvailableDates(res?.dates || []);
    } catch (err: any) {
      console.error('Failed to load available dates:', err);
      setDatesError(err?.message || 'Unable to load available dates. Please check your connection.');
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [appointment]);

  useEffect(() => {
    if (appointment?.layMinisterAssigned && appointment.canProposeAlternativeDate) {
      void fetchAvailableDates();
    }
  }, [appointment?.layMinisterAssigned, appointment?.canProposeAlternativeDate, fetchAvailableDates]);

  useEffect(() => {
    if (!appointment || !alternativeDate || !appointment.rawEventType) {
      setAlternativeSlots([]);
      setAlternativeSlot('');
      setSlotsError(null);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setSlotsError(null);
    services.scheduler.getAvailableSlots(appointment.parishId, alternativeDate, appointment.rawEventType)
      .then((slots) => {
        if (!active) return;
        setAlternativeSlots(slots);
        setAlternativeSlot((current) => slots.includes(current) ? current : '');
      })
      .catch((err: any) => {
        if (active) {
          console.error('Failed to load slots:', err);
          setSlotsError(err?.message || 'Unable to load time slots for this date.');
          setAlternativeSlots([]);
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [appointment, alternativeDate]);

  const handleRespond = async (accept: boolean) => {
    if (!appointment) return;
    if (typeof appointment.version !== 'number') {
      setResponseError('The schedule version is unavailable. Refreshing the latest details.');
      void load();
      return;
    }
    setResponding(true);
    setResponseError(null);
    setResponseSuccess(null);
    try {
      const updated = await services.scheduler.respondReschedule(appointment.id, accept, appointment.version);
      scheduleQuery.setData(updated);
      setResponseSuccess(
        accept
          ? 'You have accepted the proposed reschedule. Your appointment is now confirmed.'
          : 'You have declined the proposed reschedule. Please contact your parish for further assistance.',
      );
    } catch (err: any) {
      if (err?.code === 'PRIEST_ASSIGNMENT_REQUIRED' || err?.message?.includes('priest must be assigned')) {
        setResponseError('A priest must be assigned to this schedule before it can be confirmed. Please check back once the parish assigns a priest.');
      } else if (err?.code === 'PRIEST_ASSIGNMENT_PENDING' || err?.message?.includes('not yet accepted')) {
        setResponseError('The assigned priest has not yet accepted this schedule. Final confirmation will become available once the priest accepts.');
      } else {
        setResponseError(err?.message || 'Failed to submit your response. Please try again.');
      }
      void load();
    } finally {
      setResponding(false);
    }
  };

  const handleAlternativeSubmit = async () => {
    if (!appointment || !alternativeDate || !alternativeSlot) return;
    setAlternativeBusy(true);
    setResponseError(null);
    try {
      await services.scheduler.proposeAlternativeDate(
        appointment.id,
        alternativeDate,
        alternativeSlot,
        alternativeNote
      );
      setResponseSuccess('Your alternative-date request was submitted without changing the original appointment.');
      setAlternativeDate('');
      setAlternativeSlot('');
      setAlternativeNote('');
      await load();
    } catch (err: any) {
      setResponseError(err?.message || 'Unable to submit the alternative date.');
    } finally {
      setAlternativeBusy(false);
    }
  };

  const handleAlternativeWithdraw = async () => {
    const proposal = appointment?.alternativeProposal;
    if (!appointment || !proposal) return;
    setAlternativeBusy(true);
    try {
      await services.scheduler.withdrawAlternativeDate(
        appointment.id,
        proposal.id,
        proposal.nominationRevision
      );
      setResponseSuccess('Your alternative-date request was withdrawn. The original appointment remains unchanged.');
      await load();
    } catch (err: any) {
      setResponseError(err?.message || 'Unable to withdraw the alternative date.');
    } finally {
      setAlternativeBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          title="Schedule Details"
          breadcrumbs={['Home', 'Schedule Details']}
        />
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-crimson" />
            <p className="text-sm">Loading schedule details…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          title="Schedule Details"
          breadcrumbs={['Home', 'Schedule Details']}
        />
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-crimson" />
            <p className="text-sm font-semibold text-text-primary">{error || 'Schedule not found.'}</p>
            <Button size="sm" onClick={() => navigate('/dashboard/home')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[appointment.status] ?? appointment.status;
  const statusStyle = STATUS_STYLES[appointment.status] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  const canRespond = appointment.status === 'proposed' && !responseSuccess;

  const hasPriestAssigned = Boolean(appointment.assignedPriestId);
  const isPriestAccepted = hasPriestAssigned && appointment.priestResponseStatus === 'ACCEPTED';
  const canAcceptReschedule = canRespond && isPriestAccepted;

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        title="Schedule Details"
        description={`Confirmation: ${appointment.confirmationNumber}`}
        breadcrumbs={['Home', 'Schedule Details']}
      />

      <Card>
        <CardContent className="py-6 space-y-6">
          {/* Status banner */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold ${statusStyle}`}>
            {appointment.status === 'confirmed' && <CheckCircle className="w-4 h-4" />}
            {appointment.status === 'cancelled' && <XCircle className="w-4 h-4" />}
            {appointment.status === 'proposed' && <AlertCircle className="w-4 h-4" />}
            {appointment.status === 'booked' && <Clock className="w-4 h-4" />}
            {statusLabel}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Service</span>
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                {appointment.serviceName}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Parish</span>
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                {appointment.parishName || `Parish #${appointment.parishId}`}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Scheduled Date</span>
              <p className="font-semibold text-text-primary">{appointment.date}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Time Slot</span>
              <p className="font-semibold text-text-primary">{appointment.timeSlot}</p>
            </div>

            {appointment.assignedPriestName && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned Priest</span>
                <p className="font-semibold text-text-primary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                  {appointment.assignedPriestName}
                </p>
              </div>
            )}

            {appointment.proposedDate && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Proposed Date</span>
                <p className="font-semibold text-blue-700">{appointment.proposedDate}</p>
              </div>
            )}

            {appointment.proposedTime && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Proposed Time</span>
                <p className="font-semibold text-blue-700">{appointment.proposedTime}</p>
              </div>
            )}

            {appointment.rescheduleReason && (
              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Reschedule Reason</span>
                <p className="text-text-primary bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 text-xs leading-relaxed">
                  {appointment.rescheduleReason}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Confirmation No.</span>
              <p className="font-mono text-xs font-bold text-text-primary">{appointment.confirmationNumber}</p>
            </div>
          </div>

          {/* Reschedule history & changes */}
          {appointment.rescheduleHistory && appointment.rescheduleHistory.length > 0 && (
            <ScheduleRescheduleHistory history={appointment.rescheduleHistory} />
          )}
          <ScheduleAttachments key={appointment.id} scheduleId={appointment.id} />

          {appointment.layMinisterAssigned && (
            <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50/80 space-y-4">
              {/* Notice of Lay Minister service */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-950">Lay Minister assignment</h4>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Due to priest unavailability on your requested schedule, this appointment remains confirmed and will be led by an authorized Lay Minister (<strong className="text-amber-950">{appointment.serviceName}</strong>).
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed pt-0.5">
                    Your scheduled appointment on <strong className="text-amber-950">{appointment.date} at {appointment.timeSlot}</strong> remains valid and reserved. No further action is required if you wish to proceed with this service.
                  </p>
                </div>
              </div>

              {/* Status of Active Proposal */}
              {appointment.alternativeProposal && ['SUBMITTED', 'PRIEST_PENDING'].includes(appointment.alternativeProposal.status) ? (
                <div className="bg-white rounded-xl border border-indigo-200/80 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-100">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      Alternative Priest-Led Request
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border w-max ${
                      appointment.alternativeProposal.status === 'PRIEST_PENDING'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {appointment.alternativeProposal.status === 'PRIEST_PENDING'
                        ? 'Awaiting Priest Acceptance'
                        : 'Awaiting Parish Review'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-700 space-y-1">
                    <p>
                      Requested alternative: <strong className="text-gray-900">{new Date(appointment.alternativeProposal.proposedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                      {appointment.alternativeProposal.proposedStartDatetime && (
                        <span> at <strong className="text-gray-900">{new Date(appointment.alternativeProposal.proposedStartDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {appointment.alternativeProposal.status === 'PRIEST_PENDING'
                        ? `Staff has nominated Rev. Fr. ${appointment.alternativeProposal.nominatedPriest?.fullName || 'the celebrant'}. Confirmation is pending priest acceptance.`
                        : 'Parish staff will review priest availability for your requested date and nominate an available celebrant.'}
                    </p>
                    {appointment.alternativeProposal.note && (
                      <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1 italic">
                        Note: &ldquo;{appointment.alternativeProposal.note}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-500">
                      Your original appointment remains active until this alternative is confirmed.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={alternativeBusy}
                      onClick={() => void handleAlternativeWithdraw()}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {alternativeBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {alternativeBusy ? 'Withdrawing...' : 'Withdraw Alternative Request'}
                    </Button>
                  </div>
                </div>
              ) : appointment.canProposeAlternativeDate ? (
                /* Distinct Option to Request Priest-Led Alternative */
                <div className="bg-white rounded-2xl border border-amber-200/90 p-5 space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-crimson" />
                      Prefer a Priest-Led Service? (Optional)
                    </h5>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      If your sacrament or rite requires a priest, you may propose an alternative date and time below. Your original appointment will remain scheduled unless the alternative is confirmed.
                    </p>
                  </div>

                  {/* Calendar / Available Dates */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                      1. Select an Available Date <span className="text-red-500">*</span>
                    </label>

                    {loadingDates ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <Loader2 className="w-6 h-6 animate-spin text-crimson" />
                        <span className="mt-2 text-xs text-text-muted">Loading available parish calendar dates…</span>
                      </div>
                    ) : datesError ? (
                      <div className="flex items-center justify-between p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                        <span>{datesError}</span>
                        <button
                          type="button"
                          onClick={() => void fetchAvailableDates()}
                          className="font-bold text-crimson hover:underline shrink-0 ml-2"
                        >
                          Retry
                        </button>
                      </div>
                    ) : availableDates.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                        No online alternative dates are currently open for this service. You may contact the parish office directly.
                      </div>
                    ) : (
                      <DatePickerCalendar
                        selectedDate={alternativeDate}
                        onSelectDate={(date) => {
                          setAlternativeDate(date);
                          setAlternativeSlot('');
                        }}
                        availableDates={availableDates}
                      />
                    )}
                  </div>

                  {/* Time Slots */}
                  {alternativeDate && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                        2. Select Time Slot on {alternativeDate} <span className="text-red-500">*</span>
                      </label>

                      {loadingSlots ? (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-text-muted">
                          <Loader2 className="w-4 h-4 animate-spin text-crimson" />
                          <span>Checking slot availability for {alternativeDate}…</span>
                        </div>
                      ) : slotsError ? (
                        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                          <span>{slotsError}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = alternativeDate;
                              setAlternativeDate('');
                              setTimeout(() => setAlternativeDate(d), 50);
                            }}
                            className="font-bold text-crimson hover:underline"
                          >
                            Retry
                          </button>
                        </div>
                      ) : alternativeSlots.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                          No available time slots on this date. Please select another date on the calendar above.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {alternativeSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setAlternativeSlot(slot)}
                              className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                                alternativeSlot === slot
                                  ? 'bg-crimson text-white border-crimson shadow-sm'
                                  : 'bg-white text-text-primary border-border hover:border-crimson/50 hover:bg-red-50/40'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note to Parish Staff */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                        3. Note to Parish Staff (Optional)
                      </label>
                      <span className="text-[11px] text-text-muted">{alternativeNote.length}/1000</span>
                    </div>
                    <textarea
                      value={alternativeNote}
                      onChange={(event) => setAlternativeNote(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="Share any special circumstances or pastoral reasons for parish staff..."
                      className="w-full border border-border rounded-xl p-3 text-xs bg-white outline-none focus:border-crimson transition-colors"
                    />
                  </div>

                  {/* Submit Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="text-[11px] text-text-muted">
                      {alternativeDate && alternativeSlot ? (
                        <span>
                          Selected: <strong className="text-text-primary">{alternativeDate}</strong> at <strong className="text-text-primary">{alternativeSlot}</strong>
                        </span>
                      ) : (
                        <span>Please select a date and an available time slot above.</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={alternativeBusy || !alternativeDate || !alternativeSlot}
                      onClick={() => void handleAlternativeSubmit()}
                      className="cursor-pointer"
                    >
                      {alternativeBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {alternativeBusy ? 'Submitting...' : 'Request Priest-Led Alternative Date'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Reschedule proposal response */}
          {canRespond && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
              <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Your parish has proposed a new date and time.
              </p>
              {appointment.proposedDate && appointment.proposedTime && (
                <p className="text-sm text-blue-800">
                  Proposed: <strong>{appointment.proposedDate}</strong> at{' '}
                  <strong>{appointment.proposedTime}</strong>
                </p>
              )}
              {appointment.rescheduleReason && (
                <p className="text-xs text-blue-700 italic">&ldquo;{appointment.rescheduleReason}&rdquo;</p>
              )}

              {/* Priest Assignment / Acceptance Status Notice */}
              {!hasPriestAssigned ? (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Waiting for priest assignment</p>
                    <p className="text-amber-800">
                      You can review the proposed date and time, but acceptance will become available once the parish assigns a priest and the priest accepts.
                    </p>
                  </div>
                </div>
              ) : !isPriestAccepted ? (
                <div className="flex items-start gap-2.5 p-3 bg-blue-100/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Waiting for priest acceptance</p>
                    <p className="text-blue-800">
                      You can review the proposed date and time, but final acceptance will become available once the assigned priest accepts the schedule.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => void handleRespond(true)}
                  disabled={responding || !canAcceptReschedule}
                  title={
                    !hasPriestAssigned
                      ? 'Waiting for priest assignment and acceptance'
                      : !isPriestAccepted
                      ? 'Waiting for assigned priest to accept this schedule'
                      : undefined
                  }
                >
                  {responding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Accept Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRespond(false)}
                  disabled={responding}
                >
                  {responding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  Decline
                </Button>
              </div>
            </div>
          )}

          {/* Response feedback */}
          {responseSuccess && (
            <div className="flex items-start gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {responseSuccess}
            </div>
          )}
          {responseError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {responseError}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleDetailPage;
