import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  MapPin,
  User,
  CheckCircle,
  Download,
  ExternalLink,
  Check,
  AlertCircle,
  Building2,
  Palette,
  Plus,
} from 'lucide-react';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CalendarService } from '@/services/CalendarService';
import { UserManagementService } from '@/services/UserManagementService';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { cn } from '@/utils/cn';
import { Tooltip } from '@/components/ui/Tooltip';

import { downloadIcsFile, buildGoogleCalendarUrl, getUpcomingEvent } from '@/utils/calendarExport';
import { ParishManagementService } from '@/services/ParishManagementService';
import { to24Hour, to12Hour, isValidTimeRange } from '@/utils/date';
import type { CalendarEvent, ManagedUser, Parish } from '@/types';

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
  onSuccess?: () => void;
  role?: string;
}

function EventDetailsModal({ event, onClose, onSuccess, role }: EventDetailsModalProps) {
  const dateStr = `${MONTH_NAMES[event.month]} ${event.day}, ${event.year}`;
  
  const canEdit = (role === 'DIOCESE_COORDINATOR' || role === 'SECRETARY') && event.sourceType === 'PARISH_EVENT';
  
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState(event.location || event.parish || 'Vicariate Pastoral Center (Default)');
  const [editDescription, setEditDescription] = useState(event.description || '');

  const initialStartTime = event.time && event.time.includes(' - ')
    ? event.time.split(' - ')[0]
    : event.time && event.time !== 'All Day' ? event.time : '09:00 AM';
  const initialEndTime = event.time && event.time.includes(' - ')
    ? event.time.split(' - ')[1]
    : '12:00 PM';

  const [editStartTime, setEditStartTime] = useState(() => to24Hour(initialStartTime) || '09:00');
  const [editEndTime, setEditEndTime] = useState(() => to24Hour(initialEndTime) || '12:00');
  const [editVisibility, setEditVisibility] = useState<'PUBLIC' | 'PARISH_PRIVATE'>(event.visibility || 'PUBLIC');
  const [saving, setSaving] = useState(false);

  const isEditTimeRangeInvalid = Boolean(editStartTime && editEndTime && !isValidTimeRange(editStartTime, editEndTime));

  const handleSave = async () => {
    if (isEditTimeRangeInvalid) return;
    setSaving(true);
    try {
      const isDynamic = event.id.startsWith('event-vicariate-meeting-');
      const payload = {
        title: "Vicariate Meeting",
        eventType: "OTHER",
        eventDate: `${event.year}-${String(event.month + 1).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`,
        startTime: to12Hour(editStartTime),
        endTime: to12Hour(editEndTime),
        location: editLocation,
        description: editDescription,
        visibility: editVisibility,
        ...(!isDynamic && event.version ? { expectedVersion: event.version } : {}),
      };

      if (isDynamic) {
        await CalendarService.createParishEvent(payload);
      } else {
        const dbId = event.id.replace('event-', '');
        await CalendarService.updateParishEvent(dbId, payload);
      }
      if (onSuccess) onSuccess();
      setIsEditing(false);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save event details");
    } finally {
      setSaving(false);
    }
  };

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
              <p className="text-[10px] text-white/80 uppercase tracking-widest mt-0.5">
                {canEdit ? 'Coordinator Managed' : 'Read-Only View'}
              </p>
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
          {isEditing ? (
            <div className="space-y-4 text-xs font-semibold text-gray-500">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Visibility</label>
                <CustomSelect
                  value={editVisibility}
                  onChange={(val) => setEditVisibility(val as 'PUBLIC' | 'PARISH_PRIVATE')}
                  options={[
                    { value: 'PUBLIC', label: 'Public' },
                    { value: 'PARISH_PRIVATE', label: 'Parish private' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Location Settings</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">Start Time</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">End Time</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                    required
                  />
                </div>
              </div>
              {isEditTimeRangeInvalid && (
                <p className="text-red-600 text-[11px] font-semibold">
                  End time must be later than start time.
                </p>
              )}
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                />
              </div>
            </div>
          ) : (
            <>
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
                    <span className="font-medium text-xs">{event.location || event.parish || 'Main Church'}</span>
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
                 {event.sourceType === 'PARISH_EVENT' && <p className="mt-2 text-xs font-semibold text-gray-500">Visibility: {event.visibility === 'PARISH_PRIVATE' ? 'Parish private' : 'Public'}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50 gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-600 bg-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || isEditTimeRangeInvalid}
                className="px-4 py-2 bg-[#7B1C2A] hover:bg-[#9B2C3A] text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-[#7B1C2A] text-[#7B1C2A] rounded-lg text-xs font-bold hover:bg-red-50/20"
                >
                  Edit Location / Details
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-xs"
              >
                Close
              </button>
            </>
          )}
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
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('Parish Main Church');
  const [priests, setPriests] = useState<any[]>([]);
  const [assignedPriestId, setAssignedPriestId] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PARISH_PRIVATE'>('PUBLIC');
  const [loadingPriests, setLoadingPriests] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isCreateTimeRangeInvalid = Boolean(startTime && endTime && !isValidTimeRange(startTime, endTime));

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
    if (isCreateTimeRangeInvalid) return;
    setSubmitting(true);
    try {
      await CalendarService.createParishEvent({
        title,
        eventType,
        eventDate,
        startTime: to12Hour(startTime),
        endTime: to12Hour(endTime),
        location,
        assignedPriestId: assignedPriestId || undefined,
        description,
        parishId: parishId || undefined,
        visibility,
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
            <label className="block uppercase tracking-wider">Visibility</label>
            <CustomSelect
              value={visibility}
              onChange={(val) => setVisibility(val as 'PUBLIC' | 'PARISH_PRIVATE')}
              options={[
                { value: 'PUBLIC', label: 'Public' },
                { value: 'PARISH_PRIVATE', label: 'Parish private' },
              ]}
            />
          </div>
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
              <CustomSelect
                value={eventType}
                onChange={setEventType}
                options={[
                  { value: 'MASS', label: 'Holy Mass' },
                  { value: 'BAPTISM', label: 'Baptism' },
                  { value: 'WEDDING', label: 'Wedding' },
                  { value: 'CONFIRMATION', label: 'Confirmation' },
                  { value: 'FUNERAL', label: 'Funeral' },
                  { value: 'BLESSING', label: 'Blessing' },
                  { value: 'FIESTA', label: 'Parish Fiesta' },
                  { value: 'MEETING', label: 'Meeting / Assembly' },
                  { value: 'FORMATION', label: 'Formation / Seminar' },
                  { value: 'CONFESSION', label: 'Confession' },
                  { value: 'OTHER', label: 'Other Ministry' },
                ]}
              />
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
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-[#7B1C2A]"
                required
              />
            </div>
          </div>
          {isCreateTimeRangeInvalid && (
            <p className="text-red-600 text-[11px] font-semibold">
              End time must be later than start time.
            </p>
          )}

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
            <CustomSelect
              value={assignedPriestId}
              onChange={setAssignedPriestId}
              disabled={loadingPriests}
              loading={loadingPriests}
              placeholder={loadingPriests ? 'Loading Priests...' : 'Select Assigned Priest...'}
              options={priests.map((p: any) => ({
                value: String(p.id),
                label: p.name,
                secondary: p.role === 'PRIEST' ? 'Parish Priest' : 'Assistant Priest',
              }))}
            />
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
              disabled={submitting || isCreateTimeRangeInvalid}
              className="px-4 py-2 bg-[#7B1C2A] hover:bg-[#9B2C3A] text-white rounded-lg font-bold disabled:opacity-50"
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
  { hex: '#D97706', name: 'Amber' },
  { hex: '#4F46E5', name: 'Indigo' },
  { hex: '#059669', name: 'Emerald' },
  { hex: '#E11D48', name: 'Rose' },
  { hex: '#0891B2', name: 'Cyan' },
  { hex: '#9333EA', name: 'Purple' },
  { hex: '#EA580C', name: 'Orange' },
  { hex: '#0D9488', name: 'Teal' },
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
                    <Tooltip content="Reset to default palette" side="top">
                      <button
                        onClick={() => void handleSelectColor(priest.id, null)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center bg-gray-50 text-[10px] text-gray-500 font-bold",
                          !priest.color ? "border-gray-800 scale-110 shadow-sm" : "border-gray-200 hover:border-gray-400"
                        )}
                        aria-label="Reset to default palette"
                      >
                        ×
                      </button>
                    </Tooltip>
                    {PRESET_SWATCHES.map((swatch) => (
                      <Tooltip key={swatch.hex} content={`${swatch.name} highlight`} side="top">
                        <button
                          onClick={() => void handleSelectColor(priest.id, swatch.hex)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all",
                            priest.color === swatch.hex ? "scale-110 border-gray-800 shadow-sm" : "border-transparent hover:border-gray-300"
                          )}
                          style={{ backgroundColor: swatch.hex }}
                          aria-label={`Select ${swatch.name} highlight color`}
                        />
                      </Tooltip>
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
  
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [selectedParishFilter, setSelectedParishFilter] = useState<string>(() => {
    return localStorage.getItem('lastSelectedParishId') || '';
  });

  // Effective Parish ID: for Coordinator, use selectedParishFilter; otherwise use user parishId
  const effectiveParishId = applicationUser?.role === 'DIOCESE_COORDINATOR'
    ? (selectedParishFilter || undefined)
    : (applicationUser?.parishId ? String(applicationUser.parishId) : undefined);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  useEffect(() => {
    if (applicationUser?.role === 'DIOCESE_COORDINATOR') {
      void ParishManagementService.getParishes().then(loadedParishes => {
        setParishes(loadedParishes);
        if (loadedParishes.length > 0) {
          const stored = localStorage.getItem('lastSelectedParishId');
          const exists = loadedParishes.some(p => p.id === stored);
          if (stored && exists) {
            setSelectedParishFilter(stored);
          } else {
            localStorage.removeItem('lastSelectedParishId');
            setSelectedParishFilter(loadedParishes[0].id);
            localStorage.setItem('lastSelectedParishId', loadedParishes[0].id);
          }
        }
      }).catch(err => {
        console.error('Failed to load parishes for filter:', err);
      });
    }
  }, [applicationUser]);

  const handleParishChange = (val: string) => {
    setSelectedParishFilter(val);
    localStorage.setItem('lastSelectedParishId', val);
  };

  const fetchCalendarEvents = useCallback(() => {
    if (applicationUser?.role === 'DIOCESE_COORDINATOR' && !selectedParishFilter) {
      return Promise.resolve();
    }
    const filterId = applicationUser?.role === 'DIOCESE_COORDINATOR' ? selectedParishFilter : undefined;
    return CalendarService.getEvents(year, month, filterId).then(setEvents);
  }, [year, month, selectedParishFilter, applicationUser]);

  useEffect(() => {
    void fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  useAutoRefresh(fetchCalendarEvents, { intervalMs: 5000 });

  const fetchPriests = useCallback(async () => {
    if (!effectiveParishId) return;
    try {
      const list = await UserManagementService.getUsers({
        role: 'PRIEST',
        parishId: String(effectiveParishId),
      });
      setPriests(list);
    } catch (err) {
      console.error('Failed to load priests for legend:', err);
    }
  }, [effectiveParishId]);

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

  const getViewSubtitle = () => {
    if (view === 'Month') {
      return 'Monthly schedule overview';
    } else if (view === 'Week') {
      return '7-day schedule breakdown';
    } else {
      return 'Single day chronological timeline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Tier 1: Page Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {getHeaderTitle()}
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7B1C2A]" />
            {getViewSubtitle()}
          </p>
        </div>

        {/* Action Buttons: Export, Priest Colors, Create Event */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <ExportMenu
            events={events}
            year={year}
            month={month}
            onSuccess={(msg) => showToast(msg, 'success')}
            onError={(msg) => showToast(msg, 'error')}
          />
          {effectiveParishId && (
            <button
              onClick={() => setShowPriestSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-xs hover:border-gray-400"
            >
              <Palette className="w-3.5 h-3.5 text-gray-500" />
              <span>Priest Colors</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#7B1C2A] text-white rounded-xl hover:bg-[#9B2C3A] active:bg-[#6A1824] transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Parish Event</span>
          </button>
        </div>
      </div>

      {/* Tier 2: Control & Filter Floating Toolbar Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-2.5 sm:px-4 sm:py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Prev / Today / Next Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <Tooltip
            content={view === 'Month' ? 'Previous month' : view === 'Week' ? 'Previous week' : 'Previous day'}
            side="bottom"
          >
            <button
              onClick={handlePrev}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors shadow-xs"
              aria-label={view === 'Month' ? 'Previous month' : view === 'Week' ? 'Previous week' : 'Previous day'}
              id="calendar-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Tooltip>
          <button
            onClick={handleToday}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-xs",
              selectedDate.toDateString() === now.toDateString()
                ? "bg-[#7B1C2A]/10 border-[#7B1C2A]/30 text-[#7B1C2A]"
                : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
            )}
            id="calendar-today"
          >
            Today
          </button>
          <Tooltip
            content={view === 'Month' ? 'Next month' : view === 'Week' ? 'Next week' : 'Next day'}
            side="bottom"
          >
            <button
              onClick={handleNext}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors shadow-xs"
              aria-label={view === 'Month' ? 'Next month' : view === 'Week' ? 'Next week' : 'Next day'}
              id="calendar-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>


        {/* Center: Coordinator Parish Filter */}
        {applicationUser?.role === 'DIOCESE_COORDINATOR' && parishes.length > 0 && (
          <div className="flex items-center gap-2 bg-gray-50/90 border border-gray-200 px-3 py-1 rounded-xl shadow-xs">
            <Building2 className="w-4 h-4 text-[#7B1C2A] flex-shrink-0" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Parish:
            </span>
            <div className="w-[200px]">
              <CustomSelect
                value={selectedParishFilter}
                onChange={handleParishChange}
                options={parishes.map((p) => ({ value: String(p.id), label: p.name }))}
                searchable
                searchPlaceholder="Search parish..."
              />
            </div>
          </div>
        )}

        {/* Right: View Switcher (Month | Week | Day) Segmented Pill Control */}
        <div className="inline-flex p-1 bg-gray-100/90 border border-gray-200 rounded-xl shadow-inner">
          {(['Month', 'Week', 'Day'] as CalendarView[]).map((v) => {
            const isActive = view === v;
            return (
              <button
                key={v}
                id={`calendar-view-${v.toLowerCase()}`}
                onClick={() => setView(v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
                  isActive
                    ? 'bg-[#7B1C2A] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                )}
              >
                {v === 'Month' && <CalendarIcon className="w-3.5 h-3.5" />}
                {v === 'Week' && <CalendarDays className="w-3.5 h-3.5" />}
                {v === 'Day' && <Clock className="w-3.5 h-3.5" />}
                <span>{v}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white border border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
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
            onSelectDay={(date) => {
              setSelectedDate(date);
              setView('Day');
            }}
          />
        )}

        {view === 'Day' && (
          <CalendarDayView
            currentDate={selectedDate}
            events={events}
            onEventClick={setSelectedEvent}
            onCreateEvent={() => setShowCreateModal(true)}
          />
        )}

        <CalendarLegend priests={priests} />
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          role={applicationUser?.role}
          onSuccess={() => {
            const filterId = applicationUser?.role === 'DIOCESE_COORDINATOR' ? selectedParishFilter : undefined;
            void CalendarService.getEvents(year, month, filterId).then(setEvents);
          }}
        />
      )}

      {/* Create Parish Event Modal */}
      {showCreateModal && (
        <CreateParishEventModal
          parishId={effectiveParishId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            const filterId = applicationUser?.role === 'DIOCESE_COORDINATOR' ? selectedParishFilter : undefined;
            void CalendarService.getEvents(year, month, filterId).then(setEvents);
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Priest Color Settings Modal */}
      {showPriestSettings && (
        <PriestColorSettingsModal
          parishId={effectiveParishId ? String(effectiveParishId) : undefined}
          onClose={() => setShowPriestSettings(false)}
          onSuccess={() => {
            void fetchPriests();
            const filterId = applicationUser?.role === 'DIOCESE_COORDINATOR' ? selectedParishFilter : undefined;
            void CalendarService.getEvents(year, month, filterId).then(setEvents);
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
