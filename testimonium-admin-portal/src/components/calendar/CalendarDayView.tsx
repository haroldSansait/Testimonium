import React from 'react';
import type { CalendarEvent } from '@/types';
import { Clock, MapPin, User, Calendar as CalendarIcon } from 'lucide-react';
import { getPriestColor } from '@/utils/priestColors';
import { cn } from '@/utils/cn';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (evt: CalendarEvent) => void;
  onCreateEvent?: () => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({ 
  currentDate, 
  events, 
  onEventClick,
  onCreateEvent,
}) => {
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

  const formattedDate = currentDate.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white">
      {/* Day Summary Banner */}
      <div className="px-6 py-4 border-b border-gray-150 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7B1C2A]/10 flex items-center justify-center text-[#7B1C2A]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{formattedDate}</h3>
            <p className="text-xs text-gray-500 font-medium">
              {sortedEvents.length === 0
                ? 'No events scheduled for this date'
                : `${sortedEvents.length} ${sortedEvents.length === 1 ? 'event' : 'events'} on schedule`}
            </p>
          </div>
        </div>

        {sortedEvents.length > 0 && (
          <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-[#7B1C2A]/10 text-[#7B1C2A] border border-[#7B1C2A]/20">
            {sortedEvents.length} {sortedEvents.length === 1 ? 'Scheduled Event' : 'Scheduled Events'}
          </span>
        )}
      </div>

      {/* Events Container */}
      <div className="p-6 min-h-[350px]">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100/80 flex items-center justify-center text-gray-400 mb-3.5 border border-gray-200">
              <Clock className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-gray-800">No Events Scheduled</h4>
            <p className="text-xs text-gray-400 max-w-[300px] mt-1 mb-4 leading-relaxed">
              There are no appointments, Masses, or parish events scheduled for this date.
            </p>
            {onCreateEvent && (
              <button
                onClick={onCreateEvent}
                className="px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all shadow-xs border border-gray-200"
              >
                + Schedule Event for this Date
              </button>
            )}
          </div>
        ) : (
          <div className="relative border-l-2 border-gray-200 pl-6 space-y-4 ml-3">
            {sortedEvents.map((evt) => {
              const hexColor = evt.priestColor || (evt.priest && evt.priest !== 'TBD' ? getPriestColor(evt.priest).hex : null);
              
              return (
                <div 
                  key={evt.id} 
                  onClick={() => onEventClick(evt)}
                  className="group relative bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-gray-300"
                >
                  {/* Timeline Dot */}
                  <div 
                    className="absolute -left-[31px] top-6 sm:top-1/2 sm:-translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-sm ring-2 ring-gray-100"
                    style={{
                      backgroundColor: hexColor || '#7B1C2A',
                    }}
                  />

                  {/* Event Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#7B1C2A] bg-[#7B1C2A]/10 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-[#7B1C2A]/20">
                        <Clock className="w-3 h-3" />
                        {evt.time}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                        {evt.category}
                      </span>
                      {evt.status && (
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                          evt.status === 'Confirmed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          evt.status === 'Pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {evt.status}
                        </span>
                      )}
                    </div>
                    <h4 className="font-serif font-bold text-base text-gray-900 group-hover:text-[#7B1C2A] transition-colors leading-snug">
                      {evt.title}
                    </h4>
                    {evt.description && (
                      <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
                        {evt.description}
                      </p>
                    )}
                  </div>

                  {/* Venue and Priest Details */}
                  <div className="flex flex-row sm:flex-col gap-3 sm:gap-1.5 flex-shrink-0 text-xs text-gray-600 font-medium border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{evt.parish || 'Main Church'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="flex items-center gap-1 flex-wrap">
                        <span className="text-gray-400">Priest:</span>
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
                          <span className="font-semibold text-gray-700">{evt.priest || 'TBD'}</span>
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
    </div>
  );
};

