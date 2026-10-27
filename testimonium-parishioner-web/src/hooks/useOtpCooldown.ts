import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'otp_cooldown_deadline';

const getStoredDeadline = (key: string) => {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = Number(sessionStorage.getItem(key) || 0);
    return stored > Date.now() ? stored : 0;
  } catch {
    return 0;
  }
};

// Wall-clock deadlines stay correct when browser/native timers pause in background or across page refresh.
export function useOtpCooldown(customKey?: string): [number, (seconds: number) => void] {
  const key = customKey || STORAGE_KEY;
  const deadline = useRef<number>(getStoredDeadline(key));
  const [remaining, setRemaining] = useState<number>(() => {
    return Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
  });

  const setCooldown = useCallback((seconds: number) => {
    const duration = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const target = duration > 0 ? Date.now() + duration * 1000 : 0;
    deadline.current = target;
    if (typeof window !== 'undefined') {
      try {
        if (target > 0) {
          sessionStorage.setItem(key, String(target));
        } else {
          sessionStorage.removeItem(key);
        }
      } catch {
        // Safe fallback
      }
    }
    setRemaining(Math.ceil(duration));
  }, [key]);

  const active = remaining > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // ignore
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [active, key]);

  return [remaining, setCooldown];
}
