import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AlignmentEvaluation,
  AlignmentState,
  CardDetection,
  DetectorOptions,
  Point,
  Rect,
} from "./cardDetectorTypes";
import { evaluateCardAlignment } from "./cardAlignmentEvaluator";

export interface UseCardDetectorProps {
  targetRegion: Rect;
  onAutoCapture: () => void | Promise<void>;
  options?: DetectorOptions;
  enabled?: boolean;
}

export interface UseCardDetectorReturn {
  alignmentState: AlignmentState;
  guidanceText: string;
  isReady: boolean;
  isCapturing: boolean;
  isDetectorAvailable: boolean;
  processDetection: (detection: CardDetection | null | undefined) => AlignmentEvaluation;
  handleDetectorError: (error?: any) => void;
  reset: () => void;
}

const DEFAULT_STABILITY_MS = 750;
const DEFAULT_READY_GRACE_MS = 275;
const MOVEMENT_THRESHOLD_PX = 20;
const READY_GUIDANCE = "Perfect \u2014 hold steady";

export function useCardDetector({
  targetRegion,
  onAutoCapture,
  options = {},
  enabled = true,
}: UseCardDetectorProps): UseCardDetectorReturn {
  const stabilityDurationMs = options.stabilityDurationMs ?? DEFAULT_STABILITY_MS;
  const readyGraceDurationMs = options.readyGraceDurationMs ?? DEFAULT_READY_GRACE_MS;
  const movementThreshold = options.movementThreshold ?? MOVEMENT_THRESHOLD_PX;

  const [alignmentState, setAlignmentState] = useState<AlignmentState>("NO_CARD");
  const [guidanceText, setGuidanceText] = useState<string>("Place your ID inside the frame");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isDetectorAvailable, setIsDetectorAvailable] = useState<boolean>(true);

  const stabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMisalignmentRef = useRef<AlignmentEvaluation | null>(null);
  const effectiveReadyRef = useRef<boolean>(false);
  const lastCenterRef = useRef<Point | null>(null);
  const hasTriggeredCaptureRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Keep latest onAutoCapture in ref to avoid stale closures
  const onAutoCaptureRef = useRef(onAutoCapture);
  useEffect(() => {
    onAutoCaptureRef.current = onAutoCapture;
  }, [onAutoCapture]);

  const clearStabilityTimer = useCallback(() => {
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
  }, []);

  const clearReadyGraceTimer = useCallback(() => {
    if (readyGraceTimerRef.current) {
      clearTimeout(readyGraceTimerRef.current);
      readyGraceTimerRef.current = null;
    }
    latestMisalignmentRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearStabilityTimer();
      clearReadyGraceTimer();
    };
  }, [clearReadyGraceTimer, clearStabilityTimer]);

  const reset = useCallback(() => {
    clearStabilityTimer();
    clearReadyGraceTimer();
    effectiveReadyRef.current = false;
    hasTriggeredCaptureRef.current = false;
    lastCenterRef.current = null;
    if (isMountedRef.current) {
      setAlignmentState("NO_CARD");
      setGuidanceText("Place your ID inside the frame");
      setIsCapturing(false);
    }
  }, [clearReadyGraceTimer, clearStabilityTimer]);

  const triggerCapture = useCallback(async () => {
    if (hasTriggeredCaptureRef.current || !isMountedRef.current) return;
    hasTriggeredCaptureRef.current = true;
    clearStabilityTimer();
    clearReadyGraceTimer();
    effectiveReadyRef.current = false;

    setAlignmentState("CAPTURING");
    setGuidanceText("Capturing…");
    setIsCapturing(true);

    try {
      await onAutoCaptureRef.current();
    } catch {
      // Re-enable capture if auto-capture fails
      if (isMountedRef.current) {
        hasTriggeredCaptureRef.current = false;
        setIsCapturing(false);
        setAlignmentState("NO_CARD");
        setGuidanceText("Place your ID inside the frame");
      }
    }
  }, [clearReadyGraceTimer, clearStabilityTimer]);

  const processDetection = useCallback(
    (detection: CardDetection | null | undefined): AlignmentEvaluation => {
      if (!enabled || !isDetectorAvailable || !isMountedRef.current) {
        return {
          state: "NO_CARD",
          isReady: false,
          guidanceText: "Position your card inside the frame and tap Capture",
          reason: "NO_CARD",
        };
      }

      if (hasTriggeredCaptureRef.current || isCapturing) {
        return {
          state: "CAPTURING",
          isReady: false,
          guidanceText: "Capturing…",
        };
      }

      const evalResult = evaluateCardAlignment(detection, targetRegion, options);

      if (evalResult.isReady) {
        const recoveredWithinGrace = readyGraceTimerRef.current != null;
        clearReadyGraceTimer();

        // Check for significant movement that breaks stability
        if (!recoveredWithinGrace && evalResult.centerOffset && lastCenterRef.current) {
          const moveDist = Math.hypot(
            evalResult.centerOffset.x - lastCenterRef.current.x,
            evalResult.centerOffset.y - lastCenterRef.current.y
          );
          if (moveDist > movementThreshold) {
            // Movement detected: reset the stability timer
            clearStabilityTimer();
          }
        }
        lastCenterRef.current = evalResult.centerOffset ?? null;

        // If no timer currently running, start one
        if (!stabilityTimerRef.current) {
          stabilityTimerRef.current = setTimeout(() => {
            triggerCapture();
          }, stabilityDurationMs);
        }

        effectiveReadyRef.current = true;
        setAlignmentState("READY");
        setGuidanceText(evalResult.guidanceText);
      } else if (effectiveReadyRef.current) {
        // Physical-device contour estimates jitter. Keep the effective READY
        // state and original capture deadline unless rejection is sustained.
        latestMisalignmentRef.current = evalResult;
        if (!readyGraceTimerRef.current) {
          readyGraceTimerRef.current = setTimeout(() => {
            readyGraceTimerRef.current = null;
            const sustainedResult = latestMisalignmentRef.current;
            latestMisalignmentRef.current = null;
            effectiveReadyRef.current = false;
            clearStabilityTimer();
            lastCenterRef.current = null;

            if (isMountedRef.current && !hasTriggeredCaptureRef.current && sustainedResult) {
              setAlignmentState(sustainedResult.state);
              setGuidanceText(sustainedResult.guidanceText);
            }
          }, readyGraceDurationMs);
        }

        setAlignmentState("READY");
        setGuidanceText(READY_GUIDANCE);
        return {
          ...evalResult,
          state: "READY",
          isReady: true,
          guidanceText: READY_GUIDANCE,
          reason: undefined,
        };
      } else {
        // The scanner has not reached READY, so ordinary rejection is immediate.
        clearStabilityTimer();
        lastCenterRef.current = null;

        setAlignmentState(evalResult.state);
        setGuidanceText(evalResult.guidanceText);
      }

      return evalResult;
    },
    [
      enabled,
      isDetectorAvailable,
      isCapturing,
      targetRegion,
      options,
      movementThreshold,
      clearReadyGraceTimer,
      clearStabilityTimer,
      readyGraceDurationMs,
      stabilityDurationMs,
      triggerCapture,
    ]
  );

  const handleDetectorError = useCallback(
    (_error?: any) => {
      clearStabilityTimer();
      clearReadyGraceTimer();
      effectiveReadyRef.current = false;
      setIsDetectorAvailable(false);
      setAlignmentState("NO_CARD");
      setGuidanceText("Position your card inside the frame and tap Capture");
    },
    [clearReadyGraceTimer, clearStabilityTimer]
  );

  return {
    alignmentState,
    guidanceText,
    isReady: alignmentState === "READY",
    isCapturing,
    isDetectorAvailable,
    processDetection,
    handleDetectorError,
    reset,
  };
}
