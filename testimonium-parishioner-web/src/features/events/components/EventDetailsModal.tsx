import React, { useState, useCallback } from 'react';
import { Calendar, Clock, MapPin, Building, User, Phone, Share2, Clipboard, Globe, Check, AlertCircle, Download } from 'lucide-react';
import type { Event } from '../../../types';
import { getEventCountdownLabel } from '../../../utils/date';
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
  const stamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
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

// ─── Inline action feedback states ──────────────────────────────────────────

type FeedbackState = 'idle' | 'success' | 'error';

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  isOpen,
  onClose,
  onViewParish
}) => {
  if (!event) return null;

  const countdown = getEventCountdownLabel(event.startDate);

  // Per-action inline feedback states (no browser alert())
  const [calendarFeedback, setCalendarFeedback] = useState<FeedbackState>('idle');
  const [shareFeedback, setShareFeedback] = useState<FeedbackState>('idle');
  const [shareError, setShareError] = useState('');

  const resetFeedback = (setter: React.Dispatch<React.SetStateAction<FeedbackState>>) => {
    setTimeout(() => setter('idle'), 2500);
  };

  const getCategoryColor = (category: Event['category']): "ready" | "pending" | "under-review" | "rejected" | "neutral" | "crimson" | undefined => {
    switch (category) {
      case 'Holy Mass': return 'ready';
      case 'Fiesta': return 'under-review';
      case 'Seminar': return 'neutral';
      case 'Youth': return 'pending';
      case 'Formation': return 'neutral';
      case 'Retreat': return 'under-review';
      case 'Outreach': return 'ready';
      case 'Community': return 'ready';
      case 'Diocesan Event': return 'pending';
      case 'Sacramental': return 'neutral';
      default: return 'neutral';
    }
  };

  const handleAddToCalendar = useCallback(() => {
    try {
      downloadEventIcs(event);
      setCalendarFeedback('success');
      resetFeedback(setCalendarFeedback);
    } catch {
      setCalendarFeedback('error');
      resetFeedback(setCalendarFeedback);
    }
  }, [event]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard/events?id=${event.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => {
          setShareFeedback('success');
          setShareError('');
          resetFeedback(setShareFeedback);
        },
        () => {
          setShareFeedback('error');
          setShareError('Unable to copy. Please copy the URL manually.');
          resetFeedback(setShareFeedback);
        }
      );
    } else {
      setShareFeedback('error');
      setShareError('Clipboard not supported in this browser.');
      resetFeedback(setShareFeedback);
    }
  }, [event.id]);

  const handleDirections = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location + ', ' + event.parishName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event.title} size="xl">
      <div className="space-y-6 text-sm text-text-primary">
        {/* Banner Section */}
        <div className="relative h-60 w-full rounded-card overflow-hidden bg-border">
          <img 
            src={event.coverImage} 
            alt={event.coverImageAlt}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 z-10 flex space-x-2 items-center">
            <Badge variant={getCategoryColor(event.category)} className="capitalize py-1 px-3">
              {event.category}
            </Badge>
            <div className="bg-crimson text-white text-[10px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-full shadow">
              {countdown}
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Columns: Main Details (Col-span 2) */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest mb-1.5">Description</h3>
              <p className="text-text-muted leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                {event.description}
              </p>
            </div>

            {/* Gallery placeholder if exists */}
            {event.gallery && event.gallery.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest mb-2">Event Photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {event.gallery.map((img, i) => (
                    <div key={i} className="h-16 rounded overflow-hidden bg-border">
                      <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practical Parish Registration Guidelines */}
            <div className="p-4 bg-app-base border border-border/60 rounded-card space-y-2">
              <h4 className="font-serif font-bold text-text-primary text-xs flex items-center space-x-1.5">
                <Clipboard size={14} className="text-crimson" />
                <span>Attendance & Registration Guidelines</span>
              </h4>
              <p className="text-text-muted text-[11px] leading-relaxed">
                {event.registrationRequired 
                  ? "Pre-registration is required for this parish service to ensure materials and seats are properly allocated. Please complete booking slots early." 
                  : "This is an open event. All parishioners, guests, and neighboring vicariate congregations are welcome to attend without prior registration."}
              </p>
              {event.registrationRequired && event.currentParticipants !== undefined && event.maxParticipants !== undefined && (
                <div className="flex items-center justify-between text-[11px] pt-1 text-text-primary font-semibold">
                  <span>Available Seats / Capacity:</span>
                  <span className="text-crimson">
                    {event.maxParticipants - event.currentParticipants} slots left
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Schedule & Coordinates (Col-span 1) */}
          <div className="space-y-5 bg-app-page/40 p-4 rounded-card border border-border/50 h-fit">
            <div>
              <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-wider mb-2.5">Event Coordinates</h4>
              <div className="space-y-3.5 text-xs text-text-muted">
                <div className="flex items-start space-x-2">
                  <Building size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary block text-[11px]">Parish Office</span>
                    <span className="text-[11px]">{event.parishName}</span>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Calendar size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary block text-[11px]">Date</span>
                    <span className="text-[11px]">{new Date(event.startDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    {event.endDate !== event.startDate && (
                      <span className="block text-[10px] text-text-muted">Until {new Date(event.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Clock size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary block text-[11px]">Time Schedule</span>
                    <span className="text-[11px]">{event.startTime} - {event.endTime}</span>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary block text-[11px]">Venue Location</span>
                    <span className="text-[11px] leading-relaxed">{event.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-wider mb-2.5">Organizers & Contacts</h4>
              <div className="space-y-3.5 text-xs text-text-muted">
                <div className="flex items-start space-x-2">
                  <User size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary block text-[11px]">Organizer</span>
                    <span className="text-[11px]">{event.organizer}</span>
                  </div>
                </div>
                {event.contactPerson && (
                  <div className="flex items-start space-x-2">
                    <Phone size={16} className="text-crimson/70 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-text-primary block text-[11px]">Contact Coordinator</span>
                      <span className="text-[11px]">{event.contactPerson}</span>
                      <span className="block text-[10px] font-mono text-text-muted mt-0.5">{event.contactNumber}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Share error feedback (inline, below actions) */}
        {shareFeedback === 'error' && shareError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-medium">
            <AlertCircle size={13} className="flex-shrink-0" />
            {shareError}
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2.5 pt-4 border-t border-border/80 justify-end">
          {/* Share button with inline feedback */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className={`flex items-center space-x-1 transition-colors ${
              shareFeedback === 'success'
                ? 'border-green-500 text-green-700 bg-green-50'
                : shareFeedback === 'error'
                ? 'border-red-400 text-red-600'
                : ''
            }`}
          >
            {shareFeedback === 'success' ? (
              <><Check size={14} /><span>Copied!</span></>
            ) : shareFeedback === 'error' ? (
              <><AlertCircle size={14} /><span>Failed</span></>
            ) : (
              <><Share2 size={14} /><span>Share</span></>
            )}
          </Button>

          {/* Add to Calendar button with inline feedback */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddToCalendar}
            className={`flex items-center space-x-1 transition-colors ${
              calendarFeedback === 'success'
                ? 'border-green-500 text-green-700 bg-green-50'
                : calendarFeedback === 'error'
                ? 'border-red-400 text-red-600'
                : ''
            }`}
          >
            {calendarFeedback === 'success' ? (
              <><Check size={14} /><span>Downloaded!</span></>
            ) : calendarFeedback === 'error' ? (
              <><AlertCircle size={14} /><span>Failed</span></>
            ) : (
              <><Download size={14} /><span>Add to Calendar</span></>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={handleDirections} className="flex items-center space-x-1">
            <MapPin size={14} />
            <span>Get Directions</span>
          </Button>
          {onViewParish && (
            <Button size="sm" onClick={() => onViewParish(event.parishId)} className="flex items-center space-x-1">
              <Globe size={14} />
              <span>View Parish</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
export default EventDetailsModal;
