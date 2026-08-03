import { useEffect, useRef, useState, useCallback } from 'react';
import { SESSION_CONFIG } from '../config/sessionConfig';
import { logSessionEvent } from '../utils/sessionLogger';

interface UseIdleTimeoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  absoluteLifetimeHours?: number;
  enabled: boolean;
  isBusy?: boolean;
  onWarning: () => void;
  onTimeout: () => void;
  onAbsoluteTimeout: () => void;
}

export function useIdleTimeout({
  timeoutMinutes = SESSION_CONFIG.SESSION_TIMEOUT_MINUTES,
  warningMinutes = SESSION_CONFIG.SESSION_WARNING_MINUTES,
  absoluteLifetimeHours = SESSION_CONFIG.ABSOLUTE_SESSION_HOURS,
  enabled,
  isBusy = false,
  onWarning,
  onTimeout,
  onAbsoluteTimeout,
}: UseIdleTimeoutOptions) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>((timeoutMinutes - warningMinutes) * 60);
  const [isWarningActive, setIsWarningActive] = useState(false);

  const lastActivityTimestamp = useRef<number>(Date.now());
  const sessionStartTimestamp = useRef<number>(0);

  // Initialize session start timestamp on mount
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_CONFIG.SESSION_START_KEY);
    if (saved) {
      sessionStartTimestamp.current = Number(saved);
    } else {
      const now = Date.now();
      localStorage.setItem(SESSION_CONFIG.SESSION_START_KEY, String(now));
      sessionStartTimestamp.current = now;
    }
  }, []);

  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const warningMs = warningMinutes * 60 * 1000;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const absoluteMs = absoluteLifetimeHours * 60 * 60 * 1000;

  // ── Reset inactivity timer on user interaction ────────────────────────────
  const resetTimer = useCallback(() => {
    if (!enabled || isBusy) return;
    lastActivityTimestamp.current = Date.now();
    if (isWarningActive) {
      setIsWarningActive(false);
    }
  }, [enabled, isBusy, isWarningActive]);

  // ── Check elapsed times and calculate state ──────────────────────────────
  const evaluateInactivity = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();

    // 1. Check absolute session lifetime limit
    const sessionStart = sessionStartTimestamp.current || now;
    if (now - sessionStart >= absoluteMs) {
      logSessionEvent('Absolute Timeout Logout');
      onAbsoluteTimeout();
      return;
    }

    // 2. If active submission is running, suspend idle timeout checks
    if (isBusy) {
      lastActivityTimestamp.current = now; // keep activity updated while busy
      if (isWarningActive) setIsWarningActive(false);
      return;
    }

    // 3. Evaluate inactivity using timestamp delta
    const elapsedIdleMs = now - lastActivityTimestamp.current;

    if (elapsedIdleMs >= timeoutMs) {
      onTimeout();
    } else if (elapsedIdleMs >= warningMs) {
      const remainingSec = Math.max(0, Math.ceil((timeoutMs - elapsedIdleMs) / 1000));
      setSecondsRemaining(remainingSec);
      if (!isWarningActive) {
        setIsWarningActive(true);
        logSessionEvent('Session Warning Displayed', { remainingSeconds: remainingSec });
        onWarning();
      }
    } else {
      if (isWarningActive) {
        setIsWarningActive(false);
      }
    }
  }, [enabled, isBusy, absoluteMs, timeoutMs, warningMs, isWarningActive, onAbsoluteTimeout, onTimeout, onWarning]);

  // ── High-frequency ticker and sleep/wake listeners ────────────────────────
  useEffect(() => {
    if (!enabled) {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      return;
    }

    // Evaluate state every 1 second
    tickerIntervalRef.current = setInterval(() => {
      evaluateInactivity();
    }, 1000);

    // Immediate re-evaluation on window focus, tab visibility change, or sleep recovery
    const handleWakeOrFocus = () => {
      evaluateInactivity();
    };

    window.addEventListener('visibilitychange', handleWakeOrFocus);
    window.addEventListener('focus', handleWakeOrFocus);
    window.addEventListener('pageshow', handleWakeOrFocus);

    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      window.removeEventListener('visibilitychange', handleWakeOrFocus);
      window.removeEventListener('focus', handleWakeOrFocus);
      window.removeEventListener('pageshow', handleWakeOrFocus);
    };
  }, [enabled, evaluateInactivity]);

  // ── Debounced Activity Event Listeners ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleUserActivity = (event: Event) => {
      // Filter touchpad mouse jitter
      if (event.type === 'mousemove') {
        const mouseEvent = event as MouseEvent;
        const dx = Math.abs(mouseEvent.clientX - lastMousePos.current.x);
        const dy = Math.abs(mouseEvent.clientY - lastMousePos.current.y);

        if (dx < SESSION_CONFIG.MIN_MOUSE_JITTER_PX && dy < SESSION_CONFIG.MIN_MOUSE_JITTER_PX) {
          return; // Insignificant jitter
        }
        lastMousePos.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        resetTimer();
      }, SESSION_CONFIG.ACTIVITY_DEBOUNCE_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [enabled, resetTimer]);

  return {
    secondsRemaining,
    isWarningActive,
    resetTimer,
  };
}
