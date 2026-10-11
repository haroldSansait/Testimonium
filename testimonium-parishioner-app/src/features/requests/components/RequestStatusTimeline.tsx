import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { formatDateTime } from "../presentation";
import type { RequestHistoryItem } from "../types";

export interface RequestStatusTimelineProps {
  history?: RequestHistoryItem[];
  estimatedDays?: number | null;
}

export const RequestStatusTimeline: React.FC<RequestStatusTimelineProps> = ({
  history = [],
  estimatedDays,
}) => {
  if (!history || history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} allowFontScaling>
          No activity recorded yet.
        </Text>
      </View>
    );
  }

  // Sort chronologically ascending
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <View style={styles.container}>
      {estimatedDays ? (
        <View style={styles.estimateBanner}>
          <Ionicons
            name="hourglass-outline"
            size={16}
            color={colors.primary}
            style={styles.estimateIcon}
          />
          <Text style={styles.estimateText} allowFontScaling>
            Estimated Processing: ~{estimatedDays} working days upon verification
          </Text>
        </View>
      ) : null}

      <View style={styles.timelineList}>
        {sortedHistory.map((item, index) => {
          const isLast = index === sortedHistory.length - 1;
          const formattedDate = formatDateTime(item.createdAt);
          const actorName = item.actor?.fullName || (item.actorId ? "Parish Staff" : "System");

          return (
            <View key={item.id || index} style={styles.timelineItem}>
              <View style={styles.nodeColumn}>
                <View
                  style={[
                    styles.dot,
                    isLast ? styles.dotActive : styles.dotPast,
                  ]}
                >
                  <Ionicons
                    name={isLast ? "checkmark" : "ellipse"}
                    size={isLast ? 10 : 6}
                    color={colors.surface}
                  />
                </View>
                {!isLast && <View style={styles.line} />}
              </View>

              <View style={styles.contentColumn}>
                <View style={styles.row}>
                  <Text style={styles.actionTitle} allowFontScaling>
                    {formatActionLabel(item.action)}
                  </Text>
                  <Text style={styles.dateText} allowFontScaling>
                    {formattedDate}
                  </Text>
                </View>

                {item.remarks ? (
                  <Text style={styles.remarks} allowFontScaling>
                    {item.remarks}
                  </Text>
                ) : null}

                <Text style={styles.actorText} allowFontScaling>
                  By: {actorName}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const formatActionLabel = (action: string): string => {
  switch (action) {
    case "DRAFT_CREATED":
      return "Draft Initialized";
    case "SUBMITTED":
      return "Request Submitted";
    case "UNDER_REVIEW":
      return "Staff Review Started";
    case "NEEDS_CORRECTION":
      return "Correction Requested";
    case "RESUBMITTED":
      return "Corrections Resubmitted";
    case "RECEIPT_UPLOADED":
      return "Receipt Uploaded";
    case "CORRECTED_PAYMENT_SUBMITTED":
      return "Replacement Receipt Submitted";
    case "PAYMENT_VERIFIED":
      return "Payment Confirmed";
    case "PROCESSING":
    case "READY_FOR_SIGNING":
      return "Preparation Underway";
    case "READY_FOR_PICKUP":
      return "Marked Ready for Pickup";
    case "COMPLETED":
      return "Completed & Released";
    case "DOCUMENT_RETURNED":
      return "Document Returned for Correction";
    case "CORRECTED_DOCUMENT_UPLOADED":
      return "Corrected Document Prepared";
    case "CANCELLED":
      return "Request Cancelled";
    case "REJECTED":
      return "Request Declined";
    default:
      return action.replace(/_/g, " ");
  }
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: "center",
  },
  emptyText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  estimateBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  estimateIcon: {
    marginRight: spacing.xs,
  },
  estimateText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  timelineList: {
    paddingLeft: spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  nodeColumn: {
    alignItems: "center",
    width: 24,
    marginRight: spacing.sm,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotPast: {
    backgroundColor: colors.textMuted,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderLight,
    marginTop: 2,
    marginBottom: -4,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  actionTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  dateText: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  remarks: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 2,
  },
  actorText: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
});
