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
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  usePaymentConfiguration,
  useRequestDetail,
  useUploadPaymentReceipt,
} from "./api";
import { PaymentQrCard } from "./components/PaymentQrCard";
import { ReceiptCapturePicker } from "./components/ReceiptCapturePicker";
import { formatDocumentType, formatFee, isPaymentEligible } from "./presentation";
import type { LocalSelectedReceipt } from "./types";

export interface PaymentScreenProps {
  requestId?: string | null;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({ requestId }) => {
  const router = useRouter();
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
    if (!request || !selectedReceipt || inFlightGuard.current) return;

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

      // On ambiguous or network failure, refetch to check if server already registered the receipt
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
  const feeLabel = request ? formatFee(request.fee) : "₱0.00";
  const docTypeLabel = request ? formatDocumentType(request.documentType) : "Document";

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
          <Skeleton width="100%" height={100} style={styles.skeletonItem} />
          <Skeleton width="100%" height={260} style={styles.skeletonItem} />
          <Skeleton width="100%" height={140} style={styles.skeletonItem} />
        </View>
      ) : !request || !isEligible ? (
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Banner */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryInfo}>
                <Text style={styles.docType} allowFontScaling>
                  {docTypeLabel}
                </Text>
                <Text style={styles.applicant} allowFontScaling>
                  Applicant: {request.applicantName}
                </Text>
                <Text style={styles.parish} allowFontScaling>
                  {request.parish?.parishName}
                </Text>
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
          </Card>

          {/* Payment Configuration Card (QR + Bank/Wallet info) */}
          <PaymentQrCard
            configuration={paymentConfig}
            feeAmount={request.fee}
          />

          {/* Receipt Selection & Preview (Gallery + Camera) */}
          <ReceiptCapturePicker
            receipt={selectedReceipt}
            onReceiptSelected={setSelectedReceipt}
            onReceiptRemoved={() => setSelectedReceipt(null)}
            disabled={isUploading}
          />

          {/* Notice */}
          <View style={styles.infoNotice}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.infoNoticeText} allowFontScaling>
              Receipts are securely verified by parish staff. Please ensure the reference number, amount, and date are clearly visible.
            </Text>
          </View>

          {/* Submit Action */}
          <Button
            title={isUploading ? "Submitting Proof..." : "Submit Receipt for Review"}
            variant="primary"
            size="lg"
            icon="cloud-upload-outline"
            onPress={handleReceiptUpload}
            loading={isUploading}
            disabled={!selectedReceipt || isUploading}
            style={styles.submitBtn}
            accessibilityLabel="Submit payment receipt for staff review"
          />
        </ScrollView>
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
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    padding: spacing.md,
  },
  skeletonItem: {
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  docType: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
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
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  feeCaption: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  feeAmount: {
    ...fontStyles.subheading,
    color: colors.primary,
    fontWeight: "700",
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
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
