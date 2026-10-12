import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, CheckCircle, XCircle,
  AlertCircle, Building, Loader2, User,
} from 'lucide-react';
import services from '../../providers/factory';
import type { Appointment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import ScheduleRescheduleHistory from '../../features/scheduler/components/ScheduleRescheduleHistory';

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
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null);
  const [alternativeDate, setAlternativeDate] = useState('');
  const [alternativeSlot, setAlternativeSlot] = useState('');
  const [alternativeNote, setAlternativeNote] = useState('');
  const [alternativeSlots, setAlternativeSlots] = useState<string[]>([]);
  const [alternativeBusy, setAlternativeBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const appt = await services.scheduler.getAppointmentById(id);
      setAppointment(appt);
    } catch (err: any) {
      const code = err?.status ?? err?.statusCode;
      if (code === 404) {
        setError('This schedule could not be found. It may have been removed or the link is invalid.');
      } else if (code === 403) {
        setError('You do not have access to this schedule.');
      } else {
        setError('Failed to load schedule details. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!appointment || !alternativeDate || !appointment.rawEventType) {
      setAlternativeSlots([]);
      setAlternativeSlot('');
      return;
    }
    let active = true;
    services.scheduler.getAvailableSlots(appointment.parishId, alternativeDate, appointment.rawEventType)
      .then((slots) => {
        if (!active) return;
        setAlternativeSlots(slots);
        setAlternativeSlot((current) => slots.includes(current) ? current : '');
      })
      .catch(() => {
        if (active) setAlternativeSlots([]);
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
      setAppointment(updated);
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
          showBackToHome={false}
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
          showBackToHome={false}
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
        showBackToHome={false}
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

          {appointment.layMinisterAssigned && (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-950">Lay Minister assignment</p>
              <p className="text-xs text-amber-900">
                No priest was available for the current date and time. This service remains valid and will be led by a Lay Minister.
              </p>
              {appointment.alternativeProposal && ['SUBMITTED', 'PRIEST_PENDING'].includes(appointment.alternativeProposal.status) ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-950">
                    Alternative requested for <strong>{new Date(appointment.alternativeProposal.proposedDate).toLocaleDateString()}</strong>.
                    {' '}Status: <strong>{appointment.alternativeProposal.status === 'PRIEST_PENDING' ? 'Awaiting nominated priest' : 'Awaiting parish review'}</strong>.
                  </p>
                  <Button size="sm" variant="outline" disabled={alternativeBusy} onClick={() => void handleAlternativeWithdraw()}>
                    Withdraw request
                  </Button>
                </div>
              ) : appointment.canProposeAlternativeDate ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={alternativeDate}
                    onChange={(event) => setAlternativeDate(event.target.value)}
                    className="border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <select
                    value={alternativeSlot}
                    onChange={(event) => setAlternativeSlot(event.target.value)}
                    disabled={!alternativeDate || alternativeSlots.length === 0}
                    className="border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Select an available time</option>
                    {alternativeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                  <textarea
                    value={alternativeNote}
                    onChange={(event) => setAlternativeNote(event.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="Optional note to parish staff"
                    className="sm:col-span-2 border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <Button size="sm" disabled={alternativeBusy || !alternativeDate || !alternativeSlot} onClick={() => void handleAlternativeSubmit()}>
                    {alternativeBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Request priest-led alternative date
                  </Button>
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

          {/* Navigation */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => navigate('/dashboard/home')}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-crimson transition-colors focus-ring rounded px-1 py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleDetailPage;
