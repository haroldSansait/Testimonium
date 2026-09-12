import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { CaloySource } from "../types";

interface CaloyVerifiedSourcesProps {
  sources?: CaloySource[];
}

export const CaloyVerifiedSources: React.FC<CaloyVerifiedSourcesProps> = ({
  sources,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.headerButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Verified Sources, ${sources.length} sources available. ${isExpanded ? "Collapse" : "Expand"}`}
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name="shield-checkmark"
            size={14}
            color={colors.primary}
          />
          <Text style={styles.headerTitle} allowFontScaling>
            Verified Sources ({sources.length})
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.textSecondary}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.contentList}>
          {sources.map((source, index) => {
            const displayTitle = source.title || `Official Source ${index + 1}`;
            return (
              <View key={source.id || index} style={styles.sourceItem}>
                <View style={styles.sourceNumberBadge}>
                  <Text style={styles.sourceNumberText}>[{index + 1}]</Text>
                </View>
                <View style={styles.sourceBody}>
                  <Text style={styles.sourceTitle} allowFontScaling>
                    {displayTitle}
                  </Text>
                  {source.authority ? (
                    <Text style={styles.sourceAuthority} allowFontScaling>
                      Authority: {source.authority}
                    </Text>
                  ) : null}
                  {source.sourceReference ? (
                    <Text style={styles.sourceReference} allowFontScaling>
                      Ref: {source.sourceReference}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  headerButtonPressed: {
    opacity: 0.8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    ...fontStyles.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  contentList: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
  },
  sourceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  sourceNumberBadge: {
    paddingTop: 1,
  },
  sourceNumberText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
  },
  sourceBody: {
    flex: 1,
    gap: 1,
  },
  sourceTitle: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  sourceAuthority: {
    ...fontStyles.meta,
    color: colors.textSecondary,
  },
  sourceReference: {
    ...fontStyles.meta,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
