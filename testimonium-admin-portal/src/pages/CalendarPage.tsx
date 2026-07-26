import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, MapPin, User, CheckCircle, Download, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { CalendarService } from '@/services/CalendarService';
import { UserManagementService } from '@/services/UserManagementService';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import type { CalendarEvent, ManagedUser } from '@/types';
import { downloadIcsFile, buildGoogleCalendarUrl, getUpcomingEvent } from '@/utils/calendarExport';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type CalendarView = 'Month' | 'Week' | 'Day';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  variant = 'success',
  onClose,
}: {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4 ${
        variant === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
      }`}
    >
      {variant === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ─── Export Menu ──────────────────────────────────────────────────────────────

function ExportMenu({
  events,
  year,
  month,
  onSuccess,
  onError,
}: {
  events: CalendarEvent[];
  year: number;
  month: number;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const monthName = MONTH_NAMES[month];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDownloadIcs = () => {
    setOpen(false);
    const result = downloadIcsFile(events, year, month);
    if (result) {
      onSuccess(`${monthName} ${year} calendar downloaded as .ics file.`);
    } else {
      onError('No events found for this month to export.');
    }
  };

  const handleGoogleCalendar = () => {
    setOpen(false);
    const upcoming = getUpcomingEvent(events, year, month);
    if (!upcoming) {
      onError('No events found for this month to sync.');
      return;
    }
    const url = buildGoogleCalendarUrl(upcoming);
    window.open(url, '_blank', 'noopener,noreferrer');
    onSuccess('Opening event in Google Calendar...');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        id="calendar-export-btn"
      >
        <Download className="w-3.5 h-3.5" />
        Export Calendar
        <span className="ml-0.5 text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={handleDownloadIcs}
            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            id="calendar-export-ics"
          >
            <Download className="w-3.5 h-3.5 text-gray-400" />
            <div className="text-left">
              <div className="font-semibold">Download .ics File</div>
              <div className="text-[10px] text-gray-400">{monthName} {year} — all events</div>
            </div>
          </button>
          <div className="h-px bg-gray-100" />
          <button
            onClick={handleGoogleCalendar}
            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            id="calendar-export-google"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            <div className="text-left">
              <div className="font-semibold">Open in Google Calendar</div>
              <div className="text-[10px] text-gray-400">Next upcoming event</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

interface EventDetailsModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

function EventDetailsModal({ event, onClose }: EventDetailsModalProps) {
  const dateStr = `${MONTH_NAMES[event.month]} ${event.day}, ${event.year}`;

  return createPortal(
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
    </div>,
    document.body
  );
}

interface CreateEventModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg: string) => void;
  parishId?: string;
}

function CreateParishEventModal({ onClose, onSuccess, onError, parishId }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('MASS');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('10:00 AM');
  const [location, setLocation] = useState('Parish Main Church');
  const [priests, setPriests] = useState<any[]>([]);
  const [assignedPriestId, setAssignedPriestId] = useState('');
  const [description, setDescription] = useState('');
  const [loadingPriests, setLoadingPriests] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPriests = async () => {
      setLoadingPriests(true);
      try {
        const list = await UserManagementService.getUsers({
          role: 'PRIEST',
          parishId: parishId || undefined
        });
        setPriests(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPriests(false);
      }
    };
    void fetchPriests();
  }, [parishId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await CalendarService.createParishEvent({
        title,
        eventType,
        eventDate,
        startTime,
        endTime,
        location,
        assignedPriestId: assignedPriestId || undefined,
        description,
        parishId: parishId || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      if (onError) onError(err.message || 'Failed to create parish event.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white">
          <h3 className="font-bold text-sm tracking-wide">Create Parish Event</h3>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={e => void handleSubmit(e)} className="p-6 overflow-y-auto space-y-4 text-xs font-semibold text-gray-500">
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Marriage Pre-Cana Seminar"
              className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider">Event Type</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-800 font-medium focus:border-[#7B1C2A]"
              >
                <option value="MASS">Holy Mass</option>
                <option value="BAPTISM">Baptism</option>
                <option value="WEDDING">Wedding</option>
                <option value="CONFIRMATION">Confirmation</option>
                <option value="FUNERAL">Funeral</option>
                <option value="FIESTA">Fiesta</option>
                <option value="SEMINAR">Seminar</option>
                <option value="OTHER">Other Event</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider">Event Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider">Start Time</label>
              <input
                type="text"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                placeholder="e.g. 09:00 AM"
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider">End Time</label>
              <input
                type="text"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Parish Main Sanctuary"
              className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider">Assigned Priest</label>
            <select
              value={assignedPriestId}
              onChange={e => setAssignedPriestId(e.target.value)}
              disabled={loadingPriests}
              className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-800 font-medium focus:border-[#7B1C2A]"
            >
              <option value="">{loadingPriests ? 'Loading Priests...' : 'Select Assigned Priest...'}</option>
              {priests.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.role === 'PRIEST' ? 'Parish Priest' : 'Assistant Priest'})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter additional details or instructions for this event..."
              rows={3}
              className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-600 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#7B1C2A] hover:bg-[#9B2C3A] text-white rounded-lg font-bold"
            >
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

interface PriestColorSettingsModalProps {
  parishId?: string;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg: string) => void;
}

const PRESET_SWATCHES = [
  '#D97706', // amber
  '#4F46E5', // indigo
  '#059669', // emerald
  '#E11D48', // rose
  '#0891B2', // cyan
  '#9333EA', // purple
  '#EA580C', // orange
  '#0D9488', // teal
];

function PriestColorSettingsModal({ parishId, onClose, onSuccess, onError }: PriestColorSettingsModalProps) {
  const [priests, setPriests] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPriestId, setSavingPriestId] = useState<string | null>(null);

  const fetchPriests = useCallback(async () => {
    setLoading(true);
    try {
      const list = await UserManagementService.getUsers({
        role: 'PRIEST',
        parishId: parishId || undefined,
      });
      setPriests(list);
    } catch (err: any) {
      console.error(err);
      if (onError) onError('Failed to load priests.');
    } finally {
      setLoading(false);
    }
  }, [parishId, onError]);

  useEffect(() => {
    void fetchPriests();
  }, [fetchPriests]);

  const handleSelectColor = async (priestId: string, color: string | null) => {
    setSavingPriestId(priestId);
    try {
      await UserManagementService.updateUserColor(priestId, color);
      void fetchPriests();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (onError) onError('Failed to update color.');
    } finally {
      setSavingPriestId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm tracking-wide">Priest Color Settings</h3>
            <p className="text-[10px] text-white/70 mt-0.5 uppercase tracking-widest">Assign Calendar Color Badges</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10" aria-label="Close modal">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-[#7B1C2A] rounded-full animate-spin" />
            </div>
          ) : priests.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No priests registered for this parish.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {priests.map((priest) => (
                <div key={priest.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{priest.name}</h4>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">{priest.role.replace('_', ' ')}</p>
                    </div>
                    {savingPriestId === priest.id && (
                      <span className="text-[10px] text-gray-400 font-semibold animate-pulse">Saving...</span>
                    )}
                  </div>
                  
                  {/* Swatches */}
                  <div className="flex flex-wrap gap-2.5 items-center pt-1">
                    {/* Default Fallback Dot */}
                    <button
                      onClick={() => void handleSelectColor(priest.id, null)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center bg-gray-50 text-[10px] text-gray-500 font-bold",
                        !priest.color ? "border-gray-800 scale-110 shadow-sm" : "border-gray-200 hover:border-gray-400"
                      )}
                      title="Default Palette"
                    >
                      ×
                    </button>
                    {PRESET_SWATCHES.map((swatchColor) => (
                      <button
                        key={swatchColor}
                        onClick={() => void handleSelectColor(priest.id, swatchColor)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all",
                          priest.color === swatchColor ? "scale-110 border-gray-800 shadow-sm" : "border-transparent hover:border-gray-300"
                        )}
                        style={{ backgroundColor: swatchColor }}
                        title={swatchColor}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-150 flex justify-end bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface MoreEventsModalProps {
  day: number;
  month: number;
  year: number;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (evt: CalendarEvent) => void;
}

function MoreEventsModal({ day, month, year, events, onClose, onEventClick }: MoreEventsModalProps) {
  const dateStr = `${MONTH_NAMES[month]} ${day}, ${year}`;
  
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm tracking-wide">All Events</h3>
            <p className="text-[10px] text-white/70 mt-0.5">{dateStr}</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10" aria-label="Close modal">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-2">
          {events.map((evt) => (
            <div 
              key={evt.id}
              onClick={() => {
                onEventClick(evt);
                onClose();
              }}
              className="p-3 border border-gray-150 hover:border-gray-300 rounded-xl hover:bg-gray-50/50 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#7B1C2A]">{evt.time}</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {evt.category}
                </span>
              </div>
              <h4 className="text-xs font-bold text-gray-800 mt-1 truncate">{evt.title}</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">Priest: {evt.priest || 'TBD'}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-150 flex justify-end bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-600 bg-white text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CalendarPage() {
  const now = new Date();
  const location = useLocation();
  const { applicationUser } = useAuth();
  const parishId = applicationUser?.parishId;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const showToast = (message: string, variant: 'success' | 'error' = 'success') =>
    setToast({ message, variant });

  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [view, setView] = useState<CalendarView>('Month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [priests, setPriests] = useState<ManagedUser[]>([]);
  const [showPriestSettings, setShowPriestSettings] = useState(false);
  const [moreEventsDay, setMoreEventsDay] = useState<{ day: number; events: CalendarEvent[] } | null>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  useEffect(() => {
    void CalendarService.getEvents(year, month).then(setEvents);
  }, [year, month]);

  const fetchPriests = useCallback(async () => {
    if (!parishId) return;
    try {
      const list = await UserManagementService.getUsers({
        role: 'PRIEST',
        parishId: String(parishId),
      });
      setPriests(list);
    } catch (err) {
      console.error('Failed to load priests for legend:', err);
    }
  }, [parishId]);

  useEffect(() => {
    void fetchPriests();
  }, [fetchPriests]);

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
    setSelectedDate((prev) => {
      const nextDate = new Date(prev);
      if (view === 'Month') {
        nextDate.setMonth(nextDate.getMonth() - 1);
      } else if (view === 'Week') {
        nextDate.setDate(nextDate.getDate() - 7);
      } else if (view === 'Day') {
        nextDate.setDate(nextDate.getDate() - 1);
      }
      return nextDate;
    });
  };

  const handleNext = () => {
    setSelectedDate((prev) => {
      const nextDate = new Date(prev);
      if (view === 'Month') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (view === 'Week') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (view === 'Day') {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Highlight today only if viewing current month
  const todayDay =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : undefined;

  const getHeaderTitle = () => {
    if (view === 'Month') {
      return `${MONTH_NAMES[month]} ${year}`;
    } else if (view === 'Week') {
      const getStartOfWeek = (d: Date) => {
        const temp = new Date(d);
        const day = temp.getDay();
        temp.setDate(temp.getDate() - day);
        return temp;
      };
      const start = getStartOfWeek(selectedDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const format = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${format(start)} – ${format(end)}, ${end.getFullYear()}`;
    } else {
      return selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1
            className="text-4xl font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {getHeaderTitle()}
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

        {/* View toggle & Create Event + Export button */}
        <div className="flex items-center gap-3">
          <ExportMenu
            events={events}
            year={year}
            month={month}
            onSuccess={(msg) => showToast(msg, 'success')}
            onError={(msg) => showToast(msg, 'error')}
          />
          {parishId && (
            <button
              onClick={() => setShowPriestSettings(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Priest Colors
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-[#7B1C2A] text-white rounded-lg hover:bg-[#9B2C3A] transition-colors shadow-sm"
          >
            + Create Parish Event
          </button>
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
      </div>

      {/* Calendar Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {view === 'Month' && (
          <CalendarGrid
            year={year}
            month={month}
            events={events}
            today={todayDay}
            onEventClick={setSelectedEvent}
            onMoreClick={(day, dayEvents) => {
              setMoreEventsDay({ day, events: dayEvents });
            }}
          />
        )}

        {view === 'Week' && (
          <CalendarWeekView
            currentDate={selectedDate}
            events={events}
            onEventClick={setSelectedEvent}
          />
        )}

        {view === 'Day' && (
          <CalendarDayView
            currentDate={selectedDate}
            events={events}
            onEventClick={setSelectedEvent}
          />
        )}

        <CalendarLegend priests={priests} />
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Create Parish Event Modal */}
      {showCreateModal && (
        <CreateParishEventModal
          parishId={parishId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => void CalendarService.getEvents(year, month).then(setEvents)}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Priest Color Settings Modal */}
      {showPriestSettings && (
        <PriestColorSettingsModal
          parishId={parishId ? String(parishId) : undefined}
          onClose={() => setShowPriestSettings(false)}
          onSuccess={() => {
            void fetchPriests();
            void CalendarService.getEvents(year, month).then(setEvents);
            showToast('Priest color updated successfully!', 'success');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* More Events Popover Modal */}
      {moreEventsDay && (
        <MoreEventsModal
          day={moreEventsDay.day}
          month={month}
          year={year}
          events={moreEventsDay.events}
          onClose={() => setMoreEventsDay(null)}
          onEventClick={setSelectedEvent}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
