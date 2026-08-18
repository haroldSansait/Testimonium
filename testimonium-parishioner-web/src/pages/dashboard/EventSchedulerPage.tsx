import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Check, Users } from 'lucide-react';
import services from '../../providers/factory';
import { useParishes } from '../../hooks/useService';
import type { Appointment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { DatePickerCalendar } from '../../features/scheduler/components/DatePickerCalendar';

const ALL_EVENT_OPTIONS: { id: string; label: string }[] = [
  { id: 'BAPTISM', label: 'Baptism' },
  { id: 'WEDDING', label: 'Marriage (Canonical Interview)' },
  { id: 'MARRIAGE_SPECIAL', label: 'Marriage Special' },
  { id: 'CONFIRMATION', label: 'Confirmation' },
  { id: 'FIRST_COMMUNION', label: 'First Communion' },
  { id: 'CONFESSION', label: 'Confession' },
  { id: 'ANOINTING_OF_THE_SICK', label: 'Anointing of the Sick' },
  { id: 'FUNERAL', label: 'Funeral' },
  { id: 'WAKE_MASS', label: 'Wake Mass' },
  { id: 'PRIVATE_MASS', label: 'Private Mass' },
  { id: 'MASS_INTENTION', label: 'Mass Intention' },
  { id: 'BLESSING', label: 'Blessing' },
  { id: 'DELIVERANCE', label: 'Deliverance' },
  { id: 'THANKSGIVING', label: 'Thanksgiving' },
  { id: 'MASS_OF_HOLY_SPIRIT', label: 'Mass of the Holy Spirit' },
  { id: 'FIESTA', label: 'Fiesta' },
];

export const EventSchedulerPage: React.FC = () => {
  const navigate = useNavigate();

  const parishesQuery = useParishes();
  const parishes = parishesQuery.data || [];
  const { loading, error, refetch } = parishesQuery;

  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Scheduler State
  const [selectedParishId, setSelectedParishId] = useState('');
  const [selectedService, setSelectedService] = useState('Baptism');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
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

  const steps = ['Select Parish', 'Choose Sacrament', 'Select Date', 'Choose Time Slot', 'Confirmation'];

  const selectedParish = parishes.find(p => p.id === selectedParishId) || (parishes.length > 0 ? parishes[0] : undefined);

  // Dynamically derive offered services based on parish eventSettings.availableEvents
  const availableServices = useMemo(() => {
    if (!selectedParish) return ALL_EVENT_OPTIONS;
    const configuredEvents = selectedParish.eventSettings?.availableEvents;
    if (!configuredEvents || !Array.isArray(configuredEvents) || configuredEvents.length === 0) {
      return ALL_EVENT_OPTIONS;
    }
    const filtered = ALL_EVENT_OPTIONS.filter(opt => {
      const optEnum = opt.id.toUpperCase().replace(/[\s-]/g, '_');
      return configuredEvents.some((ce: string) => {
        const norm = String(ce).toUpperCase().replace(/[\s-]/g, '_');
        return norm === optEnum || norm.includes(optEnum) || optEnum.includes(norm);
      });
    });
    return filtered.length > 0 ? filtered : ALL_EVENT_OPTIONS;
  }, [selectedParish]);

  // If selected service is no longer offered in selected parish, default to first offered sacrament
  useEffect(() => {
    if (availableServices.length > 0) {
      const isStillAvailable = availableServices.some(s => s.label === selectedService || s.id === selectedService);
      if (!isStillAvailable) {
        setSelectedService(availableServices[0].label);
      }
    }
  }, [availableServices, selectedService]);

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

  // Fetch slots when date or service changes
  useEffect(() => {
    if (selectedParishId && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
          const slots = await services.scheduler.getAvailableSlots(selectedParishId, selectedDate, selectedService);
          setAvailableSlots(slots);
          if (slots.length > 0) {
            const isMarriage = selectedService.toLowerCase().includes('marriage') || selectedService.toLowerCase().includes('wedding');
            const hasSixAm = slots.some(s => s.includes('06:00 AM'));
            if (isMarriage && hasSixAm) {
              const sixAmSlot = slots.find(s => s.includes('06:00 AM')) || slots[0];
              setSelectedTimeSlot(sixAmSlot);
            } else {
              setSelectedTimeSlot(slots[0]);
            }
          } else {
            setSelectedTimeSlot('');
          }
        } catch (err) {
          console.error(err);
          setAvailableSlots([]);
          setSelectedTimeSlot('');
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [selectedParishId, selectedDate, selectedService]);

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
        timeSlot: selectedTimeSlot,
        location: venueAddress
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
    const parish = parishes.find(p => p.id === selectedParishId);
    return parish ? parish.name : 'Unknown Parish';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Event & Appointment Scheduler" description="Schedule sacramental rites and canonical appointments with parish offices." />
        <Card className="p-8">
          <Skeleton className="h-10 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Event & Appointment Scheduler" description="Schedule sacramental rites and canonical appointments with parish offices." />
        <ErrorState description="Failed to load parishes for scheduling." onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Event & Appointment Scheduler"
        description="Book dates for weddings, baptisms, blessings, and pastoral interviews across the Vicariate."
        breadcrumbs={['Dashboard', 'Event Scheduler']}
      />

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-xl animate-in fade-in">
          {toastMessage}
        </div>
      )}

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
                className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors cursor-pointer"
              >
                {parishes.map(parish => (
                  <option key={parish.id} value={parish.id}>
                    {parish.name} — {parish.city}
                  </option>
                ))}
              </select>

              {selectedParish?.venueCapacity && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-50/60 border border-crimson/15 rounded-xl text-xs text-text-primary">
                  <Users className="w-4 h-4 text-crimson flex-shrink-0" />
                  <span>
                    Parish Venue Capacity: <strong className="font-bold text-crimson">{selectedParish.venueCapacity} people max</strong> (Informational attendance limit)
                  </span>
                </div>
              )}

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
                  Select Sacrament or Service
                </label>
                <p className="text-xs text-text-muted">Select the interview, seminar, or ritual service schedule type for {selectedParish?.name}.</p>
              </div>

              {selectedParish?.venueCapacity && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-gray-50 border border-border/60 rounded-lg text-xs text-text-muted">
                  <Users className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                  <span>Church Maximum Capacity: <strong>{selectedParish.venueCapacity} attendees</strong></span>
                </div>
              )}

              {availableServices.length === 0 ? (
                <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-amber-900">No Sacraments Available</p>
                  <p className="text-xs text-amber-700">No sacraments or rites are currently enabled for online scheduling at this parish office.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableServices.map(srv => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedService(srv.label)}
                      className={`p-4 border rounded-xl text-left text-xs font-medium transition-all focus-ring cursor-pointer flex items-center justify-between ${
                        selectedService === srv.label || selectedService === srv.id
                          ? 'border-crimson bg-red-50/20 text-crimson font-bold shadow-xs'
                          : 'border-border text-text-primary hover:bg-app-page'
                      }`}
                    >
                      <span>{srv.label}</span>
                      {(selectedService === srv.label || selectedService === srv.id) && (
                        <Check className="w-4 h-4 text-crimson" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext} disabled={availableServices.length === 0}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Date */}
          {currentStep === 2 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Select Booking Date
                </label>
                <p className="text-xs text-text-muted">
                  Choose an open operating day at {selectedParish?.name || 'the parish office'}.
                </p>
              </div>
              
              <DatePickerCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate(date)}
                officeHours={selectedParish?.officeHours}
                parishName={selectedParish?.name}
              />

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev}>Back</Button>
                <Button onClick={handleNext} disabled={!selectedDate}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 4: Choose Time Slot */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Available Office Time Slots
                </label>
                <p className="text-xs text-text-muted">
                  Select an available slot for <strong className="text-text-primary">{selectedDate ? new Date(selectedDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}</strong> at {selectedParish?.name}.
                </p>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 w-full rounded-xl animate-pulse" />
                  <Skeleton className="h-12 w-full rounded-xl animate-pulse" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-xl text-center space-y-2">
                  <p className="text-xs font-bold text-amber-900">No Available Time Slots</p>
                  <p className="text-xs text-amber-700 font-normal leading-relaxed">
                    All scheduling slots are fully booked or the parish office is closed on this date. Please go back and select a different date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`p-3.5 border rounded-xl text-center text-xs font-bold transition-all focus-ring cursor-pointer flex items-center justify-center gap-2 ${
                        selectedTimeSlot === slot
                          ? 'border-crimson bg-crimson text-white shadow-sm'
                          : 'border-border text-text-primary bg-white hover:bg-red-50/30 hover:border-crimson/30'
                      }`}
                    >
                      <span>{slot}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 mt-4 pt-4 border-t border-border/40">
                <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Venue / Location Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parish Main Sanctuary, Barangay Chapel, or Home Address"
                  value={venueAddress}
                  onChange={e => setVenueAddress(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-border rounded-button focus-ring text-text-primary transition-colors outline-none"
                />
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handlePrev} disabled={submitting}>Back</Button>
                <Button onClick={handleBook} loading={submitting} disabled={!selectedTimeSlot || availableSlots.length === 0}>
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
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default EventSchedulerPage;
