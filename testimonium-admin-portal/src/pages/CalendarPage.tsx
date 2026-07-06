import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

export function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<CalendarView>('Month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    void CalendarService.getEvents(year, month).then(setEvents);
  }, [year, month]);

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
        />
        <CalendarLegend />
      </div>
    </div>
  );
}
