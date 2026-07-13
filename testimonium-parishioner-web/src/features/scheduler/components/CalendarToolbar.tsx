import React from 'react';
import { useCalendar } from './CalendarProvider';
import { Button } from '../../../components/ui/Button';

interface CalendarToolbarProps {
  onPrev?: () => void;
  onNext?: () => void;
  title?: string;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({ onPrev, onNext, title = 'July 2026' }) => {
  const { viewMode, setViewMode } = useCalendar();

  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center space-y-2 sm:space-y-0 p-4 border-b border-border bg-white rounded-t-card">
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={onPrev}>Prev</Button>
        <Button variant="outline" size="sm" onClick={onNext}>Next</Button>
        <h3 className="text-sm font-bold text-text-primary font-serif">{title}</h3>
      </div>
      <div className="flex space-x-1">
        {(['month', 'week', 'day'] as const).map(mode => (
          <Button
            key={mode}
            variant={viewMode === mode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode(mode)}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
      </div>
    </div>
  );
};
export default CalendarToolbar;
