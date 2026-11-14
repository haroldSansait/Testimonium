import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  formatActionLabel,
  formatDateTime,
  formatHistoryRemarks,
  getDocumentWorkflowStages,
} from "../presentation";
import type { DocumentRequestDetail, RequestHistoryItem } from "../types";

export interface RequestStatusTimelineProps {
  history?: RequestHistoryItem[];
  estimatedDays?: number | null;
  request?: Pick<DocumentRequestDetail, "status" | "isDraft"> | null;
}

export const RequestStatusTimeline: React.FC<RequestStatusTimelineProps> = ({
  history = [],
  estimatedDays,
  request,
}) => {
  const workflowStages = getDocumentWorkflowStages(request);

  if ((!history || history.length === 0) && workflowStages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} allowFontScaling>
          No activity recorded yet.
        </Text>
      </View>
    );
  }

  // Sort chronologically descending (newest first)
  const sortedHistory = [...(history || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

      {sortedHistory.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader} allowFontScaling>
            Recorded Events
          </Text>
          <View style={styles.timelineList}>
            {sortedHistory.map((item, index) => {
              const isLatest = index === 0;
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
                        isLatest ? styles.dotActive : styles.dotPast,
                      ]}
                    >
                      <Ionicons
                        name={isLatest ? "checkmark" : "ellipse"}
                        size={isLatest ? 10 : 6}
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
      ) : null}

      {workflowStages.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader} allowFontScaling>
            Expected Processing Stages
          </Text>
          <View style={styles.stagesList}>
            {workflowStages.map((stage) => {
              const isDone = stage.state === "done";
              const isCurrent = stage.state === "current";
              return (
                <View key={stage.key} style={styles.stageRow}>
                  <Ionicons
                    name={
                      isDone
                        ? "checkmark-circle"
                        : isCurrent
                          ? "radio-button-on"
                          : "ellipse-outline"
                    }
                    size={16}
                    color={
                      isDone
                        ? colors.success
                        : isCurrent
                          ? colors.primary
                          : colors.textMuted
                    }
                    style={styles.stageIcon}
                  />
                  <View style={styles.stageBody}>
                    <View style={styles.stageTitleRow}>
                      <Text
                        style={[
                          styles.stageLabel,
                          isCurrent && styles.stageLabelCurrent,
                          !isDone && !isCurrent && styles.stageLabelUpcoming,
                        ]}
                        allowFontScaling
                      >
                        {stage.label}
                      </Text>
                      <Text style={styles.stageStateTag} allowFontScaling>
                        {isDone ? "Recorded" : isCurrent ? "Current" : "Pending"}
                      </Text>
                    </View>
                    <Text style={styles.stageDesc} allowFontScaling>
                      {stage.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
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
  sectionBlock: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  sectionHeader: {
    ...fontStyles.captionBold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
  },
  stagesList: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  stageIcon: {
    marginTop: 2,
  },
  stageBody: {
    flex: 1,
  },
  stageTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  stageLabel: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  stageLabelCurrent: {
    color: colors.primary,
    fontWeight: "700",
  },
  stageLabelUpcoming: {
    color: colors.textSecondary,
  },
  stageStateTag: {
    ...fontStyles.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  stageDesc: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
});
