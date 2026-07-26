import React from 'react';
import type { CalendarEvent } from '@/types';
import { Clock, MapPin, User } from 'lucide-react';
import { getPriestColor } from '@/utils/priestColors';
import { cn } from '@/utils/cn';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (evt: CalendarEvent) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({ currentDate, events, onEventClick }) => {
  const getEventsForDate = (date: Date) => {
    const dayVal = date.getDate();
    const monthVal = date.getMonth();
    const yearVal = date.getFullYear();
    return events.filter((e) => e.day === dayVal && e.month === monthVal && e.year === yearVal);
  };

  const dayEvents = getEventsForDate(currentDate);

  // Sort events chronologically (time sorting)
  const sortedEvents = [...dayEvents].sort((a, b) => {
    const timeToMin = (t: string) => {
      try {
        if (t === 'All Day') return 0;
        let [time, period] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      } catch {
        return 0;
      }
    };
    return timeToMin(a.time) - timeToMin(b.time);
  });

  return (
    <div className="p-6 border-t border-gray-200 bg-white min-h-[350px]">
      {sortedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3 border border-gray-100">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-800">No Events Scheduled</h4>
          <p className="text-xs text-gray-400 max-w-[280px] mt-1">
            There are no appointments, Masses, or events scheduled for this date.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-gray-150 pl-5 space-y-6 ml-3">
          {sortedEvents.map((evt) => {
            const hexColor = evt.priestColor || (evt.priest && evt.priest !== 'TBD' ? getPriestColor(evt.priest).hex : null);
            
            return (
              <div 
                key={evt.id} 
                onClick={() => onEventClick(evt)}
                className="group relative bg-white border border-gray-150 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-gray-300 animate-in fade-in duration-100"
              >
                {/* Timeline Dot */}
                <div 
                  className="absolute -left-[27px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                  style={{
                    backgroundColor: hexColor || '#7B1C2A',
                  }}
                />

                {/* Event Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#7B1C2A] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {evt.time}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 border px-1.5 py-0.5 rounded">
                      {evt.category}
                    </span>
                    {evt.status && (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        evt.status === 'Confirmed' ? "bg-green-50 text-green-700 border border-green-200" :
                        evt.status === 'Pending' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-gray-100 text-gray-600 border"
                      )}>
                        {evt.status}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif font-bold text-base text-gray-900 group-hover:text-crimson-800 transition-colors">
                    {evt.title}
                  </h4>
                  {evt.description && (
                    <p className="text-xs text-gray-500 max-w-xl leading-relaxed mt-1">
                      {evt.description}
                    </p>
                  )}
                </div>

                {/* Venue and Priest Details */}
                <div className="flex flex-row sm:flex-col gap-4 sm:gap-1.5 flex-shrink-0 text-xs text-gray-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{evt.parish || 'Main Church'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="flex items-center gap-1 flex-wrap">
                      Priest:
                      {hexColor ? (
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block"
                          style={{
                            backgroundColor: `${hexColor}15`,
                            color: hexColor,
                            borderColor: `${hexColor}40`,
                          }}
                        >
                          {evt.priest || 'TBD'}
                        </span>
                      ) : (
                        <span>{evt.priest || 'TBD'}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
