import React from 'react';
import { Spinner } from '../../../components/ui/Spinner';

export const CalendarLoading: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-12 bg-app-page border border-border/40 rounded-card">
      <Spinner size="md" className="text-crimson mr-2" />
      <span className="text-xs text-text-muted">Loading Calendar Schedule...</span>
    </div>
  );
};
export default CalendarLoading;
