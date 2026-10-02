import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme/tokens";
import {
  checkCapturedImageQuality,
  normalizeGovernmentIdImage,
  useCardDetector,
  type CardDetection,
  type Rect,
  type UseCardDetectorReturn,
} from "../scanner";
import {
  classifyDetectorFrameFailure,
  detectGovernmentIdCard,
  type DetectedFrameCard,
} from "../scanner/detectGovernmentIdCard";

export interface GovernmentIdCameraScannerProps {
  side: "front" | "back";
  onCapture: (uri: string) => void;
  onCancel: () => void;
  /** Optional detector instance (used for testing or custom vision engines) */
  detector?: UseCardDetectorReturn;
  /** Optional callback to register the detection frame processor */
  onFeedDetection?: (processor: (detection: CardDetection | null) => void) => void;
  /** Optional custom stability duration in ms (default 750) */
  stabilityDurationMs?: number;
  /** Delay before the no-detection manual fallback is offered (default 10s). */
  manualFallbackDelayMs?: number;
}

// CR80 card standard: 85.6mm x 53.98mm => ratio ~ 1.586
const CARD_ASPECT_RATIO = 85.6 / 53.98;
// VisionCamera memoizes a native FrameOutput by this object's identity.
// Keep it module-stable so ordinary scanner renders cannot reconfigure CameraX.
const FRAME_OUTPUT_RESOLUTION = { width: 640, height: 360 };

function orderCardCorners(
  points: { x: number; y: number }[]
): NonNullable<CardDetection["quad"]> {
  if (points.length !== 4) {
    throw new Error("A detected card must have exactly four corners");
  }

  return {
    topLeft: points.reduce((best, point) =>
      point.x + point.y < best.x + best.y ? point : best
    ),
    topRight: points.reduce((best, point) =>
      point.x - point.y > best.x - best.y ? point : best
    ),
    bottomRight: points.reduce((best, point) =>
      point.x + point.y > best.x + best.y ? point : best
    ),
    bottomLeft: points.reduce((best, point) =>
      point.x - point.y < best.x - best.y ? point : best
    ),
  };
}

export const GovernmentIdCameraScanner: React.FC<GovernmentIdCameraScannerProps> = ({
  side,
  onCapture,
  onCancel,
  detector: customDetector,
  onFeedDetection,
  stabilityDurationMs = 750,
  manualFallbackDelayMs = 10_000,
}) => {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const cameraRef = useRef<CameraRef>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const capturedUriRef = useRef<string | null>(null);
  const ownsCapturedFileRef = useRef(false);
  const [advisoryWarning, setAdvisoryWarning] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [internalCapturing, setInternalCapturing] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [previewSize, setPreviewSize] = useState({
    width: window.width,
    height: window.height,
  });
  const [manualFallbackVisible, setManualFallbackVisible] = useState(
    manualFallbackDelayMs <= 0
  );
  const captureInFlightRef = useRef(false);
  const cameraRunningRef = useRef(false);
  const lastDiagnosticStateRef = useRef<string | null>(null);
  const lastProcessedAt = useSharedValue(0);
  const hasLoggedFrameStart = useSharedValue(false);
  const hasLoggedFrameError = useSharedValue(false);
  const previewSizeRef = useRef(previewSize);
  const photoOutput = usePhotoOutput({
    containerFormat: "jpeg",
    quality: 0.85,
    qualityPrioritization: "quality",
  });

  const isFront = side === "front";
  const titleText = isFront ? "Front of Government ID" : "Back of Government ID";
  const guideText = isFront
    ? "Align the FRONT of your ID card inside the frame"
    : "Align the BACK of your ID card inside the frame";

  const frameWidth = Math.min(Math.max(previewSize.width - 48, 240), 380);
  const frameHeight = Math.round(frameWidth / CARD_ASPECT_RATIO);
  const targetRegion = useMemo<Rect>(
    () => ({
      x: (previewSize.width - frameWidth) / 2,
      // This is the exact 1:1.3 flex split used by topMask/bottomMask below.
      y: (previewSize.height - frameHeight) / 2.3,
      width: frameWidth,
      height: frameHeight,
    }),
    [frameHeight, frameWidth, previewSize.height, previewSize.width]
  );
  const targetRegionRef = useRef(targetRegion);

  useEffect(() => {
    previewSizeRef.current = previewSize;
  }, [previewSize]);

  useEffect(() => {
    targetRegionRef.current = targetRegion;
  }, [targetRegion]);

  const deleteLocalCapture = useCallback((uri: string | null) => {
    if (!uri) return;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Best-effort privacy cleanup; a missing temp file is already clean.
    }
  }, []);

  useEffect(
    () => () => {
      if (ownsCapturedFileRef.current) {
        deleteLocalCapture(capturedUriRef.current);
      }
    },
    [deleteLocalCapture]
  );

  // Core capture action
  const executeCapture = useCallback(async () => {
    if (captureInFlightRef.current) return;
    const hasController = cameraRef.current?.controller != null;
    const canCapture =
      cameraRunningRef.current && hasController && capturedUriRef.current == null;

    if (__DEV__) {
      console.debug('[GovernmentIdScanner] Capture requested', {
        cameraRunning: cameraRunningRef.current,
        hasController,
        isActive: capturedUriRef.current == null,
        photoResolution: photoOutput.currentResolution ?? null,
      });
    }

    if (!canCapture) {
      const error = new Error('Camera session is not active');
      setCaptureError('Camera is starting. Please wait a moment and try again.');
      if (__DEV__) {
        console.warn('[GovernmentIdScanner] Capture blocked', {
          cameraRunning: cameraRunningRef.current,
          hasController,
          isActive: capturedUriRef.current == null,
        });
      }
      throw error;
    }

    let sourceUri: string | null = null;
    let normalizedUri: string | null = null;
    let capturedPhoto: Awaited<ReturnType<typeof photoOutput.capturePhoto>> | null = null;
    try {
      captureInFlightRef.current = true;
      setInternalCapturing(true);
      setCaptureError(null);
      capturedPhoto = await photoOutput.capturePhoto({}, {});
      const photoOrientation = capturedPhoto.orientation;
      const photoWidth = capturedPhoto.width;
      const photoHeight = capturedPhoto.height;
      const path = await capturedPhoto.saveToTemporaryFileAsync();
      sourceUri = path.startsWith("file://") ? path : "file://" + path;
      normalizedUri = await normalizeGovernmentIdImage({
        sourceUri,
        previewSize: previewSizeRef.current,
        guideBounds: targetRegionRef.current,
        photoOrientation,
      });
      deleteLocalCapture(sourceUri);
      sourceUri = null;
      const advisory = checkCapturedImageQuality({
        uri: normalizedUri,
        width: 1280,
        height: Math.round(1280 / CARD_ASPECT_RATIO),
      });
      if (!advisory.passed && advisory.warning) {
        setAdvisoryWarning(advisory.warning);
      } else {
        setAdvisoryWarning(null);
      }
      capturedUriRef.current = normalizedUri;
      ownsCapturedFileRef.current = true;
      setCapturedUri(normalizedUri);
      if (__DEV__) {
        console.debug('[GovernmentIdScanner] Photo capture succeeded', {
          width: photoWidth,
          height: photoHeight,
          orientation: photoOrientation,
        });
      }
    } catch (error) {
      deleteLocalCapture(sourceUri);
      deleteLocalCapture(normalizedUri);
      setCaptureError("Unable to prepare the ID photo. Please try again.");
      if (__DEV__) {
        console.warn("[GovernmentIdScanner] Photo capture failed", error);
      }
      throw error;
    } finally {
      capturedPhoto?.dispose();
      captureInFlightRef.current = false;
      setInternalCapturing(false);
    }
  }, [deleteLocalCapture, photoOutput]);

  // Detector options
  const detectorOptions = useMemo(
    () => ({
      stabilityDurationMs,
      movementThreshold: 20,
    }),
    [stabilityDurationMs]
  );

  // Hook-based detector (or injected custom detector)
  const defaultDetector = useCardDetector({
    targetRegion,
    onAutoCapture: executeCapture,
    options: detectorOptions,
    enabled: !capturedUri,
  });

  const activeDetector = customDetector || defaultDetector;
  const {
    guidanceText,
    isReady,
    isCapturing: detectorCapturing,
    isDetectorAvailable,
    handleDetectorError,
    processDetection,
    reset: resetDetector,
  } = activeDetector;

  const isCapturing = internalCapturing || detectorCapturing;

  useEffect(() => {
    if (capturedUri) return;
    const delay = isDetectorAvailable ? manualFallbackDelayMs : Math.min(1_000, manualFallbackDelayMs);
    const timer = setTimeout(() => setManualFallbackVisible(true), delay);
    return () => clearTimeout(timer);
  }, [capturedUri, isDetectorAvailable, manualFallbackDelayMs]);

  // Expose detection feeder to parent/tests if requested
  useEffect(() => {
    if (onFeedDetection) {
      onFeedDetection((detection) => {
        processDetection(detection);
      });
    }
  }, [onFeedDetection, processDetection]);

  const handleFrameDetection = useCallback(
    (candidate: DetectedFrameCard | null) => {
      if (!candidate || !cameraRef.current) {
        processDetection(null);
        return;
      }

      try {
        const viewPoints = candidate.cameraPoints.map((point) =>
          cameraRef.current!.convertCameraPointToViewPoint(point)
        );
        const xs = viewPoints.map((point) => point.x);
        const ys = viewPoints.map((point) => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const orderedQuad = orderCardCorners(viewPoints);
        const evaluation = processDetection({
          detected: true,
          confidence: candidate.confidence,
          quad: orderedQuad,
          bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
        });
        if (__DEV__ && lastDiagnosticStateRef.current !== evaluation.state) {
          lastDiagnosticStateRef.current = evaluation.state;
          console.debug("[GovernmentIdScanner] Alignment state", {
            state: evaluation.state,
            reason: evaluation.reason ?? null,
          });
        }
      } catch {
        processDetection(null);
      }
    },
    [processDetection]
  );

  const handleFrameStarted = useCallback(
    (metadata: {
      pixelFormat: string;
      width: number;
      height: number;
      bytesPerRow: number;
      bufferByteLength: number | null;
      orientation: string;
    }) => {
      if (__DEV__) {
        console.debug("[GovernmentIdScanner] Frame processing started", metadata);
      }
    },
    []
  );

  const handleFrameError = useCallback(
    (metadata: {
      pixelFormat: string;
      width: number;
      height: number;
      bytesPerRow: number;
      bufferByteLength: number | null;
      orientation: string;
      hasPixelBuffer: boolean;
      isPlanar: boolean;
      failureStage: "PIXEL_BUFFER" | "FRAME_PROCESSING";
      error: string;
    }) => {
      if (__DEV__) {
        console.warn("[GovernmentIdScanner] Frame processing unavailable", metadata);
      }
      handleDetectorError();
    },
    [handleDetectorError]
  );

  const handleCameraError = useCallback(
    (error: Error) => {
      cameraRunningRef.current = false;
      setCameraRunning(false);
      if (__DEV__) {
        console.warn("[GovernmentIdScanner] Camera runtime error", error);
      }
      handleDetectorError();
    },
    [handleDetectorError]
  );

  const handleCameraConfigured = useCallback(() => {
    if (__DEV__) {
      console.debug('[GovernmentIdScanner] Camera session configured', {
        isActive: capturedUriRef.current == null,
      });
    }
  }, []);

  const handleCameraStarted = useCallback(() => {
    cameraRunningRef.current = true;
    setCameraRunning(true);
    if (__DEV__) {
      console.debug('[GovernmentIdScanner] Camera session started', {
        isActive: capturedUriRef.current == null,
        hasController: cameraRef.current?.controller != null,
      });
    }
  }, []);

  const handleCameraStopped = useCallback(() => {
    cameraRunningRef.current = false;
    setCameraRunning(false);
    if (__DEV__) {
      console.debug('[GovernmentIdScanner] Camera session stopped', {
        isActive: capturedUriRef.current == null,
      });
    }
  }, []);

  useEffect(
    () => () => {
      cameraRunningRef.current = false;
    },
    []
  );

  const frameOutput = useFrameOutput({
    targetResolution: FRAME_OUTPUT_RESOLUTION,
    pixelFormat: "rgb",
    onFrame(frame) {
      "worklet";
      let bufferByteLength: number | null = null;
      try {
        const now = performance.now();
        if (now - lastProcessedAt.value < 100) return;
        lastProcessedAt.value = now;

        if (frame.hasPixelBuffer && !frame.isPlanar) {
          bufferByteLength = frame.getPixelBuffer().byteLength;
        }
        if (!hasLoggedFrameStart.value) {
          hasLoggedFrameStart.value = true;
          scheduleOnRN(handleFrameStarted, {
            pixelFormat: frame.pixelFormat,
            width: frame.width,
            height: frame.height,
            bytesPerRow: frame.bytesPerRow,
            bufferByteLength,
            orientation: frame.orientation,
          });
        }
        const candidate = detectGovernmentIdCard(frame);
        scheduleOnRN(handleFrameDetection, candidate);
      } catch (error) {
        if (!hasLoggedFrameError.value) {
          hasLoggedFrameError.value = true;
          scheduleOnRN(handleFrameError, {
            pixelFormat: frame.pixelFormat,
            width: frame.width,
            height: frame.height,
            bytesPerRow: frame.bytesPerRow,
            bufferByteLength,
            orientation: frame.orientation,
            hasPixelBuffer: frame.hasPixelBuffer,
            isPlanar: frame.isPlanar,
            failureStage: classifyDetectorFrameFailure(error),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        frame.dispose();
      }
    },
  });

  const cameraOutputs = useMemo(
    () => [photoOutput, frameOutput],
    [photoOutput, frameOutput]
  );
  const previousOutputsRef = useRef({ photoOutput, frameOutput });

  useEffect(() => {
    if (__DEV__) {
      console.debug('[GovernmentIdScanner] Camera outputs attached', {
        photoOutputChanged: previousOutputsRef.current.photoOutput !== photoOutput,
        frameOutputChanged: previousOutputsRef.current.frameOutput !== frameOutput,
        outputCount: cameraOutputs.length,
      });
    }
    previousOutputsRef.current = { photoOutput, frameOutput };
  }, [cameraOutputs, frameOutput, photoOutput]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={56} color={colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDescription}>
            TESTIMONIUM requires camera access on your Android device to scan and verify your
            Philippine Government ID card.
          </Text>
          <TouchableOpacity
            style={styles.grantButton}
            onPress={requestPermission}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Grant Camera Permission"
          >
            <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cancel ID scan"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleManualCapture = () => {
    void executeCapture().catch(() => {
      // The scanner remains active and the guarded message offers a retry.
    });
  };

  const handleRetake = () => {
    if (ownsCapturedFileRef.current) {
      deleteLocalCapture(capturedUriRef.current);
    }
    capturedUriRef.current = null;
    ownsCapturedFileRef.current = false;
    setCapturedUri(null);
    setAdvisoryWarning(null);
    setCaptureError(null);
    setManualFallbackVisible(!isDetectorAvailable);
    resetDetector();
  };

  const handleConfirmPhoto = () => {
    if (capturedUri) {
      ownsCapturedFileRef.current = false;
      onCapture(capturedUri);
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setPreviewSize({ width, height });
      }}
    >
      {capturedUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: capturedUri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          {advisoryWarning ? (
            <View style={[styles.advisoryBanner, styles.previewAdvisory]}>
              <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.advisoryText}>{advisoryWarning}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={StyleSheet.absoluteFill}>
          {device ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={!capturedUri}
              outputs={cameraOutputs}
              orientationSource="interface"
              resizeMode="cover"
              onConfigured={handleCameraConfigured}
              onStarted={handleCameraStarted}
              onStopped={handleCameraStopped}
              onError={handleCameraError}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.permissionContainer]}>
              <Text style={styles.permissionText}>Camera unavailable on this device.</Text>
            </View>
          )}

          {/* Transparent framing guide overlay as absolute sibling */}
          <View style={styles.overlayLayer} pointerEvents="box-none">
            <View style={styles.topMask}>
              <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={onCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Close scanner"
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.headerTitle}>{titleText}</Text>
                  <Text style={styles.headerSubtitle}>
                    {isFront ? "Step 1 of 2: Front side" : "Step 2 of 2: Reverse side"}
                  </Text>
                </View>
                <View style={{ width: 40 }} />
              </View>
            </View>

            <View style={[styles.middleRow, { height: frameHeight }]}>
              <View style={styles.sideMask} />
              <View
                style={[
                  styles.frameCutout,
                  { width: frameWidth, height: frameHeight },
                  isReady && styles.frameCutoutReady,
                  isCapturing && styles.frameCutoutCapturing,
                ]}
                accessibilityLabel="Framing guide"
                testID="framing-guide"
              >
                {/* 4 corner brackets */}
                <View
                  style={[
                    styles.corner,
                    styles.cornerTL,
                    isReady && styles.cornerReady,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerTR,
                    isReady && styles.cornerReady,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBL,
                    isReady && styles.cornerReady,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBR,
                    isReady && styles.cornerReady,
                  ]}
                />
              </View>
              <View style={styles.sideMask} />
            </View>

            <View style={styles.bottomMask}>
              {/* Dynamic Guidance Badge */}
              <View
                style={[
                  styles.guidanceBadge,
                  isReady && styles.guidanceBadgeReady,
                  isCapturing && styles.guidanceBadgeCapturing,
                ]}
                testID="guidance-badge"
              >
                <Ionicons
                  name={
                    isReady
                      ? "checkmark-circle"
                      : isCapturing
                      ? "camera"
                      : "scan-outline"
                  }
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.guidanceText} testID="guidance-text">
                  {guidanceText}
                </Text>
              </View>

              <Text style={styles.instructionTitle}>{guideText}</Text>
              <Text style={styles.instructionSubtitle}>
                Ensure all 4 corners are inside the frame and text is clear with no glare.
              </Text>
              {captureError ? (
                <Text style={styles.captureErrorText} accessibilityRole="alert">
                  {captureError}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Action Controls Bar */}
      <View
        testID="scanner-controls"
        style={[styles.controlsBar, { bottom: insets.bottom + spacing.md }]}
      >
        {capturedUri ? (
          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleRetake}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.usePhotoBtn}
              onPress={handleConfirmPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Use this photo"
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.usePhotoBtnText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        ) : manualFallbackVisible ? (
          <View style={styles.shutterRow}>
            <Text style={styles.manualFallbackText}>
              Having trouble detecting the card? You can capture it manually.
            </Text>
            <TouchableOpacity
              style={[
                styles.shutterButton,
                isReady && styles.shutterButtonReady,
                (isCapturing || !cameraRunning) && styles.shutterButtonDisabled,
              ]}
              onPress={handleManualCapture}
              disabled={isCapturing || !cameraRunning}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Capture ${side} of ID card manually`}
              testID="shutter-button"
            >
              <View
                style={[
                  styles.shutterInner,
                  isReady && styles.shutterInnerReady,
                ]}
              />
              <Text style={styles.manualCaptureLabel}>Capture Manually</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  permissionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  permissionText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  grantButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radii.md,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  grantButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  previewImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
  },
  topMask: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-start",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  middleRow: {
    flexDirection: "row",
  },
  sideMask: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  frameCutout: {
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1.5,
    borderRadius: 16,
    position: "relative",
  },
  frameCutoutReady: {
    borderColor: "#10B981",
    borderWidth: 3,
  },
  frameCutoutCapturing: {
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 2,
  },
  frameCutoutCaptured: {
    borderColor: "#10B981",
    borderWidth: 2,
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  cornerReady: {
    borderColor: "#10B981",
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  bottomMask: {
    flex: 1.3,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  guidanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: spacing.xs,
  },
  guidanceBadgeReady: {
    backgroundColor: "#059669",
    borderColor: "#34D399",
  },
  guidanceBadgeCapturing: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  guidanceText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  instructionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  instructionSubtitle: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
    marginTop: 2,
  },
  captureErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.xs,
    textAlign: "center",
  },
  advisoryBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  advisoryText: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  controlsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  shutterButton: {
    minWidth: 190,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButtonReady: {
    borderColor: "#10B981",
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  shutterInnerReady: {
    backgroundColor: "#10B981",
  },
  manualFallbackText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: spacing.sm,
    maxWidth: 300,
  },
  manualCaptureLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  previewAdvisory: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  retakeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  usePhotoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: "#059669",
  },
  usePhotoBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
