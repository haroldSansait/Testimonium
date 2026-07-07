import type { CalendarEvent } from '@/types';
import { CalendarEventChip } from './CalendarEvent';
import { cn } from '@/utils/cn';

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  today?: number; // day of month to highlight as today
  onEventClick?: (evt: CalendarEvent) => void;
}

export function CalendarGrid({ year, month, events, today, onEventClick }: CalendarGridProps) {
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build a 6-row grid (42 cells)
  const cells: { day: number; inMonth: boolean }[] = [];

  // Prev month padding
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  // Next month padding
  let next = 1;
  while (cells.length < 42) {
    cells.push({ day: next++, inMonth: false });
  }

  const getEventsForDay = (day: number) =>
    events.filter((e) => e.day === day && e.month === month && e.year === year);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {DAYS_OF_WEEK.map((d) => (
              <th
                key={d}
                className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-3 text-center border-b border-gray-200 bg-white"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                const dayEvents = cell.inMonth ? getEventsForDay(cell.day) : [];
                const isToday = cell.inMonth && today !== undefined && cell.day === today;

                return (
                  <td
                    key={colIdx}
                    className={cn(
                      'border border-gray-200 align-top p-2 h-24 min-w-[80px] w-[14.28%]',
                      !cell.inMonth && 'bg-gray-50',
                      cell.inMonth && 'bg-white cursor-pointer hover:bg-gray-50/70 transition-colors'
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-crimson-800 text-white'
                          : cell.inMonth
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      )}
                    >
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((evt) => (
                        <CalendarEventChip key={evt.id} event={evt} onClick={() => onEventClick?.(evt)} />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
