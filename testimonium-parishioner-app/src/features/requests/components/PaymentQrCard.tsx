import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { PaymentConfiguration } from "../types";

export interface PaymentQrCardProps {
  configuration?: PaymentConfiguration | null;
  feeAmount?: string | number | null;
}

export const PaymentQrCard: React.FC<PaymentQrCardProps> = ({
  configuration,
  feeAmount,
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const qrUrl = configuration?.qrCode?.imageUrl ?? null;
  const qrImageUrl = qrUrl || "";
  const imageError = failedImageUrl === qrUrl;
  const isConfigured = Boolean(
    configuration?.configured && configuration.qrCode?.enabled && qrUrl,
  );

  if (!isConfigured) {
    return (
      <View style={styles.container}>
        <View style={styles.unconfiguredHeader}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.headerTitle} allowFontScaling>
            Payment Instructions
          </Text>
        </View>
        <Text style={styles.unconfiguredDesc} allowFontScaling>
          {configuration?.message ||
            "Online payment details are not yet configured for this parish. Please contact the parish office directly before submitting your receipt."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle} allowFontScaling>
        Official Payment Instructions
      </Text>
      <Text style={styles.headerSubtitle} allowFontScaling>
        Scan the parish payment QR code, then upload your receipt for review.
      </Text>

      {!imageError ? (
        <View style={styles.qrContainer}>
          <View style={styles.qrFrame}>
            {imageLoading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            <Image
              source={{ uri: qrImageUrl }}
              style={styles.qrImage}
              resizeMode="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setFailedImageUrl(qrUrl)}
              accessibilityRole="image"
              accessibilityLabel="Official parish payment QR code"
            />
          </View>
          <Text style={styles.qrPrompt} allowFontScaling>
            Scan using the payment app supported by this parish QR code.
          </Text>
        </View>
      ) : (
        <View style={styles.noQrNotice}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.noQrText} allowFontScaling>
            The parish payment QR could not be displayed. Please contact the parish office before submitting your receipt.
          </Text>
        </View>
      )}

      {feeAmount !== null && feeAmount !== undefined ? (
        <View style={styles.feeBox}>
          <Text style={styles.detailLabel} allowFontScaling>
            Amount to Pay:
          </Text>
          <Text style={styles.feeHighlight} allowFontScaling>
            {typeof feeAmount === "number" ? `\u20B1${feeAmount.toFixed(2)}` : String(feeAmount)}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  headerSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: spacing.sm,
  },
  qrFrame: {
    width: 200,
    height: 200,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderRadius: radii.md,
  },
  qrPrompt: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  noQrNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  noQrText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  feeBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
  },
  detailLabel: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
  },
  feeHighlight: {
    ...fontStyles.subheading,
    color: colors.primary,
    fontWeight: "700",
  },
  unconfiguredHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  unconfiguredDesc: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
