import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  officeHours?: string | Record<string, { isClosed?: boolean; closed?: boolean; openTime?: string; closeTime?: string }>;
  parishName?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
  officeHours,
  parishName,
}) => {
  // Parse initial view month from selectedDate or today
  const initialDate = useMemo(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Today
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const minDateObj = useMemo(() => {
    if (minDate) {
      const d = new Date(minDate);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return today;
  }, [minDate, today]);

  const maxDateObj = useMemo(() => {
    if (maxDate) {
      const d = new Date(maxDate);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    // Default 6 months in future
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [maxDate]);

  // Parse parsed office hours map
  const parsedHoursMap = useMemo(() => {
    if (!officeHours) return null;
    if (typeof officeHours === 'object') return officeHours;
    try {
      return JSON.parse(officeHours);
    } catch {
      return null;
    }
  }, [officeHours]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelectDate(todayStr);
  };

  // Build 42-day calendar grid
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYearNum = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYearNum}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        dateObj: new Date(prevYearNum, prevMonthIdx, dayNum),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
        dateObj: new Date(viewYear, viewMonth, i),
      });
    }

    // Next month padding (up to 42 cells or 35 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYearNum = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYearNum}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        dateObj: new Date(nextYearNum, nextMonthIdx, i),
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const isDayClosed = (dateObj: Date): boolean => {
    if (!parsedHoursMap) return false;
    const dayOfWeek = dateObj.getDay();
    const dayName = FULL_DAY_NAMES[dayOfWeek];
    const conf = parsedHoursMap[dayName];
    return Boolean(conf && (conf.isClosed || conf.closed));
  };

  const isDayDisabled = (dateObj: Date): boolean => {
    dateObj.setHours(0, 0, 0, 0);
    if (dateObj.getTime() < minDateObj.getTime()) return true;
    if (dateObj.getTime() > maxDateObj.getTime()) return true;
    if (isDayClosed(dateObj)) return true;
    return false;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-border/80 shadow-sm overflow-hidden select-none">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 bg-app-page/60 border-b border-border/60">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-crimson" />
          <h3 className="font-serif font-bold text-base text-text-primary">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="px-2.5 py-1 text-xs font-bold text-crimson hover:bg-red-50 rounded-lg transition-colors border border-crimson/20"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-border bg-white text-text-muted hover:text-crimson hover:bg-gray-50 transition-colors shadow-xs"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-border bg-white text-text-muted hover:text-crimson hover:bg-gray-50 transition-colors shadow-xs"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b border-border/40 bg-app-base/40 text-center py-2">
        {DAY_NAMES.map((day, idx) => (
          <div key={day} className={`text-[11px] font-bold uppercase tracking-wider ${idx === 0 ? 'text-amber-700' : 'text-text-muted'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* 42-cell Month Grid */}
      <div className="grid grid-cols-7 p-2 gap-1.5">
        {calendarGrid.map(({ dateStr, dayNum, isCurrentMonth, dateObj }) => {
          const isSelected = selectedDate === dateStr;
          const isToday = todayStr === dateStr;
          const closed = isDayClosed(dateObj);
          const disabled = isDayDisabled(dateObj);

          let cellClass = 'relative h-10 md:h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer font-medium text-xs';

          if (isSelected) {
            cellClass += ' bg-crimson text-white font-bold shadow-sm scale-100 z-10';
          } else if (disabled) {
            cellClass += ' text-gray-300 bg-gray-50/50 cursor-not-allowed';
          } else if (!isCurrentMonth) {
            cellClass += ' text-gray-400 hover:bg-app-page hover:text-text-primary';
          } else {
            cellClass += ' text-text-primary hover:bg-red-50/40 hover:text-crimson hover:border-crimson/20 border border-transparent';
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
              className={cellClass}
              title={closed ? `${parishName || 'Parish'} office is closed on this day` : `${dateStr}`}
            >
              <span className="text-xs">{dayNum}</span>
              {isToday && !isSelected && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-crimson" />
              )}
              {closed && isCurrentMonth && (
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5 leading-none">
                  Closed
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend & Helpers */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-app-page/40 border-t border-border/60 text-[11px] text-text-muted">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-crimson inline-block" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-crimson inline-block" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-gray-200 inline-block" />
            <span>Closed / Past</span>
          </div>
        </div>

        {selectedDate && (
          <span className="font-semibold text-text-primary">
            Selected: <strong className="text-crimson font-bold">{new Date(selectedDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default DatePickerCalendar;
