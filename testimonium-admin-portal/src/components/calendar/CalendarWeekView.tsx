import React from 'react';
import type { CalendarEvent } from '@/types';
import { CalendarEventChip } from './CalendarEvent';
import { cn } from '@/utils/cn';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (evt: CalendarEvent) => void;
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ currentDate, events, onEventClick }) => {
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
    <div className="grid grid-cols-7 border-collapse min-h-[400px] border-t border-gray-200 bg-white">
      {weekDays.map((date, idx) => {
        const dayEvents = getEventsForDate(date);
        const isToday = 
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();

        return (
          <div 
            key={idx} 
            className={cn(
              "border-r border-b border-gray-200 p-3 flex flex-col min-h-[350px] last:border-r-0",
              isToday ? "bg-[#7B1C2A]/5" : "bg-white"
            )}
          >
            {/* Column Header */}
            <div className="text-center pb-2.5 border-b border-gray-100 flex-shrink-0">
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {DAYS_OF_WEEK[idx]}
              </span>
              <span 
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mt-1",
                  isToday ? "bg-crimson-800 text-white" : "text-gray-700"
                )}
              >
                {date.getDate()}
              </span>
            </div>

            {/* Column Events */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-3">
              {dayEvents.length === 0 ? (
                <span className="block text-[10px] text-gray-300 text-center italic mt-2">No events</span>
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
  );
};
