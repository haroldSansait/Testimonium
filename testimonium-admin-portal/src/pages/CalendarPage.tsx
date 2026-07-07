import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, MapPin, User, CheckCircle } from 'lucide-react';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';
import { CalendarService } from '@/services/CalendarService';
import { cn } from '@/utils/cn';
import type { CalendarEvent } from '@/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type CalendarView = 'Month' | 'Week' | 'Day';

interface EventDetailsModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

function EventDetailsModal({ event, onClose }: EventDetailsModalProps) {
  const dateStr = `${MONTH_NAMES[event.month]} ${event.day}, ${event.year}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-[#7B1C2A] text-white">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 opacity-90" />
            <div>
              <h2 className="text-base font-bold tracking-wide leading-tight">Event Details</h2>
              <p className="text-[10px] text-white/80 uppercase tracking-widest mt-0.5">Read-Only View</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          {/* Title */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Event Title</span>
            <p className="text-base font-bold text-gray-900 mt-0.5">{event.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs">{dateStr}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs">{event.time}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parish Location</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs">{event.parish || 'Main Church'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Priest</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs">{event.priest || 'TBD'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requestor</span>
              <div className="flex items-center gap-2 text-gray-700 mt-1">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-xs">{event.requestor || 'Anonymous'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-xs text-gray-900">{event.status || 'Confirmed'}</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</span>
            <p className="text-gray-600 mt-1 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs">
              {event.description || 'No description provided.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const now = new Date();
  const location = useLocation();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<CalendarView>('Month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    void CalendarService.getEvents(year, month).then(setEvents);
  }, [year, month]);

  // Listen to router navigation state to auto-open event details (e.g. from Today's Schedule)
  useEffect(() => {
    if (location.state?.eventId && events.length > 0) {
      const match = events.find((e) => e.id === location.state.eventId);
      if (match) {
        setSelectedEvent(match);
      }
    }
  }, [location.state, events]);

  const handlePrev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const handleNext = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  // Highlight today only if viewing current month
  const todayDay =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : undefined;

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1
            className="text-4xl font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {MONTH_NAMES[month]} {year}
          </h1>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-2 text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Previous month"
              id="calendar-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              id="calendar-today"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Next month"
              id="calendar-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
          {(['Month', 'Week', 'Day'] as CalendarView[]).map((v) => (
            <button
              key={v}
              id={`calendar-view-${v.toLowerCase()}`}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-all',
                view === v
                  ? 'bg-crimson-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <CalendarGrid
          year={year}
          month={month}
          events={events}
          today={todayDay}
          onEventClick={setSelectedEvent}
        />
        <CalendarLegend />
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
