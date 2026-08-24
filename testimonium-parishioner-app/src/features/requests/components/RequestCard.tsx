import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  formatDate,
  formatDocumentType,
  formatFee,
  formatStatus,
  isPaymentEligible,
  isDocumentCorrectionEligible,
} from "../presentation";
import type { DocumentRequestDetail } from "../types";

export interface RequestCardProps {
  request: DocumentRequestDetail;
  onPress: (request: DocumentRequestDetail) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onPress }) => {
  const statusInfo = formatStatus(request.status, request.isDraft);
  const docTypeLabel = formatDocumentType(request.documentType);
  const dateLabel = formatDate(request.dateRequested || request.createdAt);
  const feeLabel = formatFee(request.fee);
  const parishName = request.parish?.parishName || "Parish Document";

  const showPaymentAlert = isPaymentEligible(request);
  const showCorrectionAlert = isDocumentCorrectionEligible(request);

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        onPress={() => onPress(request)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${docTypeLabel} for ${request.applicantName}, status: ${statusInfo.label}, tracking number: ${request.trackingNumber || "Draft"}`}
        style={styles.touchable}
      >
        <View style={styles.topRow}>
          <View style={styles.trackingBox}>
            <Ionicons name="document-text" size={15} color={colors.primary} />
            <Text style={styles.trackingText} allowFontScaling numberOfLines={1}>
              {request.trackingNumber || "Draft Request"}
            </Text>
          </View>
          <Badge
            label={statusInfo.label}
            variant={statusInfo.variant}
            size="sm"
          />
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.docType} numberOfLines={1} allowFontScaling>
            {docTypeLabel}
          </Text>
          <Text style={styles.applicant} numberOfLines={1} allowFontScaling>
            Applicant: {request.applicantName}
          </Text>
        </View>

        <View style={styles.metaDivider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="business-outline"
              size={13}
              color={colors.textMuted}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} numberOfLines={1} allowFontScaling>
              {parishName}
            </Text>
          </View>

          <View style={styles.metaItemRight}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.textMuted}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} allowFontScaling>
              {dateLabel}
            </Text>
          </View>
        </View>

        {request.fee !== null && request.fee !== undefined ? (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel} allowFontScaling>
              Processing Fee
            </Text>
            <Text style={styles.feeValue} allowFontScaling>
              {feeLabel}
            </Text>
          </View>
        ) : null}

        {/* Attention Action Banners */}
        {request.isDraft ? (
          <View style={[styles.alertBanner, styles.draftBanner]}>
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={styles.alertText} allowFontScaling>
              Continue Draft & Attach Documents
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        ) : showPaymentAlert ? (
          <View style={[styles.alertBanner, styles.paymentBanner]}>
            <Ionicons name="card-outline" size={15} color={colors.primary} />
            <Text style={styles.alertText} allowFontScaling>
              Payment Required — Settle {feeLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        ) : showCorrectionAlert ? (
          <View style={[styles.alertBanner, styles.correctionBanner]}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={[styles.alertText, { color: colors.danger }]} allowFontScaling>
              Action Required: Submit Corrections
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.danger} />
          </View>
        ) : null}
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  touchable: {
    padding: spacing.md,
    minHeight: 44,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  trackingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingRight: spacing.xs,
  },
  trackingText: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    fontFamily: "monospace",
    letterSpacing: 0.3,
  },
  mainInfo: {
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
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
  metaDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: spacing.xs,
  },
  metaItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  feeLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  feeValue: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  draftBanner: {
    backgroundColor: colors.primarySoft,
  },
  paymentBanner: {
    backgroundColor: colors.primarySoft,
  },
  correctionBanner: {
    backgroundColor: colors.dangerSoft,
  },
  alertText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
  },
});
