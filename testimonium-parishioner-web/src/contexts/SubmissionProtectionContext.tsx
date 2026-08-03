import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { SESSION_CONFIG } from '../config/sessionConfig';

interface SubmissionProtectionContextType {
  isBusy: boolean;
  activeTasksCount: number;
  registerBusyTask: (taskId?: string) => () => void;
}

const SubmissionProtectionContext = createContext<SubmissionProtectionContextType>({
  isBusy: false,
  activeTasksCount: 0,
  registerBusyTask: () => () => {},
});

export const SubmissionProtectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTasks, setActiveTasks] = useState<Map<string, number>>(new Map());
  const autoExpireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy = activeTasks.size > 0;

  // Auto-expiry safeguard: If busy state lasts longer than 10 minutes, reset it to prevent security bypass
  useEffect(() => {
    if (isBusy) {
      if (!autoExpireTimerRef.current) {
        const timeoutMs = SESSION_CONFIG.SESSION_BUSY_TIMEOUT_MINUTES * 60 * 1000;
        autoExpireTimerRef.current = setTimeout(() => {
          console.warn('[ParishionerSubmissionProtection] Busy state auto-expired after 10 minutes safety timeout.');
          setActiveTasks(new Map());
        }, timeoutMs);
      }
    } else {
      if (autoExpireTimerRef.current) {
        clearTimeout(autoExpireTimerRef.current);
        autoExpireTimerRef.current = null;
      }
    }

    return () => {
      if (autoExpireTimerRef.current) {
        clearTimeout(autoExpireTimerRef.current);
        autoExpireTimerRef.current = null;
      }
    };
  }, [isBusy]);

  const registerBusyTask = useCallback((taskId?: string) => {
    const id = taskId || Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    setActiveTasks((prev) => {
      const next = new Map(prev);
      next.set(id, now);
      return next;
    });

    return () => {
      setActiveTasks((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  return (
    <SubmissionProtectionContext.Provider
      value={{
        isBusy,
        activeTasksCount: activeTasks.size,
        registerBusyTask,
      }}
    >
      {children}
    </SubmissionProtectionContext.Provider>
  );
};

export const useSubmissionProtection = () => useContext(SubmissionProtectionContext);
