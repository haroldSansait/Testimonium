import React, { useState, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Building, 
  User, 
  Phone, 
  Globe, 
  Check, 
  AlertCircle, 
  Download,
  CalendarPlus,
  Users,
  Navigation
} from 'lucide-react';
import type { Event } from '../../../types';
import { getEventCountdownLabel, formatEventCalendarDate } from '../../../utils/date';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

interface EventDetailsModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onViewParish?: (parishId: string) => void;
}

// ─── ICS Download Utility (parishioner events) ──────────────────────────────

function buildEventIcs(event: Event): string {
  const now = new Date();
  const stamp = now.toISOString().replace(new RegExp('[-' + '.:]', 'g'), '').slice(0, 15) + 'Z';
  const startDate = event.startDate.replace(/-/g, '');
  const endDate = event.endDate.replace(/-/g, '');

  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TESTIMONIUM//Parish Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:testimonium-event-${event.id}@testimonium.parish`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${escape(event.title)}`,
    `LOCATION:${escape(event.location + ', ' + event.parishName)}`,
    `DESCRIPTION:${escape(event.description || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadEventIcs(event: Event) {
  const content = buildEventIcs(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Category Color Helper ──────────────────────────────────────────────────

const getCategoryColor = (category: Event['category']): "ready" | "pending" | "under-review" | "rejected" | "neutral" | "crimson" | undefined => {
  switch (category) {
    case 'Holy Mass': return 'ready';
    case 'Baptism': return 'pending';
    case 'Wedding': return 'neutral';
    case 'Confirmation': return 'under-review';
    case 'Funeral': return 'rejected';
    case 'Fiesta': return 'under-review';
    case 'Seminar': return 'neutral';
    default: return 'neutral';
  }
};

// ─── Inline action feedback states ──────────────────────────────────────────

type FeedbackState = 'idle' | 'success' | 'error';

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event: incomingEvent,
  isOpen,
  onClose,
  onViewParish
}) => {
  // Preserve last valid event reference during closing unmount animation
  const lastEventRef = React.useRef<Event | null>(incomingEvent);
  if (incomingEvent) {
    lastEventRef.current = incomingEvent;
  }
  const event = incomingEvent || lastEventRef.current;

  // Per-action inline feedback states (no browser alert())
  const [calendarFeedback, setCalendarFeedback] = useState<FeedbackState>('idle');

  const resetFeedback = (setter: React.Dispatch<React.SetStateAction<FeedbackState>>) => {
    setTimeout(() => setter('idle'), 2500);
  };

  const handleAddToCalendar = useCallback(() => {
    if (!event) return;
    try {
      downloadEventIcs(event);
      setCalendarFeedback('success');
      resetFeedback(setCalendarFeedback);
    } catch {
      setCalendarFeedback('error');
      resetFeedback(setCalendarFeedback);
    }
  }, [event]);

  if (!event) return null;

  const handleDirections = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location + ', ' + event.parishName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleExportGoogleCalendar = () => {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`${event.description || ''}\n\nParish: ${event.parishName}\nLocation: ${event.location}`);
    const location = encodeURIComponent(`${event.location}, ${event.parishName}`);
    
    const dateStr = event.startDate.replace(/-/g, '');
    const startTimeStr = event.startTime ? event.startTime.replace(/[^0-9]/g, '').padEnd(4, '0') + '00' : '080000';
    const endTimeStr = event.endTime ? event.endTime.replace(/[^0-9]/g, '').padEnd(4, '0') + '100000' : '100000';
    
    const dates = `${dateStr}T${startTimeStr}/${dateStr}T${endTimeStr}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const countdown = getEventCountdownLabel(event.startDate, event.startTime);
  const participantPercentage = event.maxParticipants && event.currentParticipants !== undefined
    ? Math.min(100, Math.round((event.currentParticipants / event.maxParticipants) * 100))
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Details"
      size="3xl"
      animated
    >
      <div className="space-y-5 pt-1">
        {/* Header Media / Cover Banner Hero */}
        <div className="relative h-48 sm:h-56 w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-md">
          <img
            src={event.coverImage}
            alt={event.coverImageAlt || event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Top Overlays */}
          <div className="absolute top-3.5 left-4 flex items-center gap-2 z-10">
            <Badge variant={getCategoryColor(event.category)} className="py-1 px-3 font-bold text-xs shadow-sm backdrop-blur-md">
              {event.category}
            </Badge>
          </div>

          <div className="absolute top-3.5 right-4 z-10">
            <div className="bg-crimson text-white text-[11px] font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-md backdrop-blur-sm border border-white/20">
              {countdown}
            </div>
          </div>

          {/* Bottom Title & Parish Overlay */}
          <div className="absolute bottom-4 left-4 right-4 text-white z-10">
            <h3 className="font-serif font-bold text-lg sm:text-2xl leading-tight drop-shadow-md text-white">
              {event.title}
            </h3>
            <p className="text-xs sm:text-sm text-white/90 flex items-center gap-1.5 mt-1 drop-shadow font-medium">
              <Building size={14} className="text-red-300 flex-shrink-0" />
              <span>{event.parishName}</span>
            </p>
          </div>
        </div>

        {/* Action Feedback Alerts */}
        {calendarFeedback === 'success' && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
            <Check size={15} className="text-emerald-600 flex-shrink-0" />
            <span>Event calendar file (.ics) downloaded. Open it to sync with your device calendar.</span>
          </div>
        )}
        {calendarFeedback === 'error' && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
            <AlertCircle size={15} className="text-red-600 flex-shrink-0" />
            <span>Could not download calendar file. Please try again.</span>
          </div>
        )}

        {/* Proportional 2-Column Content Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-left items-start">
          {/* Left Column: Event Overview & Context (Col-span 7) */}
          <div className="md:col-span-7 space-y-4">
            {/* About Section */}
            <div className="bg-app-page/50 p-4 sm:p-5 rounded-xl border border-border/60 space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                <div className="w-1.5 h-3.5 bg-crimson rounded-full" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">About This Event</h4>
              </div>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed whitespace-pre-line">
                {event.description || 'Join our parish community for holy sacrifice and prayers.'}
              </p>
            </div>

            {/* Registration & Capacity status (if active) */}
            {event.registrationRequired && (
              <div className="bg-app-page/50 p-4 rounded-xl border border-border/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-text-primary">
                    <Users size={14} className="text-crimson" />
                    <span>Registration & Slots</span>
                  </div>
                  <span className="text-xs font-bold text-crimson uppercase tracking-wider bg-red-50 py-0.5 px-2.5 rounded-full border border-crimson/20">
                    Required
                  </span>
                </div>
                {event.maxParticipants && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-text-muted font-medium">
                      <span>{event.currentParticipants || 0} slots reserved</span>
                      <span>{event.maxParticipants} max capacity</span>
                    </div>
                    <div className="w-full h-2 bg-border/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-crimson rounded-full transition-all duration-500" 
                        style={{ width: `${participantPercentage}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parish Community Note */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-crimson/5 border border-crimson/15 text-xs text-text-primary">
              <div className="p-2 bg-crimson/10 rounded-lg text-crimson flex-shrink-0">
                <Building size={16} />
              </div>
              <div>
                <span className="font-bold text-[12px] block text-text-primary">{event.parishName}</span>
                <span className="text-[11px] text-text-muted">Diocese of San Carlos • Vicariate Community</span>
              </div>
            </div>
          </div>

          {/* Right Column: Schedule, Coordinates & Contacts (Col-span 5) */}
          <div className="md:col-span-5 space-y-4">
            {/* Schedule & Location Card */}
            <div className="bg-app-page/50 p-4 rounded-xl border border-border/60 space-y-3.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                <Calendar size={14} className="text-crimson" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Schedule & Venue</h4>
              </div>

              <div className="space-y-3 text-xs">
                {/* Date */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-crimson/10 rounded-lg text-crimson mt-0.5 flex-shrink-0">
                    <Calendar size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-text-primary block text-[11px]">Date</span>
                    <span className="text-text-muted text-[11px] block leading-snug">
                      {formatEventCalendarDate(event.startDate, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {event.endDate !== event.startDate && (
                      <span className="block text-[10px] text-text-muted font-medium mt-0.5">
                        Until {formatEventCalendarDate(event.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-crimson/10 rounded-lg text-crimson mt-0.5 flex-shrink-0">
                    <Clock size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-text-primary block text-[11px]">Time Schedule</span>
                    <span className="text-text-muted text-[11px] block font-medium">
                      {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                    </span>
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-crimson/10 rounded-lg text-crimson mt-0.5 flex-shrink-0">
                    <MapPin size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-text-primary block text-[11px]">Venue Location</span>
                    <span className="text-text-muted text-[11px] leading-relaxed block">
                      {event.location}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Organizers & Contacts Card */}
            <div className="bg-app-page/50 p-4 rounded-xl border border-border/60 space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                <User size={14} className="text-crimson" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Organizers & Contacts</h4>
              </div>

              <div className="space-y-3 text-xs">
                {/* Organizer */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-crimson/10 rounded-lg text-crimson mt-0.5 flex-shrink-0">
                    <Building size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-text-primary block text-[11px]">Organizer</span>
                    <span className="text-text-muted text-[11px] block">{event.organizer || 'Parish Office'}</span>
                  </div>
                </div>

                {/* Contact Secretary */}
                {event.contactPerson && (
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-crimson/10 rounded-lg text-crimson mt-0.5 flex-shrink-0">
                      <Phone size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-text-primary block text-[11px]">Contact Person</span>
                      <span className="text-text-muted text-[11px] block">{event.contactPerson}</span>
                      {event.contactNumber && (
                        <a 
                          href={`tel:${event.contactNumber.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-crimson hover:underline mt-0.5"
                          title="Call contact number"
                        >
                          {event.contactNumber}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/80">
          {/* Google Calendar Link */}
          <button
            type="button"
            onClick={handleExportGoogleCalendar}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-crimson transition-colors py-1.5 px-2 rounded-lg hover:bg-red-50/50"
            title="Open in Google Calendar"
          >
            <CalendarPlus size={14} className="text-crimson" />
            <span>Google Calendar</span>
          </button>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* Add to Calendar (.ics) button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToCalendar}
              className={`flex items-center space-x-1.5 transition-colors text-xs font-semibold ${
                calendarFeedback === 'success'
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : calendarFeedback === 'error'
                  ? 'border-red-400 text-red-600'
                  : ''
              }`}
            >
              {calendarFeedback === 'success' ? (
                <><Check size={13} /><span>Downloaded!</span></>
              ) : calendarFeedback === 'error' ? (
                <><AlertCircle size={13} /><span>Failed</span></>
              ) : (
                <><Download size={13} /><span>.ICS File</span></>
              )}
            </Button>

            {/* Directions button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDirections} 
              className="flex items-center space-x-1.5 text-xs font-semibold"
            >
              <Navigation size={13} />
              <span>Directions</span>
            </Button>

            {/* View Parish button */}
            {onViewParish && (
              <Button 
                size="sm" 
                onClick={() => onViewParish(event.parishId)} 
                className="bg-crimson hover:bg-crimson-dark text-white flex items-center space-x-1.5 text-xs font-semibold shadow-xs"
              >
                <Globe size={13} />
                <span>View Parish</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EventDetailsModal;
