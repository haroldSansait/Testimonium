import type { CalendarEvent, CalendarEventCategory } from '@/types';
import { cn } from '@/utils/cn';

const categoryStyles: Record<CalendarEventCategory, string> = {
  mass: 'bg-crimson-800 text-white',
  sacrament: 'bg-rose-100 text-rose-800 border border-rose-200',
  admin: 'bg-gray-100 text-gray-700 border border-gray-200',
  tentative: 'bg-white text-amber-700 border border-dashed border-amber-400',
};

interface CalendarEventChipProps {
  event: CalendarEvent;
}

export function CalendarEventChip({ event }: CalendarEventChipProps) {
  return (
    <div
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity',
        categoryStyles[event.category]
      )}
      title={`${event.time} ${event.title}`}
    >
      {event.time} {event.title}
    </div>
  );
}
