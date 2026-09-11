import { useState, useEffect, useRef, useCallback } from 'react';

interface UseProgressiveRevealOptions {
  text: string;
  isRestored?: boolean;
  onComplete?: () => void;
  charsPerTick?: number;
  tickIntervalMs?: number;
}

export function useProgressiveReveal({
  text,
  isRestored = false,
  onComplete,
  charsPerTick = 3,
  tickIntervalMs = 18,
}: UseProgressiveRevealOptions) {
  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldSkipAnimation = isRestored || prefersReducedMotion;

  const [displayedText, setDisplayedText] = useState(shouldSkipAnimation ? text : '');
  const [isComplete, setIsComplete] = useState(shouldSkipAnimation);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const completeImmediately = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDisplayedText(text);
    setIsComplete(true);
    onCompleteRef.current?.();
  }, [text]);

  useEffect(() => {
    if (shouldSkipAnimation) {
      setDisplayedText(text);
      setIsComplete(true);
      onCompleteRef.current?.();
      return;
    }

    let currentIndex = 0;
    const targetLength = text.length;

    // Dynamically calculate speed: scale characters per tick so long answers finish in reasonable time
    const dynamicCharsPerTick = Math.max(charsPerTick, Math.ceil(targetLength / 45));

    const tick = () => {
      currentIndex = Math.min(targetLength, currentIndex + dynamicCharsPerTick);
      setDisplayedText(text.slice(0, currentIndex));

      if (currentIndex < targetLength) {
        timerRef.current = setTimeout(tick, tickIntervalMs);
      } else {
        setIsComplete(true);
        timerRef.current = null;
        onCompleteRef.current?.();
      }
    };

    timerRef.current = setTimeout(tick, tickIntervalMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, shouldSkipAnimation, charsPerTick, tickIntervalMs]);

  return {
    displayedText,
    isComplete,
    completeImmediately,
  };
}
