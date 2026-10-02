import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radii, spacing } from "@/theme/tokens";
import { GovernmentIdCameraScanner } from "./components/GovernmentIdCameraScanner";
import {
  getSafeVerificationErrorMessage,
  submitGovernmentIdVerification,
} from "./api/governmentIdVerification";
import {
  ID_TYPE_LABELS,
  REJECTION_REASON_MESSAGES,
  type GovernmentIdVerificationStatusResponse,
} from "./types/governmentId";

type FlowStep = "CAMERA_FRONT" | "CAMERA_BACK" | "REVIEW";
type VerificationState =
  | "REVIEW_READY"
  | "VERIFYING"
  | "VERIFIED"
  | "REJECTED"
  | "RETRYABLE_ERROR";
type RetakeTarget = "front" | "back" | "both";

interface IdVerificationScreenProps {
  /** Test/custom override; production uses the scanner's bounded default. */
  scannerFallbackDelayMs?: number;
}

export const IdVerificationScreen: React.FC<IdVerificationScreenProps> = ({
  scannerFallbackDelayMs,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState<FlowStep>("CAMERA_FRONT");
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const frontUriRef = useRef<string | null>(null);
  const backUriRef = useRef<string | null>(null);
  const [verificationState, setVerificationState] =
    useState<VerificationState>("REVIEW_READY");
  const [verificationResult, setVerificationResult] =
    useState<GovernmentIdVerificationStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retakeTarget, setRetakeTarget] = useState<RetakeTarget>("both");
  const [retryNonce, setRetryNonce] = useState(0);
  const attemptedPairRef = useRef<string | null>(null);
  const [scanProgress] = useState(() => new Animated.Value(0));
  const isSubmitting = verificationState === "VERIFYING";
  const scanLineTranslateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });

  const deleteLocalCapture = useCallback((uri: string | null) => {
    if (!uri) return;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Best effort: files may already have been removed by the OS cache.
    }
  }, []);

  const clearLocalCaptures = useCallback(() => {
    deleteLocalCapture(frontUriRef.current);
    deleteLocalCapture(backUriRef.current);
    frontUriRef.current = null;
    backUriRef.current = null;
    setFrontUri(null);
    setBackUri(null);
  }, [deleteLocalCapture]);

  useEffect(() => clearLocalCaptures, [clearLocalCaptures]);

  const handleBack = () => {
    if (isSubmitting) return;
    if (step === "CAMERA_FRONT" && !frontUri) {
      if (router.canGoBack()) router.back();
      else router.replace("/(app)/(tabs)/(profile)" as any);
      return;
    }
    if (step === "CAMERA_BACK" && frontUri) {
      setStep("REVIEW");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/(profile)" as any);
  };

  const handleFrontCaptured = (uri: string) => {
    if (frontUriRef.current && frontUriRef.current !== uri) {
      deleteLocalCapture(frontUriRef.current);
    }
    frontUriRef.current = uri;
    setFrontUri(uri);
    setErrorMessage(null);
    setVerificationResult(null);
    setVerificationState("REVIEW_READY");
    if (!backUri) {
      setStep("CAMERA_BACK");
    } else {
      setStep("REVIEW");
    }
  };

  const handleBackCaptured = (uri: string) => {
    if (backUriRef.current && backUriRef.current !== uri) {
      deleteLocalCapture(backUriRef.current);
    }
    backUriRef.current = uri;
    setBackUri(uri);
    setErrorMessage(null);
    setVerificationResult(null);
    setVerificationState("REVIEW_READY");
    setStep("REVIEW");
  };

  const verifyPair = useCallback(async (front: string, back: string) => {
    const pairKey = `${front}|${back}`;
    if (attemptedPairRef.current === pairKey) return;
    attemptedPairRef.current = pairKey;
    setVerificationState("VERIFYING");
    setErrorMessage(null);
    setVerificationResult(null);

    try {
      const res = await submitGovernmentIdVerification(front, back);
      setVerificationResult(res);

      if (res.status === "VERIFIED") {
        setVerificationState("VERIFIED");
      } else if (res.status === "REJECTED") {
        const reason = res.rejectionReason;
        setErrorMessage(
          (reason && REJECTION_REASON_MESSAGES[reason]) ||
            "We couldn't verify this ID. Please retake the photos and try again."
        );
        setRetakeTarget(res.failedSide || "both");
        setVerificationState("REJECTED");
        await Promise.resolve().then(refreshProfile).catch(() => undefined);
      } else {
        setErrorMessage("We couldn't verify your ID right now. Please try again.");
        setVerificationState("RETRYABLE_ERROR");
      }
    } catch (error: unknown) {
      setErrorMessage(getSafeVerificationErrorMessage(error));
      setVerificationState("RETRYABLE_ERROR");
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (step !== "REVIEW" || !frontUri || !backUri) return;
    const timer = setTimeout(() => {
      void verifyPair(frontUri, backUri);
    }, 0);
    return () => clearTimeout(timer);
  }, [backUri, frontUri, retryNonce, step, verifyPair]);

  useEffect(() => {
    if (!isSubmitting) {
      scanProgress.stopAnimation();
      scanProgress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 1_200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 1_200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isSubmitting, scanProgress]);

  const retake = (target: RetakeTarget) => {
    attemptedPairRef.current = null;
    setVerificationResult(null);
    setErrorMessage(null);
    setVerificationState("REVIEW_READY");
    if (target === "both") {
      clearLocalCaptures();
      setStep("CAMERA_FRONT");
      return;
    }
    setStep(target === "front" ? "CAMERA_FRONT" : "CAMERA_BACK");
  };

  const retryVerification = () => {
    attemptedPairRef.current = null;
    setRetryNonce((value) => value + 1);
  };

  const finishSuccess = () => {
    void Promise.resolve().then(refreshProfile).catch(() => undefined);
    clearLocalCaptures();
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/(profile)" as any);
  };

  if (step === "CAMERA_FRONT") {
    return (
      <GovernmentIdCameraScanner
        key="front"
        side="front"
        manualFallbackDelayMs={scannerFallbackDelayMs}
        onCapture={handleFrontCaptured}
        onCancel={() => {
          if (frontUri && backUri) setStep("REVIEW");
          else handleBack();
        }}
      />
    );
  }

  if (step === "CAMERA_BACK") {
    return (
      <GovernmentIdCameraScanner
        key="back"
        side="back"
        manualFallbackDelayMs={scannerFallbackDelayMs}
        onCapture={handleBackCaptured}
        onCancel={() => setStep("REVIEW")}
      />
    );
  }

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Verify Government ID"
        subtitle="Review & Verify"
        onBack={handleBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <>
            {/* Instruction Header */}
            <View style={styles.infoBanner}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.infoBannerTitle}>Accepted Philippine Card IDs</Text>
                <Text style={styles.infoBannerText}>
                  PhilSys / National ID, Driver&apos;s License, UMID, Voter ID, or Postal ID. Both
                  front and back card photos are required.
                </Text>
              </View>
            </View>

            {/* Rejection / Error Alert */}
            {errorMessage ? (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={22} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.errorAlertTitle}>Verification Unsuccessful</Text>
                  <Text style={styles.errorAlertText}>{errorMessage}</Text>
                  {verificationState === "RETRYABLE_ERROR" ? (
                    <TouchableOpacity
                      onPress={retryVerification}
                      style={styles.errorAction}
                      accessibilityRole="button"
                    >
                      <Text style={styles.errorActionText}>Try Again</Text>
                    </TouchableOpacity>
                  ) : verificationState === "REJECTED" ? (
                    <TouchableOpacity
                      onPress={() => retake(retakeTarget)}
                      style={styles.errorAction}
                      accessibilityRole="button"
                    >
                      <Text style={styles.errorActionText}>
                        {retakeTarget === "front"
                          ? "Retake Front"
                          : retakeTarget === "back"
                          ? "Retake Back"
                          : "Retake Both"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Front Photo Card */}
            <View style={styles.cardSection}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionTitle}>Front of ID Card</Text>
                <TouchableOpacity
                  onPress={() => retake("front")}
                  style={[styles.retakeLink, isSubmitting && styles.disabledAction]}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Retake front of ID"
                >
                  <Ionicons name="camera-reverse-outline" size={16} color={colors.primary} />
                  <Text style={styles.retakeLinkText}>Retake Front</Text>
                </TouchableOpacity>
              </View>

              {frontUri ? (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: frontUri }} style={styles.idThumbnail} resizeMode="contain" />
                  {isSubmitting ? (
                    <View style={styles.scanOverlay} pointerEvents="none">
                      <Animated.View
                        style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
                      />
                    </View>
                  ) : null}
                  <View style={styles.readyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.readyBadgeText}>Front Captured</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.capturePrompt}
                  onPress={() => setStep("CAMERA_FRONT")}
                  accessibilityRole="button"
                  accessibilityLabel="Scan front of ID"
                >
                  <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                  <Text style={styles.capturePromptText}>Tap to scan Front of ID</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Back Photo Card */}
            <View style={styles.cardSection}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionTitle}>Back of ID Card</Text>
                <TouchableOpacity
                  onPress={() => retake("back")}
                  style={[styles.retakeLink, isSubmitting && styles.disabledAction]}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Retake back of ID"
                >
                  <Ionicons name="camera-reverse-outline" size={16} color={colors.primary} />
                  <Text style={styles.retakeLinkText}>Retake Back</Text>
                </TouchableOpacity>
              </View>

              {backUri ? (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: backUri }} style={styles.idThumbnail} resizeMode="contain" />
                  {isSubmitting ? (
                    <View style={styles.scanOverlay} pointerEvents="none">
                      <Animated.View
                        style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
                      />
                    </View>
                  ) : null}
                  <View style={styles.readyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.readyBadgeText}>Back Captured</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.capturePrompt}
                  onPress={() => setStep("CAMERA_BACK")}
                  accessibilityRole="button"
                  accessibilityLabel="Scan back of ID"
                >
                  <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                  <Text style={styles.capturePromptText}>Tap to scan Back of ID</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name Match Notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.noticeText}>
                The full name on your Government ID must match your registered profile:{" "}
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                  {profile?.fullName || "Your Profile Name"}
                </Text>
                .
              </Text>
            </View>

            {/* Authoritative verification request state */}
            <View style={styles.submitSection}>
              {isSubmitting ? (
                <View style={styles.submittingBox}>
                  <View style={styles.verifyingIcon}>
                    <Ionicons name="scan-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.submittingText}>
                    Verifying your Government ID…
                  </Text>
                  <Text style={styles.submittingSubtext}>
                    Checking image quality and ID details.
                  </Text>
                </View>
              ) : null}
            </View>
          </>
      </ScrollView>

      <Modal
        visible={verificationState === "VERIFIED"}
        transparent
        animationType="fade"
        onRequestClose={finishSuccess}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard} accessibilityRole="alert">
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#059669" />
            </View>
            <Text style={styles.successTitle}>Government ID Verified</Text>
            <Text style={styles.successDesc}>
              Your identity has been successfully verified. You can now create document and
              schedule requests.
            </Text>
            {verificationResult?.idType ? (
              <Text style={styles.verifiedIdType}>
                {ID_TYPE_LABELS[verificationResult.idType] || "Philippine Government ID"}
              </Text>
            ) : null}
            <Button
              title="Done"
              variant="primary"
              size="lg"
              onPress={finishSuccess}
              style={styles.fullWidthBtn}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 2,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  errorAlert: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  errorAlertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 2,
  },
  errorAlertText: {
    fontSize: 13,
    color: "#7F1D1D",
    lineHeight: 18,
  },
  errorAction: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: "#DC2626",
  },
  errorActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cardSection: {
    backgroundColor: "#F8F8F7",
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  retakeLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  retakeLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: 4,
  },
  disabledAction: {
    opacity: 0.35,
  },
  previewImageContainer: {
    position: "relative",
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  idThumbnail: {
    width: "100%",
    height: 180,
    backgroundColor: "#E2E8F0",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
  },
  scanLine: {
    height: 3,
    marginHorizontal: 4,
    backgroundColor: "#34D399",
    shadowColor: "#10B981",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 5,
  },
  readyBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  readyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
    marginLeft: 4,
  },
  capturePrompt: {
    height: 140,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  capturePromptText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 6,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  noticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginLeft: 6,
    flex: 1,
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submittingBox: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: "#F8F8F7",
    borderRadius: radii.xl,
  },
  verifyingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  submittingText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  submittingSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  fullWidthBtn: {
    width: "100%",
  },
  successCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
  },
  successIconWrap: {
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: spacing.xs,
  },
  successDesc: {
    fontSize: 14,
    color: "#047857",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  verifiedIdType: {
    fontSize: 13,
    color: "#047857",
    fontWeight: "600",
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  detailsBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    marginBottom: spacing.lg,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
});
