import { useState, useEffect, useCallback } from 'react';
import api from '@/api/api';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

const getManilaParts = (value: Date | string = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(value));
  const getNumber = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: getNumber('year'),
    month: getNumber('month'),
    day: getNumber('day'),
  };
};

const manilaNow = getManilaParts();

interface CalendarEventItem {
  id: string;
  eventType: string;
  displayTitle: string;
  notes?: string;
  requestedDate: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
  status: string;
  remarks?: string;
  sourceType: 'APPOINTMENT' | 'PARISH_EVENT' | 'AVAILABILITY' | 'MASS' | 'PERSONAL';
  location?: string;
  isOngoing?: boolean;
  isOngoingEligible?: boolean;
}

export function PriestMiniCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date(Date.UTC(manilaNow.year, manilaNow.month - 1, 1)));
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(() => manilaNow.day);

  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth() + 1;

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: CalendarEventItem[] }>('/calendar/priest', {
        params: { year, month },
      });
      setEvents(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load priest calendar:', err);
      setError('Could not load personal calendar.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(Date.UTC(year, month - 2, 1)));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(Date.UTC(year, month, 1)));
    setSelectedDay(1);
  };

  // Calendar grid calculations
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const monthName = currentDate.toLocaleString('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' });

  // Map events to day numbers
  const eventsByDay: Record<number, CalendarEventItem[]> = {};
  for (const ev of events) {
    const eventDate = getManilaParts(ev.startDatetime || ev.requestedDate);
    if (eventDate.year === year && eventDate.month === month) {
      const dayNum = eventDate.day;
      if (!eventsByDay[dayNum]) eventsByDay[dayNum] = [];
      eventsByDay[dayNum].push(ev);
    }
  }

  const selectedDayEvents = eventsByDay[selectedDay] || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 text-left">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#7B1C2A]" />
          <h3 className="font-bold text-gray-900 text-sm">My Pastoral Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-gray-800 min-w-[110px] text-center">
            {monthName}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-3">
          {error}
        </div>
      ) : null}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[11px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = eventsByDay[day] || [];
          const hasEvents = dayEvents.length > 0;
          const isSelected = selectedDay === day;
          const today = getManilaParts();
          const isToday =
            today.year === year &&
            today.month === month &&
            today.day === day;

          const hasPersonal = dayEvents.some((e) => e.sourceType === 'PERSONAL');
          const hasMass = dayEvents.some((e) => e.sourceType === 'MASS');
          const hasAppointment = dayEvents.some((e) => e.sourceType === 'APPOINTMENT');
          const hasLeave = dayEvents.some((e) => e.sourceType === 'AVAILABILITY');
          const hasOngoing = dayEvents.some((e) => e.isOngoing);

          return (
            <button
              key={`day-${day}`}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                'h-9 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-semibold',
                isSelected
                  ? 'bg-[#7B1C2A] text-white shadow-xs'
                  : isToday
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 font-bold'
                  : 'hover:bg-gray-100 text-gray-700',
                hasOngoing && !isSelected && 'ring-2 ring-emerald-500 ring-offset-1'
              )}
            >
              <span>{day}</span>
              {hasEvents && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasOngoing && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                  {hasAppointment && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                  {hasPersonal && <span className="w-1 h-1 rounded-full bg-indigo-400" />}
                  {hasMass && <span className="w-1 h-1 rounded-full bg-amber-400" />}
                  {hasLeave && <span className="w-1 h-1 rounded-full bg-rose-400" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Agenda */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-800">
            Agenda for {new Date(Date.UTC(year, month - 1, selectedDay)).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-[11px] text-gray-400">
            {selectedDayEvents.length} commitment{selectedDayEvents.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-gray-400">Loading schedule...</div>
        ) : selectedDayEvents.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">No scheduled commitments on this date.</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedDayEvents.map((item) => {
              const timeFormatted = item.startDatetime
                ? new Date(item.startDatetime).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
                : 'All Day';

              const sourceColors = {
                APPOINTMENT: 'border-l-blue-500 bg-blue-50/50',
                PARISH_EVENT: 'border-l-purple-500 bg-purple-50/50',
                MASS: 'border-l-amber-500 bg-amber-50/50',
                PERSONAL: 'border-l-emerald-500 bg-emerald-50/50',
                AVAILABILITY: 'border-l-rose-500 bg-rose-50/50',
              };

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-2.5 rounded-r-lg border-l-4 text-xs transition-all',
                    sourceColors[item.sourceType] || 'border-l-gray-400 bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-gray-900 truncate">{item.displayTitle}</span>
                    {item.isOngoing && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" /> Ongoing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {timeFormatted}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="uppercase font-semibold tracking-wider text-[10px] text-gray-500">
                      {item.sourceType === 'APPOINTMENT' ? 'Appointment' : item.sourceType === 'PERSONAL' ? 'Personal' : item.sourceType}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-[11px] text-gray-500 italic truncate">{item.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
