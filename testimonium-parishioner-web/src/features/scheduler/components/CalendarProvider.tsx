import React, { createContext, useContext, useState } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
}

interface CalendarContextProps {
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  viewMode: 'month' | 'week' | 'day';
  setViewMode: (mode: 'month' | 'week' | 'day') => void;
}

const CalendarContext = createContext<CalendarContextProps | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const addEvent = (event: CalendarEvent) => {
    setEvents(prev => [...prev, event]);
  };

  return (
    <CalendarContext.Provider value={{ events, addEvent, loading, setLoading, viewMode, setViewMode }}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
};
