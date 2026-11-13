import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Typography";
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
  onResumeDraft?: (request: DocumentRequestDetail) => void;
  onDiscardDraft?: (request: DocumentRequestDetail) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onPress,
  onResumeDraft,
  onDiscardDraft,
}) => {
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
          <View style={styles.draftActionsWrap}>
            <View style={[styles.alertBanner, styles.draftBanner]}>
              <Ionicons name="create-outline" size={15} color={colors.primary} />
              <Text style={styles.alertText} allowFontScaling>
                Saved Draft — Complete Details & Attachments
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
            {(onResumeDraft || onDiscardDraft) ? (
              <View style={styles.draftBtnRow}>
                {onResumeDraft ? (
                  <Pressable
                    onPress={() => onResumeDraft(request)}
                    style={styles.draftPrimaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Resume draft for ${docTypeLabel}`}
                  >
                    <Ionicons name="play-outline" size={14} color={colors.primary} />
                    <Text style={styles.draftPrimaryBtnText} allowFontScaling>
                      Resume Draft
                    </Text>
                  </Pressable>
                ) : null}
                {onDiscardDraft ? (
                  <Pressable
                    onPress={() => onDiscardDraft(request)}
                    style={styles.draftDangerBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Discard draft for ${docTypeLabel}`}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={styles.draftDangerBtnText} allowFontScaling>
                      Discard
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
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
  draftActionsWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  draftBtnRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  draftPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  draftPrimaryBtnText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  draftDangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
  },
  draftDangerBtnText: {
    ...fontStyles.captionMedium,
    color: colors.danger,
    fontWeight: "600",
  },
});
