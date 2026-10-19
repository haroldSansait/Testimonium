import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionPressable } from "@/components/ui/MotionPressable";
import { StatusLabel } from "@/components/ui/StatusLabel";
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
  const docTypeLabel = formatDocumentType(request.documentType);
  const statusInfo = formatStatus(request.status, request.isDraft);
  const dateLabel = formatDate(request.dateRequested || request.createdAt);
  const feeLabel = formatFee(request.fee);
  const parishName = request.parish?.parishName || "Parish Document";

  const showPaymentAlert = isPaymentEligible(request);
  const showCorrectionAlert = isDocumentCorrectionEligible(request);

  return (
    <View style={styles.container}>
      <MotionPressable
        onPress={() => onPress(request)}
        accessibilityRole="button"
        accessibilityLabel={`${docTypeLabel} for ${request.applicantName}, status: ${statusInfo.label}, tracking number: ${request.trackingNumber || "Draft"}`}
        accessibilityHint="Opens request details"
        style={styles.pressable}
      >
        {/* Top Tracking & Status Row */}
        <View style={styles.topRow}>
          <View style={styles.trackingBox}>
            <Ionicons name="document-text-outline" size={15} color={colors.primary} />
            <Text style={styles.trackingText} allowFontScaling numberOfLines={1}>
              {request.trackingNumber || "Draft Request"}
            </Text>
          </View>
          <StatusLabel status={request.isDraft ? "DRAFT" : request.status} />
        </View>

        {/* Document Type & Applicant */}
        <View style={styles.mainInfo}>
          <Text style={styles.docType} numberOfLines={1} allowFontScaling>
            {docTypeLabel}
          </Text>
          <Text style={styles.applicant} numberOfLines={1} allowFontScaling>
            Applicant: {request.applicantName}
          </Text>
        </View>

        {/* Parish & Date Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.primary}
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
              color={colors.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText} allowFontScaling>
              {dateLabel}
            </Text>
          </View>
        </View>

        {/* Fee row if present */}
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
        ) : request.status === "RETURNED" ? (
          <View style={[styles.alertBanner, styles.returnedBanner]}>
            <Ionicons name="return-down-back-outline" size={15} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]} allowFontScaling>
              Returned for Correction — In Preparation
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.warning} />
          </View>
        ) : null}
      </MotionPressable>
    </View>
  );
};

export const RequestListItem = RequestCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  pressable: {
    padding: spacing.md,
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
    letterSpacing: 0.3,
  },
  mainInfo: {
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
  },
  docType: {
    ...fontStyles.bodyMedium,
    fontFamily: fontStyles.titleSerif.fontFamily,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  applicant: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    color: colors.textSecondary,
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
    paddingVertical: spacing.xs + 2,
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
  returnedBanner: {
    backgroundColor: colors.warningSoft || "#FFF8E1",
  },
  alertText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
  },
});
