import type { CalendarEvent, CalendarEventCategory } from '@/types';
import { cn } from '@/utils/cn';
import { getPriestColor } from '@/utils/priestColors';
import { Tooltip } from '@/components/ui/Tooltip';

const categoryStyles: Record<CalendarEventCategory, string> = {
  mass: 'bg-crimson-800 text-white',
  sacrament: 'bg-rose-100 text-rose-800 border border-rose-200',
  admin: 'bg-gray-100 text-gray-700 border border-gray-200',
  tentative: 'bg-white text-amber-700 border border-dashed border-amber-400',
};

interface CalendarEventChipProps {
  event: CalendarEvent;
  onClick?: () => void;
}

export function CalendarEventChip({ event, onClick }: CalendarEventChipProps) {
  const customStyle: React.CSSProperties = {};
  let styleClasses = '';
  
  if (event.priestColor) {
    customStyle.backgroundColor = `${event.priestColor}15`;
    customStyle.color = event.priestColor;
    customStyle.borderColor = `${event.priestColor}40`;
    customStyle.borderWidth = '1px';
    customStyle.borderStyle = 'solid';
  } else if (event.priest && event.priest !== 'TBD') {
    const paletteColor = getPriestColor(event.priest);
    styleClasses = `${paletteColor.bg} ${paletteColor.text} border ${paletteColor.border}`;
  } else {
    styleClasses = categoryStyles[event.category];
  }

  const eventTooltipText = `${event.time} — ${event.title}${event.priest ? ` (Priest: ${event.priest})` : ''}`;

  return (
    <Tooltip content={eventTooltipText} side="top">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${event.time} ${event.title}${event.priest ? `, Priest: ${event.priest}` : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onClick?.();
          }
        }}
        style={customStyle}
        className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-crimson-700/50',
          styleClasses
        )}
      >
        {event.time} {event.title}
      </div>
    </Tooltip>
  );
}
