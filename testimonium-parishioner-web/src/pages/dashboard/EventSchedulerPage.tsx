import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle, Users, AlertCircle } from 'lucide-react';
import services from '../../providers/factory';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import type {
  AvailabilityDates,
  EligiblePriest,
  ScheduleRecommendationItem,
  SchedulingConfiguration,
} from '../../providers/types';
import { useParishes } from '../../hooks/useService';
import type { Appointment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Stepper } from '../../components/ui/Stepper';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { DatePickerCalendar } from '../../features/scheduler/components/DatePickerCalendar';
import { ApiError } from '../../api/client';

const steps = ['Select Parish', 'Choose Service', 'Select Date', 'Choose Time Slot', 'Confirmation'];
const SCHEDULING_AVAILABILITY_CONFLICT_CODES = new Set([
  'SCHEDULING_CONFIGURATION_INCOMPLETE',
  'SERVICE_NOT_OFFERED',
  'PARISH_INACTIVE',
  'OFFICE_CLOSED',
  'OUTSIDE_OFFICE_HOURS',
  'SERVICE_BLOCKED',
  'DATE_IN_PAST',
  'DATE_OUT_OF_HORIZON',
  'TIME_IN_PAST',
  'INVALID_TIME_SLOT',
  'DAILY_CAPACITY_EXCEEDED',
  'SLOT_CAPACITY_EXCEEDED',
  'SCHEDULE_CONCURRENCY_CONFLICT',
  'PARISH_CLOSED',
  'FULLY_BOOKED',
  'SLOT_NOT_CONFIGURED',
  'SCHEDULE_CONFLICT',
]);

const isSchedulingAvailabilityConflict = (error: unknown) =>
  error instanceof ApiError && typeof error.code === 'string' && SCHEDULING_AVAILABILITY_CONFLICT_CODES.has(error.code);

const scheduleSubmissionErrorMessage = (error: unknown) =>
  error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500
    ? error.message
    : 'Unable to submit your schedule request. Please try again.';

export const EventSchedulerPage: React.FC = () => {
  const navigate = useNavigate();
  const parishesQuery = useParishes();
  const { isProfileIncomplete, openProfileModal } = useProfileRequirement();

  useEffect(() => {
    if (isProfileIncomplete) {
      openProfileModal('schedule appointments');
    }
  }, [isProfileIncomplete, openProfileModal]);

  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedParishId, setSelectedParishId] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [requestedPriestId, setRequestedPriestId] = useState<number | null>(null);
  const [eligiblePriests, setEligiblePriests] = useState<EligiblePriest[]>([]);
  const [loadingPriests, setLoadingPriests] = useState(false);
  const [priestsError, setPriestsError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ScheduleRecommendationItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [venueAddress, setVenueAddress] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [configuration, setConfiguration] = useState<SchedulingConfiguration | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDates | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingConfiguration, setLoadingConfiguration] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Appointment | null>(null);
  const [activeProposal, setActiveProposal] = useState<{
    id: string; serviceName: string; proposedDate: string; proposedTime: string; reason: string; version?: number;
  } | null>(null);
  const [submittingProposal, setSubmittingProposal] = useState(false);

  const selectedParish = parishes.find((parish) => parish.id === selectedParishId);
  const selectedService = configuration?.services.find((service) => service.eventType === selectedEventType);

  const reqGenRef = useRef(0);
  const recGenRef = useRef(0);
  const priestsGenRef = useRef(0);
  const pendingRecommendationSlotRef = useRef<string | null>(null);

  const reloadConfiguration = useCallback(async () => {
    if (!selectedParishId) return;
    const currentGen = ++reqGenRef.current;
    setLoadingConfiguration(true);
    try {
      const next = await services.scheduler.getSchedulingConfiguration(selectedParishId);
      if (currentGen !== reqGenRef.current) return;
      setConfiguration(next);
      setSelectedEventType((current) => next.services.some((service) => service.eventType === current) ? current : '');
    } catch {
      if (currentGen !== reqGenRef.current) return;
      setConfiguration(null);
      setMessage('Could not load this parish scheduling configuration. Please try again.');
    } finally {
      if (currentGen === reqGenRef.current) {
        setLoadingConfiguration(false);
      }
    }
  }, [selectedParishId]);

  const revalidateSchedulingState = useCallback(async () => {
    if (!selectedParishId) return;
    const currentGen = ++reqGenRef.current;

    try {
      const nextConfig = await services.scheduler.getSchedulingConfiguration(selectedParishId);
      if (currentGen !== reqGenRef.current) return;
      setConfiguration(nextConfig);

      // Downstream Check 1: Is currently selected service still offered?
      if (!selectedEventType) {
        return;
      }
      const isServiceValid = nextConfig.services.some((s) => s.eventType === selectedEventType);
      if (!isServiceValid) {
        // Service is no longer enabled -> clear service, date, time
        setSelectedEventType('');
        setSelectedDate('');
        setSelectedTimeSlot('');
        setAvailability(null);
        setAvailableSlots([]);
        return;
      }

      // Revalidate available dates for current service
      const nextDates = await services.scheduler.getAvailabilityDates(selectedParishId, selectedEventType);
      if (currentGen !== reqGenRef.current) return;
      setAvailability(nextDates);

      // Downstream Check 2: Is currently selected date still available?
      if (!selectedDate) {
        return;
      }
      const isDateValid = nextDates.dates.includes(selectedDate);
      if (!isDateValid) {
        // Date is no longer available -> clear date, time
        setSelectedDate('');
        setSelectedTimeSlot('');
        setAvailableSlots([]);
        return;
      }

      // Revalidate available slots for current date
      const nextSlots = await services.scheduler.getAvailableSlots(selectedParishId, selectedDate, selectedEventType);
      if (currentGen !== reqGenRef.current) return;
      setAvailableSlots(nextSlots);

      // Downstream Check 3: Is currently selected slot still available?
      if (selectedTimeSlot && !nextSlots.includes(selectedTimeSlot)) {
        // Time slot is no longer available -> clear time only
        setSelectedTimeSlot('');
      }
    } catch {
      // Non-fatal on background focus revalidation; preserve current UI
    }
  }, [selectedParishId, selectedEventType, selectedDate, selectedTimeSlot]);

  const fetchProposal = useCallback(async () => {
    try {
      const appointments = await services.scheduler.getAppointments();
      const proposal = appointments.find((appointment) => appointment.status === 'proposed');
      setActiveProposal(proposal ? {
        id: proposal.id,
        serviceName: proposal.serviceName,
        proposedDate: proposal.proposedDate || proposal.date,
        proposedTime: proposal.proposedTime || proposal.timeSlot,
        reason: proposal.rescheduleReason || 'The parish proposed an alternative schedule.',
        version: proposal.version,
      } : null);
    } catch {
      setActiveProposal(null);
    }
  }, []);

  useEffect(() => {
    if (parishes.length && !selectedParishId) setSelectedParishId(parishes[0].id);
  }, [parishes, selectedParishId]);

  const loadEligiblePriests = useCallback(async () => {
    const currentGen = ++priestsGenRef.current;
    if (!selectedParishId) {
      setEligiblePriests([]);
      setPriestsError(null);
      setLoadingPriests(false);
      return;
    }
    setLoadingPriests(true);
    setPriestsError(null);
    try {
      const priests = await services.scheduler.getEligiblePriests(selectedParishId);
      if (currentGen !== priestsGenRef.current) return;
      setEligiblePriests(priests || []);
    } catch {
      if (currentGen !== priestsGenRef.current) return;
      setEligiblePriests([]);
      setPriestsError('Unable to load preferred priests. You can still proceed without a preference.');
    } finally {
      if (currentGen === priestsGenRef.current) {
        setLoadingPriests(false);
      }
    }
  }, [selectedParishId]);

  const fetchRecommendations = useCallback(async () => {
    const currentGen = ++recGenRef.current;
    if (!selectedParishId || !selectedEventType || !preferredDate) {
      setRecommendations([]);
      setRecommendationsError(null);
      setLoadingRecommendations(false);
      return;
    }
    setLoadingRecommendations(true);
    setRecommendationsError(null);
    try {
      const res = await services.scheduler.getRecommendations({
        parishId: Number(selectedParishId),
        eventType: selectedEventType,
        preferredDate: preferredDate,
        requestedPriestId: requestedPriestId || null,
      });
      if (currentGen !== recGenRef.current) return;
      setRecommendations(res.recommendations || []);
    } catch {
      if (currentGen !== recGenRef.current) return;
      setRecommendations([]);
      setRecommendationsError('Unable to load recommendations. You can still choose an available time slot below.');
    } finally {
      if (currentGen === recGenRef.current) {
        setLoadingRecommendations(false);
      }
    }
  }, [selectedParishId, selectedEventType, preferredDate, requestedPriestId]);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  useEffect(() => {
    setSelectedEventType('');
    setPreferredDate('');
    setSelectedDate('');
    setSelectedTimeSlot('');
    pendingRecommendationSlotRef.current = null;
    setRequestedPriestId(null);
    setEligiblePriests([]);
    setPriestsError(null);
    setRecommendations([]);
    setRecommendationsError(null);
    setAvailability(null);
    setAvailableSlots([]);
    if (selectedParishId) {
      void reloadConfiguration();
    }
    void loadEligiblePriests();
  }, [loadEligiblePriests, reloadConfiguration, selectedParishId]);

  useEffect(() => { void fetchProposal(); }, [fetchProposal]);

  // Focus and visibility revalidation with coalescing to avoid duplicate refetch storms
  useEffect(() => {
    let lastRefetch = 0;
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && selectedParishId) {
        const now = Date.now();
        if (now - lastRefetch > 500) {
          lastRefetch = now;
          void revalidateSchedulingState();
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [revalidateSchedulingState, selectedParishId]);

  useEffect(() => {
    if (!selectedParishId || !selectedEventType) {
      setAvailability(null);
      return;
    }
    const currentGen = ++reqGenRef.current;
    setLoadingDates(true);
    setSelectedDate('');
    setSelectedTimeSlot('');
    pendingRecommendationSlotRef.current = null;
    void services.scheduler.getAvailabilityDates(selectedParishId, selectedEventType)
      .then((result) => { if (currentGen === reqGenRef.current) setAvailability(result); })
      .catch(() => { if (currentGen === reqGenRef.current) { setAvailability(null); setMessage('Could not load available dates. Please try again.'); } })
      .finally(() => { if (currentGen === reqGenRef.current) setLoadingDates(false); });
  }, [selectedEventType, selectedParishId]);

  useEffect(() => {
    if (!selectedParishId || !selectedEventType || !selectedDate) {
      setAvailableSlots([]);
      return;
    }
    const currentGen = ++reqGenRef.current;
    setLoadingSlots(true);

    const pendingSlot = pendingRecommendationSlotRef.current;
    if (!pendingSlot) {
      setSelectedTimeSlot('');
    }

    void services.scheduler.getAvailableSlots(selectedParishId, selectedDate, selectedEventType)
      .then((result) => {
        if (currentGen === reqGenRef.current) {
          setAvailableSlots(result);
          if (pendingSlot) {
            if (result.includes(pendingSlot)) {
              setSelectedTimeSlot(pendingSlot);
            } else {
              setSelectedTimeSlot('');
              setMessage('The recommended time slot is no longer available. Please select another slot.');
            }
            pendingRecommendationSlotRef.current = null;
          }
        }
      })
      .catch(() => {
        if (currentGen === reqGenRef.current) {
          setAvailableSlots([]);
          setSelectedTimeSlot('');
          pendingRecommendationSlotRef.current = null;
          setMessage('Could not load available time slots. Please try again.');
        }
      })
      .finally(() => { if (currentGen === reqGenRef.current) setLoadingSlots(false); });
  }, [selectedDate, selectedEventType, selectedParishId]);

  const handleNext = () => {
    if (currentStep === 0 && !selectedParishId) return;
    if (currentStep === 1 && !selectedEventType) return;
    if (currentStep === 2 && !selectedDate) return;
    if (currentStep === 3) {
      if (!selectedTimeSlot) return;
      if (isProfileIncomplete) {
        openProfileModal('schedule appointments');
        return;
      }
    }
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const handleBook = async () => {
    if (isProfileIncomplete) {
      openProfileModal('schedule appointments');
      return;
    }
    if (!selectedService || !selectedParishId || !selectedDate || !selectedTimeSlot) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const appointment = await services.scheduler.bookAppointment({
        parishId: selectedParishId,
        eventType: selectedService.eventType,
        displayTitle: selectedService.label,
        date: selectedDate,
        timeSlot: selectedTimeSlot,
        location: venueAddress,
        remarks: additionalNotes.trim() || undefined,
        requestedPriestId: requestedPriestId || undefined,
      });
      setCreatedBooking(appointment);
      setCurrentStep(4);
    } catch (error: any) {
      if (error?.code === 'PROFILE_INCOMPLETE') {
        openProfileModal('schedule appointments');
        return;
      }
      if (error?.code === 'INVALID_REQUESTED_PRIEST') {
        setRequestedPriestId(null);
        void loadEligiblePriests();
        void fetchRecommendations();
        setMessage('Your preferred priest is no longer available for selection at this parish. You may submit your request without a preferred priest.');
        return;
      }
      if (isSchedulingAvailabilityConflict(error)) {
        setSelectedTimeSlot('');
        await reloadConfiguration();
        const nextDates = await services.scheduler.getAvailabilityDates(selectedParishId, selectedEventType);
        setAvailability(nextDates);
        void fetchRecommendations();
        if (selectedDate && nextDates.dates.includes(selectedDate)) {
          setAvailableSlots(await services.scheduler.getAvailableSlots(selectedParishId, selectedDate, selectedEventType));
        } else {
          setSelectedDate('');
          setAvailableSlots([]);
          setCurrentStep(2);
        }
        setMessage('Scheduling availability changed before your request was submitted. Please review the current options.');
      } else {
        setMessage(scheduleSubmissionErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondProposal = async (accept: boolean) => {
    if (!activeProposal) return;
    if (typeof activeProposal.version !== 'number') {
      setMessage('The schedule version is unavailable. Refreshing the latest proposal.');
      await fetchProposal();
      return;
    }
    setSubmittingProposal(true);
    try {
      await services.scheduler.respondReschedule(activeProposal.id, accept, activeProposal.version);
      setMessage(`Alternative schedule ${accept ? 'accepted' : 'declined'} successfully.`);
      await fetchProposal();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to respond to the proposed schedule. The latest state has been reloaded.');
      await fetchProposal();
    } finally {
      setSubmittingProposal(false);
    }
  };

  if (loading) return <div className='space-y-6'><PageHeader title='Event & Appointment Scheduler' description='Book an appointment with a parish office.' /><Card className='p-8'><Skeleton className='h-10 w-full mb-6' /><Skeleton className='h-64 w-full' /></Card></div>;
  if (error) return <div className='space-y-6'><PageHeader title='Event & Appointment Scheduler' description='Book an appointment with a parish office.' /><ErrorState description='Failed to load parishes for scheduling.' onRetry={() => void refetch()} /></div>;

  if (isProfileIncomplete) {
    return (
      <div className="space-y-6 pb-12" aria-live="polite">
        <PageHeader
          title="Schedule an Appointment"
          description="Book canonical interviews, confessions, or blessings."
          breadcrumbs={['Home', 'Schedule Appointment']}
        />

        <Card className="bg-white border-border shadow-sm">
          <CardContent className="py-12 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-bold text-text-primary">
                Profile Completion Required
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Complete your profile to access document and schedule requests. Parish offices require your official contact details (Full Name and Mobile Number) for canonical verification.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard/home')}
              >
                Return to Dashboard
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/dashboard/profile')}
              >
                Complete Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6 pb-12'>
      <PageHeader
        title="Schedule an Appointment"
        description="Book canonical interviews, confessions, or blessings."
        breadcrumbs={['Home', 'Schedule Appointment']}
      />

      {message && <div className='p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold rounded-xl'>{message}</div>}
      {activeProposal && <Card className='bg-amber-50/70 border-l-4 border-amber-500 p-5 space-y-3'>
        <span className='text-[10px] font-bold uppercase tracking-wider text-amber-900'>Alternative Schedule Proposal</span>
        <p className='text-sm text-amber-950'><strong>{activeProposal.serviceName}</strong> {'\u2014'} {activeProposal.proposedDate} at {activeProposal.proposedTime}</p>
        <p className='text-xs text-amber-800'>{activeProposal.reason}</p>
        <div className='flex gap-3'><Button size='sm' disabled={submittingProposal} onClick={() => void handleRespondProposal(true)}>{submittingProposal ? 'Responding...' : 'Accept Proposed Date'}</Button><Button size='sm' variant='outline' disabled={submittingProposal} onClick={() => void handleRespondProposal(false)}>Decline Proposal</Button></div>
      </Card>}
      <Card><CardContent className='pt-6 space-y-8'>
        <Stepper steps={steps} currentStep={currentStep} />
        {currentStep === 0 && <div className='space-y-4 max-w-xl mx-auto'>
          <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>Target Parish Office</label>
          <CustomSelect
            value={selectedParishId}
            onChange={setSelectedParishId}
            placeholder="Select parish..."
            options={parishes.map((parish) => ({
              value: parish.id,
              label: parish.name,
              secondary: parish.city ? `${parish.city}, ${parish.province || ''}` : undefined,
            }))}
            searchable
            searchPlaceholder="Search parish by name or city..."
          />
          {configuration?.venueCapacity ? <div className='flex items-center gap-2.5 p-3.5 bg-red-50/60 border border-crimson/15 rounded-xl text-xs text-text-primary'><Users className='w-4 h-4 text-crimson' /><span>Parish venue capacity: <strong>{configuration.venueCapacity} people</strong> (informational only)</span></div> : null}
          <div className='flex justify-end pt-4'><Button onClick={handleNext}>Next Step</Button></div>
        </div>}
        {currentStep === 1 && <div className='space-y-4 max-w-xl mx-auto'>
          <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>Select Service</label>
          {loadingConfiguration ? <Skeleton className='h-32 w-full' /> : null}
          {!loadingConfiguration && !configuration?.schedulingAvailable ? <div className='p-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900'>This parish is not currently accepting online scheduling requests.</div> : null}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>{configuration?.services.map((service) => <button key={service.eventType} type='button' onClick={() => setSelectedEventType(service.eventType)} className={`p-4 border rounded-xl text-left text-xs font-medium flex items-center justify-between ${selectedEventType === service.eventType ? 'border-crimson bg-red-50 text-crimson font-bold' : 'border-border text-text-primary hover:bg-app-page'}`}><span>{service.label}</span>{selectedEventType === service.eventType && <Check className='w-4 h-4' />}</button>)}</div>
          <div className='flex justify-between pt-6'><Button variant='outline' onClick={() => setCurrentStep(0)}>Back</Button><Button onClick={handleNext} disabled={!selectedEventType}>Next Step</Button></div>
        </div>}
        {currentStep === 2 && <div className='space-y-4 max-w-xl mx-auto'>
          <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>Select Booking Date</label>
          {loadingDates ? (
            <Skeleton className='h-80 w-full' />
          ) : (
            <DatePickerCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                pendingRecommendationSlotRef.current = null;
                setSelectedDate(date);
                setPreferredDate(date);
                setSelectedTimeSlot('');
              }}
              availableDates={availability?.dates || []}
            />
          )}
          {availability && !availability.serviceAvailable ? <p className='text-xs text-amber-800'>This service has no online availability right now.</p> : null}
          <div className='flex justify-between pt-6'><Button variant='outline' onClick={() => setCurrentStep(1)}>Back</Button><Button onClick={handleNext} disabled={!selectedDate}>Next Step</Button></div>
        </div>}
        {currentStep === 3 && <div className='space-y-5 max-w-xl mx-auto'>
          <div className='space-y-1.5'>
            <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>
              Preferred Priest (Optional)
            </label>
            <p className='text-xs text-text-muted'>
              Preference only. Final assignment is determined by the parish.
            </p>
            <CustomSelect
              value={requestedPriestId ? String(requestedPriestId) : ''}
              onChange={(val) => setRequestedPriestId(val ? Number(val) : null)}
              placeholder="No priest preference"
              options={[
                { value: '', label: 'No priest preference' },
                ...eligiblePriests.map((priest) => ({
                  value: String(priest.id),
                  label: `${priest.name}${priest.isAssistant ? ' (Assistant Priest)' : ''}`,
                })),
              ]}
              disabled={loadingPriests}
            />
            {priestsError && (
              <div className='flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800'>
                <span>{priestsError}</span>
                <button
                  type='button'
                  onClick={() => void loadEligiblePriests()}
                  className='text-crimson font-bold hover:underline ml-2 flex-shrink-0'
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className='space-y-2 pt-2 border-t border-border/40'>
            <div className='flex items-center justify-between'>
              <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>
                Suggested Times
              </label>
              <span className='text-[11px] text-text-muted'>Based on your preferences</span>
            </div>
            {requestedPriestId ? (
              <p className='text-xs text-text-muted'>
                Your preferred priest may not be available for every suggested time. The parish can still assign another priest.
              </p>
            ) : null}
            {loadingRecommendations ? (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
                <Skeleton className='h-16 w-full' />
                <Skeleton className='h-16 w-full' />
              </div>
            ) : recommendationsError ? (
              <div className='flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800'>
                <span>{recommendationsError}</span>
                <button
                  type='button'
                  onClick={() => void fetchRecommendations()}
                  className='text-crimson font-bold hover:underline ml-2 flex-shrink-0'
                >
                  Retry
                </button>
              </div>
            ) : recommendations.length > 0 ? (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
                {recommendations.slice(0, 6).map((rec) => {
                  const isSelected = selectedDate === rec.date && selectedTimeSlot === rec.timeSlot;
                  return (
                    <button
                      key={`${rec.date}-${rec.timeSlot}`}
                      type='button'
                      onClick={() => {
                        pendingRecommendationSlotRef.current = rec.timeSlot;
                        setSelectedDate(rec.date);
                        setSelectedTimeSlot(rec.timeSlot);
                        // preferredDate anchor remains unchanged!
                      }}
                      className={`p-3 border rounded-xl text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-crimson bg-red-50 text-crimson font-semibold ring-1 ring-crimson'
                          : 'border-border text-text-primary bg-white hover:bg-app-page'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <span className='text-xs font-bold'>{rec.date}</span>
                        <span className='text-xs font-semibold'>{rec.timeSlot}</span>
                      </div>
                      <div className='flex flex-wrap gap-1 mt-2'>
                        {rec.reasons.includes('PREFERRED_DATE') && (
                          <span className='px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-700 font-medium'>Preferred Date</span>
                        )}
                        {rec.reasons.includes('PREFERRED_TIME') && (
                          <span className='px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-700 font-medium'>Preferred Time</span>
                        )}
                        {rec.preferredPriestAvailable === true && (
                          <span
                            title="Your preferred priest is available at this time."
                            className='px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-700 font-medium'
                          >
                            Preferred Priest Available
                          </span>
                        )}
                        {rec.preferredPriestAvailable === false && (
                          <span
                            title="Your preferred priest is unavailable at this time, but another priest may be assigned."
                            className='px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 font-medium'
                          >
                            Preferred Priest Unavailable
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className='text-xs text-text-muted italic'>No suggested times found for this window. Please choose from the available slots below.</p>
            )}
          </div>

          <div className='space-y-2 pt-2 border-t border-border/40'>
            <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>
              Available Time Slots {selectedDate ? `(${selectedDate})` : ''}
            </label>
            {loadingSlots ? <div className='grid grid-cols-2 gap-3'><Skeleton className='h-12 w-full' /><Skeleton className='h-12 w-full' /></div> : null}
            {!loadingSlots && !availableSlots.length ? <p className='p-5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800'>No time slots are available for this date. Choose another date.</p> : null}
            {!loadingSlots && availableSlots.length > 0 && (
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type='button'
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`p-3.5 border rounded-xl text-xs font-bold ${
                      selectedTimeSlot === slot
                        ? 'border-crimson bg-crimson text-white'
                        : 'border-border text-text-primary bg-white hover:bg-red-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>Venue or location note (optional)</label>
          <input value={venueAddress} onChange={(event) => setVenueAddress(event.target.value)} className='w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary' placeholder='Add a relevant location detail' />

          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center">
              <label className='block text-xs font-semibold text-text-primary uppercase tracking-wider'>
                Additional Notes (Optional)
              </label>
              <span className="text-[11px] text-text-muted">
                {additionalNotes.length}/500
              </span>
            </div>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 500))}
              rows={3}
              className='w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary resize-none'
              placeholder='e.g. Wheelchair accessibility or elderly attendee assistance'
            />
            <p className="text-[11px] text-text-muted italic">
              General notes for the parish office regarding this request.
            </p>
          </div>

          <div className='flex justify-between pt-6'><Button variant='outline' onClick={() => setCurrentStep(2)}>Back</Button><Button onClick={handleBook} loading={submitting} disabled={!selectedTimeSlot}>Confirm Booking</Button></div>
        </div>}
        {currentStep === 4 && createdBooking && <div className='text-center max-w-md mx-auto space-y-6 py-6'>
          <div className='flex justify-center text-green-600'><CheckCircle size={64} /></div><h3 className='text-xl font-serif font-bold text-text-primary'>Schedule Request Submitted</h3><p className='text-sm text-text-muted'>The parish will review your request.</p>
          <div className='p-5 bg-app-page border border-border rounded-card text-left space-y-3'><p><strong>Parish:</strong> {selectedParish?.name}</p><p><strong>Service:</strong> {createdBooking.serviceName}</p><p><strong>Date and time:</strong> {createdBooking.date} at {createdBooking.timeSlot}</p><p><strong>Reference:</strong> {createdBooking.confirmationNumber}</p></div>
          <Button className='w-full' onClick={() => navigate('/dashboard/home')}>Return to Dashboard</Button>
        </div>}
      </CardContent></Card>


    </div>
  );
};

export default EventSchedulerPage;
