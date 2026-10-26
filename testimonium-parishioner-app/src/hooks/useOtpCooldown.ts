import { useCallback, useEffect, useRef, useState } from 'react';

// Wall-clock deadlines stay correct when browser/native timers pause in background.
export function useOtpCooldown(): [number, (seconds: number) => void] {
  const deadline = useRef(0);
  const [remaining, setRemaining] = useState(0);
  const setCooldown = useCallback((seconds: number) => {
    const duration = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    deadline.current = Date.now() + duration * 1000;
    setRemaining(Math.ceil(duration));
  }, []);
  const active = remaining > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [active]);
  return [remaining, setCooldown];
}
