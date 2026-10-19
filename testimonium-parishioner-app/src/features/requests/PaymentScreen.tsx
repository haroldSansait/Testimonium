import React, { useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeBottomActionBar } from "@/components/ui/SafeBottomActionBar";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  usePaymentConfiguration,
  useRequestDetail,
  useUploadPaymentReceipt,
} from "./api";
import { PaymentQrCard } from "./components/PaymentQrCard";
import { ReceiptCapturePicker } from "./components/ReceiptCapturePicker";
import {
  formatDocumentType,
  formatFee,
  hasAuthoritativeFee,
  isPaymentEligible,
} from "./presentation";
import type { LocalSelectedReceipt } from "./types";

export interface PaymentScreenProps {
  requestId?: string | null;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({ requestId }) => {
  const router = useRouter();
  const { contentBottomInset, onBottomActionLayout } = useAppLayoutMetrics();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  const {
    data: request,
    isLoading: loadingRequest,
    error: requestError,
    refetch: refetchRequest,
  } = useRequestDetail(isValidId ? requestId : null);

  const {
    data: paymentConfig,
    isLoading: loadingConfig,
  } = usePaymentConfiguration(isValidId ? requestId : null);

  const [selectedReceipt, setSelectedReceipt] = useState<LocalSelectedReceipt | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inFlightGuard = useRef(false);

  const uploadReceiptMutation = useUploadPaymentReceipt();

  const handleBack = () => {
    navigateBackOrReplace(
      () => router.canGoBack(),
      () => router.back(),
      () => router.replace(`/(app)/requests/${requestId}` as any)
    );
  };

  const handleReceiptUpload = async () => {
    if (!request || !selectedReceipt || !hasAuthoritativeFee(request.fee) || inFlightGuard.current) return;

    inFlightGuard.current = true;
    setIsUploading(true);

    try {
      await uploadReceiptMutation.mutateAsync({
        requestId: request.id,
        receipt: selectedReceipt,
      });

      inFlightGuard.current = false;
      setIsUploading(false);
      setSelectedReceipt(null);

      Alert.alert(
        "Receipt Submitted",
        "Your payment proof has been submitted for review. Parish records staff will verify your payment.",
        [
          {
            text: "View Request Status",
            onPress: () => {
              router.replace(`/(app)/requests/${request.id}` as any);
            },
          },
        ]
      );
    } catch (err: any) {
      inFlightGuard.current = false;
      setIsUploading(false);

      // On ambiguous or network failure, refetch to check if server registered the receipt
      const detailResult = await refetchRequest();
      if (detailResult.data?.status === "PAYMENT_UNDER_REVIEW") {
        setSelectedReceipt(null);
        Alert.alert(
          "Payment Under Review",
          "Your receipt upload has been received and is currently under review.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace(`/(app)/requests/${request.id}` as any);
              },
            },
          ]
        );
        return;
      }

      if (detailResult.data?.status === "PAYMENT_NEEDS_CORRECTION") {
        setSelectedReceipt(null);
        Alert.alert(
          "Clearer Receipt Needed",
          detailResult.data.paymentCorrectionNote ||
            "The payment proof image is unclear or blurry. Please upload a clearer image."
        );
        return;
      }

      // Synchronous upload errors: invalid file type, magic byte mismatch, size limit, ownership, invalid state
      if (err?.code === "PAYMENT_PROOF_INVALID_IMAGE" || err?.code === "INVALID_FILE_FORMAT") {
        Alert.alert(
          "Invalid Receipt Image",
          "The selected file is not a valid receipt image. Please upload a clear JPEG or PNG under 5 MB."
        );
        return;
      }

      if (err?.code === "FILE_TOO_LARGE") {
        Alert.alert(
          "File Too Large",
          "The selected receipt exceeds the 5 MB file size limit. Please choose a smaller image."
        );
        return;
      }

      Alert.alert(
        "Upload Failed",
        err.message ||
          "Could not upload payment receipt. Please check your connection and try again."
      );
    }
  };

  if (!isValidId || (!loadingRequest && (requestError || !request))) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader
          title="Payment"
          onBack={handleBack}
          backAccessibilityLabel="Back to requests"
        />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Payment Unavailable"
            description="The requested document application could not be found or payment is not currently required."
            actionLabel="Return to Request"
            onAction={handleBack}
          />
        </View>
      </Screen>
    );
  }

  const isEligible = Boolean(request && isPaymentEligible(request));
  const hasValidFee = Boolean(request && hasAuthoritativeFee(request.fee));
  const feeLabel = request ? formatFee(request.fee) : "Fee unavailable";
  const docTypeLabel = request ? formatDocumentType(request.documentType) : "Document";
  const bottomInset = contentBottomInset(isEligible && hasValidFee ? "action" : "none");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Sacramental Fee Payment"
        subtitle={request?.trackingNumber || "Document Request"}
        onBack={handleBack}
        backAccessibilityLabel="Back to request details"
      />

      {loadingRequest || loadingConfig ? (
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={90} style={styles.skeletonItem} />
          <Skeleton width="100%" height={260} style={styles.skeletonItem} />
          <Skeleton width="100%" height={140} style={styles.skeletonItem} />
        </View>
      ) : !request ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Payment Unavailable"
            description="The requested document application could not be loaded."
            actionLabel="Return to Request Details"
            onAction={handleBack}
          />
        </View>
      ) : !hasValidFee ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Fee Configuration Unavailable"
            description="The parish has not supplied a valid fee for this request. Receipt upload is unavailable until staff corrects the configuration."
            actionLabel="Return to Request Details"
            onAction={handleBack}
          />
        </View>
      ) : !isEligible ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="No Payment Required"
            description={`This request is in status "${request?.status || "PENDING"}" and does not currently require payment submission.`}
            actionLabel="Return to Request Details"
            onAction={handleBack}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <ContentColumn>
            {/* Flat Summary Block */}
            <View style={styles.summaryBlock}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryInfo}>
                  <Text style={styles.docType} allowFontScaling>
                    {docTypeLabel}
                  </Text>
                  <Text style={styles.applicant} allowFontScaling>
                    Applicant: {request.applicantName}
                  </Text>
                  {request.parish?.parishName ? (
                    <Text style={styles.parish} allowFontScaling>
                      {request.parish.parishName}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.feeBox}>
                  <Text style={styles.feeCaption} allowFontScaling>
                    Total Fee
                  </Text>
                  <Text style={styles.feeAmount} allowFontScaling>
                    {feeLabel}
                  </Text>
                </View>
              </View>

              {request.paymentCorrectionNote ? (
                <View style={styles.correctionNoteBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.correctionNoteText} allowFontScaling>
                    Correction note from staff: {request.paymentCorrectionNote}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Payment Configuration (QR + Bank/Wallet info) */}
            <PaymentQrCard
              configuration={paymentConfig}
              feeAmount={request.fee}
            />

            {/* Receipt Selection & Preview */}
            <ReceiptCapturePicker
              receipt={selectedReceipt}
              onReceiptSelected={setSelectedReceipt}
              onReceiptRemoved={() => setSelectedReceipt(null)}
              disabled={isUploading}
            />

            {/* Security Notice */}
            <View style={styles.infoNotice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.infoNoticeText} allowFontScaling>
                Official receipts are verified by parish staff. Please ensure the reference number, amount, and date are legible.
              </Text>
            </View>
          </ContentColumn>
        </ScrollView>
      )}

      {isEligible && hasValidFee && (
        <SafeBottomActionBar onLayout={onBottomActionLayout}>
          <Button
            title={isUploading ? "Submitting Proof..." : "Submit Receipt for Review"}
            variant="primary"
            size="lg"
            icon="cloud-upload-outline"
            fullWidth
            style={styles.fullWidthAction}
            onPress={() => {
              void handleReceiptUpload();
            }}
            loading={isUploading}
            disabled={!selectedReceipt || isUploading}
            accessibilityLabel="Submit payment receipt for staff review"
          />
        </SafeBottomActionBar>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeletonItem: {
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  summaryBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  summaryInfo: {
    flex: 1,
  },
  docType: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  applicant: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  parish: {
    ...fontStyles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  feeBox: {
    alignItems: "flex-end",
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  feeCaption: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  feeAmount: {
    ...fontStyles.subheading,
    color: colors.primary,
    fontWeight: "800",
  },
  correctionNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  correctionNoteText: {
    ...fontStyles.caption,
    color: colors.danger,
    flex: 1,
  },
  infoNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  infoNoticeText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  fullWidthAction: {
    width: "100%",
  },
});
