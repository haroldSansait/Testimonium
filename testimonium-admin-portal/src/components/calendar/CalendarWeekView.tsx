import React from 'react';
import type { CalendarEvent } from '@/types';
import { CalendarEventChip } from './CalendarEvent';
import { cn } from '@/utils/cn';
import { Tooltip } from '@/components/ui/Tooltip';


interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (evt: CalendarEvent) => void;
  onSelectDay?: (date: Date) => void;
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ 
  currentDate, 
  events, 
  onEventClick,
  onSelectDay,
}) => {
  const getStartOfWeek = (d: Date) => {
    const temp = new Date(d);
    const day = temp.getDay();
    temp.setDate(temp.getDate() - day);
    return temp;
  };

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + idx);
    return d;
  });

  const getEventsForDate = (date: Date) => {
    const dayVal = date.getDate();
    const monthVal = date.getMonth();
    const yearVal = date.getFullYear();
    return events.filter((e) => e.day === dayVal && e.month === monthVal && e.year === yearVal);
  };

  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 min-w-[720px] divide-x divide-gray-200 bg-white">
        {weekDays.map((date, idx) => {
          const dayEvents = getEventsForDate(date);
          const isToday = 
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
          
          const isSelected = 
            date.getDate() === currentDate.getDate() &&
            date.getMonth() === currentDate.getMonth() &&
            date.getFullYear() === currentDate.getFullYear();

          return (
            <div 
              key={idx} 
              className={cn(
                "flex flex-col min-h-[400px] p-2.5 sm:p-3 transition-colors",
                isToday ? "bg-[#7B1C2A]/[0.03]" : "bg-white",
                isSelected && !isToday && "bg-amber-50/20"
              )}
            >
              {/* Column Header */}
              <Tooltip content="Switch to Day View" side="top">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Switch to Day View for ${DAYS_OF_WEEK[idx]} ${date.getDate()}`}
                  onClick={() => onSelectDay?.(date)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDay?.(date);
                    }
                  }}
                  className={cn(
                    "text-center pb-2.5 border-b border-gray-150 flex-shrink-0 cursor-pointer rounded-xl hover:bg-gray-100/70 p-2 transition-all group focus:outline-none focus:ring-1 focus:ring-crimson-700/50",
                    isToday && "bg-[#7B1C2A]/[0.06] hover:bg-[#7B1C2A]/[0.1]"
                  )}
                >
                  <span className={cn(
                    "block text-[10px] font-bold uppercase tracking-wider",
                    isToday ? "text-[#7B1C2A]" : "text-gray-400 group-hover:text-gray-600"
                  )}>
                    {DAYS_OF_WEEK[idx]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-1 transition-transform group-hover:scale-110",
                      isToday ? "bg-[#7B1C2A] text-white shadow-xs" : "text-gray-800"
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
              </Tooltip>

              {dayEvents.length > 0 && (
                  <span className="block text-[9px] text-gray-400 font-medium mt-0.5 text-center">
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                )}

              {/* Column Events */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pt-3 min-h-[220px]">
                {dayEvents.length === 0 ? (
                  <div className="flex items-center justify-center h-28 text-[11px] text-gray-300 italic font-medium">
                    No events
                  </div>
                ) : (
                  dayEvents.map(evt => (
                    <CalendarEventChip key={evt.id} event={evt} onClick={() => onEventClick(evt)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

