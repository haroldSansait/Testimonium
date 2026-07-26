import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes } from '../../hooks/useService';
import type { Appointment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { CalendarProvider } from '../../features/scheduler/components/CalendarProvider';
import { CalendarToolbar } from '../../features/scheduler/components/CalendarToolbar';

export const EventSchedulerPage: React.FC = () => {
  const navigate = useNavigate();

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Scheduler State
  const [selectedParishId, setSelectedParishId] = useState('');
  const [selectedService, setSelectedService] = useState('Baptism Interview');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Active reschedule proposal (populated when parish staff proposes an alternative date)
  const [activeProposal, setActiveProposal] = useState<{
    id: string;
    serviceName: string;
    proposedDate: string;
    proposedTime: string;
    reason: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Booking confirmation
  const [createdBooking, setCreatedBooking] = useState<Appointment | null>(null);

  const steps = ['Select Parish', 'Choose Service', 'Select Date', 'Choose Time Slot', 'Confirmation'];

  const servicesList = [
    'Marriage Special',
    'Wake Mass',
    'Funeral',
    'Private Mass',
    'Anointing of the Sick',
    'Fiesta',
    'Blessing',
    'Deliverance',
    'Thanksgiving',
    'First Communion',
    'Mass of the Holy Spirit',
    'Confirmation',
    'Confession'
  ];

  const fetchActiveProposal = async () => {
    try {
      const appointments = await services.scheduler.getAppointments();
      const proposal = appointments.find(a => a.status === 'proposed');
      if (proposal) {
        setActiveProposal({
          id: proposal.id,
          serviceName: proposal.serviceName,
          proposedDate: proposal.proposedDate || proposal.date,
          proposedTime: proposal.proposedTime || proposal.timeSlot,
          reason: proposal.rescheduleReason || 'Staff pastoral commitment / slot conflict.'
        });
      } else {
        setActiveProposal(null);
      }
    } catch (err) {
      console.error('Failed to load appointments/proposals:', err);
    }
  };

  useEffect(() => {
    void fetchActiveProposal();
  }, []);

  // Sync initial parish
  useEffect(() => {
    if (parishes.length > 0 && !selectedParishId) {
      setSelectedParishId(parishes[0].id);
    }
  }, [parishes, selectedParishId]);

  // Fetch slots when date changes
  useEffect(() => {
    if (selectedParishId && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
          const slots = await services.scheduler.getAvailableSlots(selectedParishId, selectedDate);
          setAvailableSlots(slots);
          if (slots.length > 0) {
            setSelectedTimeSlot(slots[0]);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [selectedParishId, selectedDate]);

  const handleRespondProposal = async (accept: boolean) => {
    if (!activeProposal) return;
    setSubmittingProposal(true);
    try {
      await services.scheduler.respondReschedule(activeProposal.id, accept);
      setToastMessage(`Alternative schedule date ${accept ? 'accepted' : 'declined'} successfully.`);
      setActiveProposal(null);
      void fetchActiveProposal();
    } catch (err) {
      console.error(err);
      setToastMessage('Failed to respond to proposal. Please try again.');
    } finally {
      setSubmittingProposal(false);
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleBook = async () => {
    setSubmitting(true);
    try {
      const apt = await services.scheduler.bookAppointment({
        parishId: selectedParishId,
        serviceName: selectedService,
        date: selectedDate,
        timeSlot: selectedTimeSlot
      });
      setCreatedBooking(apt);
      setCurrentStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedParishName = () => {
    return parishes.find(p => p.id === selectedParishId)?.name || 'Selected Parish';
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Event & Appointment Scheduler" 
          description="Book dates and times for canonical interviews, seminars, and parish certifications."
          onRefresh={refetch}
          breadcrumbs={['Home', 'Event Scheduler']}
        />
        <ErrorState 
          title="Unable to load scheduling systems" 
          description="We had trouble retrieving available parish calendars. Please try again."
          onRetry={refetch} 
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader 
          title="Event & Appointment Scheduler" 
          description="Book dates and times for canonical interviews, seminars, and parish certifications."
          onRefresh={refetch}
          isRefreshing={true}
          breadcrumbs={['Home', 'Event Scheduler']}
        />
        <Card>
          <CardContent className="pt-6 space-y-8">
            {/* Stepper Skeleton */}
            <div className="flex justify-between items-center max-w-xl mx-auto">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  {i < 5 && <Skeleton className="h-1 w-12 sm:w-16 rounded" />}
                </div>
              ))}
            </div>

            {/* Stepper calendar skeleton */}
            <div className="space-y-4 max-w-xl mx-auto pt-4">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-4 w-60 rounded" />
              <Skeleton className="h-24 w-full rounded-card" />
              <div className="flex justify-between pt-4">
                <Skeleton className="h-10 w-24 rounded-button" />
                <Skeleton className="h-10 w-24 rounded-button" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-live="polite">
      <PageHeader 
        title="Event & Appointment Scheduler" 
        description="Book dates and times for canonical interviews, seminars, and parish certifications."
        onRefresh={refetch}
        breadcrumbs={['Home', 'Event Scheduler']}
      />

      {/* Reschedule Proposal Response Banner (shown only when a proposed reschedule exists) */}
      {activeProposal && (
        <Card className="bg-amber-50/70 border-l-4 border-amber-500 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Alternative Schedule Proposal</span>
              <h4 className="font-serif font-bold text-sm text-amber-950">{activeProposal.serviceName} — Proposed Date Update</h4>
              <p className="text-xs text-amber-800">
                The parish secretary has proposed an alternative slot on <strong className="font-semibold">{activeProposal.proposedDate} at {activeProposal.proposedTime}</strong> due to: {activeProposal.reason}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submittingProposal} onClick={() => void handleRespondProposal(true)}>
              {submittingProposal ? 'Responding...' : 'Accept Proposed Date'}
            </Button>
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-900 hover:bg-amber-100" disabled={submittingProposal} onClick={() => void handleRespondProposal(false)}>
              {submittingProposal ? 'Responding...' : 'Decline Proposal'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-8">
          <Stepper steps={steps} currentStep={currentStep} />

          {/* Step 1: Select Parish */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Target Parish Office
                </label>
                <p className="text-xs text-text-muted">Select the parish where you want to book your schedule.</p>
              </div>
              <select
                value={selectedParishId}
                onChange={e => setSelectedParishId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors"
              >
                {parishes.map(parish => (
                  <option key={parish.id} value={parish.id}>
                    {parish.name} — {parish.city}
                  </option>
                ))}
              </select>
              <div className="flex justify-end pt-4">
                <Button onClick={handleNext}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 2: Choose Service */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Select Administrative Service
                </label>
                <p className="text-xs text-text-muted">Select the interview, seminar, or ritual service schedule type.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servicesList.map(srv => (
                  <button
                    key={srv}
                    onClick={() => setSelectedService(srv)}
                    className={`p-4 border rounded-button text-left text-xs font-medium transition-all focus-ring ${
                      selectedService === srv
                        ? 'border-crimson bg-red-50/15 text-crimson font-semibold'
                        : 'border-border text-text-primary hover:bg-app-page'
                    }`}
                  >
                    <span>{srv}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Date */}
          {currentStep === 2 && (
            <CalendarProvider>
              <div className="space-y-4 max-w-xl mx-auto border border-border rounded-card bg-app-page overflow-hidden">
                <CalendarToolbar title={`Schedule for ${selectedDate || 'Select Date'}`} />
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Select Booking Date
                    </label>
                    <p className="text-xs text-text-muted">Choose a date for your appointment slot.</p>
                  </div>
                  
                  {/* Custom Date Input Container */}
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors"
                    />
                  </div>

                  <div className="flex justify-between pt-6">
                    <Button variant="outline" onClick={handlePrev}>Back</Button>
                    <Button onClick={handleNext} disabled={!selectedDate}>Next Step</Button>
                  </div>
                </div>
              </div>
            </CalendarProvider>
          )}

          {/* Step 4: Choose Time Slot */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Available Office Time Slots
                </label>
                <p className="text-xs text-text-muted">Select an available hourly slot for {selectedDate}.</p>
              </div>

              {loadingSlots ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full rounded animate-pulse" />
                  <Skeleton className="h-10 w-full rounded animate-pulse" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`p-3 border rounded-button text-center text-xs font-medium transition-all focus-ring ${
                        selectedTimeSlot === slot
                          ? 'border-crimson bg-red-50/15 text-crimson font-semibold'
                          : 'border-border text-text-primary hover:bg-app-page'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev} disabled={submitting}>Back</Button>
                <Button onClick={handleBook} loading={submitting} disabled={!selectedTimeSlot}>
                  Confirm Booking
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 4 && createdBooking && (
            <div className="text-center max-w-md mx-auto space-y-6 py-6 animate-in fade-in zoom-in duration-fast">
              <div className="flex justify-center text-green-600">
                <CheckCircle size={64} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-text-primary">
                  Appointment Confirmed!
                </h3>
                <p className="text-sm text-text-muted">
                  Your schedule request is logged in the parish database.
                </p>
              </div>

              {/* Details card */}
              <div className="p-5 bg-app-page border border-border rounded-card text-left space-y-3">
                <div className="flex justify-between border-b border-border/40 pb-2.5">
                  <span className="text-[10px] text-text-muted font-bold uppercase">Parish</span>
                  <span className="text-xs font-semibold text-text-primary">{getSelectedParishName()}</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2.5">
                  <span className="text-[10px] text-text-muted font-bold uppercase">Service</span>
                  <span className="text-xs font-semibold text-text-primary">{createdBooking.serviceName}</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2.5">
                  <span className="text-[10px] text-text-muted font-bold uppercase">Date & Time</span>
                  <span className="text-xs font-semibold text-text-primary">{createdBooking.date} at {createdBooking.timeSlot}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-[10px] text-text-muted font-bold uppercase">Reference Code</span>
                  <span className="font-mono text-sm font-bold text-crimson">{createdBooking.confirmationNumber}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={() => navigate('/dashboard/home')}>
                  Return to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-700 text-white rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default EventSchedulerPage;
