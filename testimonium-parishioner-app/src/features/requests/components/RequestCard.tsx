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
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.docType} numberOfLines={1} allowFontScaling>
              {docTypeLabel}
            </Text>
            <Text style={styles.applicant} numberOfLines={1} allowFontScaling>
              For: {request.applicantName}
            </Text>
          </View>

          <Badge
            label={statusInfo.label}
            variant={statusInfo.variant}
            size="sm"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="business-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.metaText} numberOfLines={1} allowFontScaling>
              {parishName}
            </Text>
          </View>

          <View style={styles.metaItemRight}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.metaText} allowFontScaling>
              {dateLabel}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.trackingText} allowFontScaling>
            {request.trackingNumber ? `Ref: ${request.trackingNumber}` : "Draft Request"}
          </Text>

          {request.fee !== null && request.fee !== undefined ? (
            <Text style={styles.feeText} allowFontScaling>
              Fee: {feeLabel}
            </Text>
          ) : null}
        </View>

        {/* Attention Action Banners */}
        {request.isDraft ? (
          <View style={[styles.alertBanner, styles.draftBanner]}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.alertText} allowFontScaling>
              Continue Draft & Attach Documents
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        ) : showPaymentAlert ? (
          <View style={[styles.alertBanner, styles.paymentBanner]}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={styles.alertText} allowFontScaling>
              Payment Required: {feeLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        ) : showCorrectionAlert ? (
          <View style={[styles.alertBanner, styles.correctionBanner]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.alertText, { color: colors.danger }]} allowFontScaling>
              Action Required: Submit Corrections
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
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
  },
  touchable: {
    padding: spacing.md,
    minHeight: 44,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleContainer: {
    flex: 1,
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
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingText: {
    ...fontStyles.captionMedium,
    color: colors.textMuted,
  },
  feeText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
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
