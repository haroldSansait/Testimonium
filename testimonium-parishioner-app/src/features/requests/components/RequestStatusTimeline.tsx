import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { formatActionLabel, formatDateTime, formatHistoryRemarks } from "../presentation";
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
          const formattedRemarks = formatHistoryRemarks(item);

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
                    {formatActionLabel(item.action, item)}
                  </Text>
                  <Text style={styles.dateText} allowFontScaling>
                    {formattedDate}
                  </Text>
                </View>

                {formattedRemarks ? (
                  <Text style={styles.remarks} allowFontScaling>
                    {formattedRemarks}
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
