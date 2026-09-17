import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { ScheduleRecommendationItem } from "../types";

export const PREFERRED_PRIEST_HELPER_COPY =
  "Your preferred priest may not be available for every suggested time. The parish can still assign another priest.";

export const PREFERRED_PRIEST_AVAILABLE_LABEL = "Preferred Priest Available";
export const PREFERRED_PRIEST_UNAVAILABLE_LABEL = "Preferred Priest Unavailable";

export const PREFERRED_PRIEST_AVAILABLE_TOOLTIP =
  "Your preferred priest is available at this time.";
export const PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP =
  "Your preferred priest is unavailable at this time, but another priest may be assigned.";

export interface SuggestedTimeCardProps {
  rec: ScheduleRecommendationItem;
  isSelected?: boolean;
  onSelect: () => void;
}

export const SuggestedTimeCard: React.FC<SuggestedTimeCardProps> = ({
  rec,
  isSelected = false,
  onSelect,
}) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onSelect}
      style={[styles.suggestionCard, isSelected && styles.suggestionCardSelected]}
    >
      <View style={styles.suggestionHeader}>
        <Text style={[styles.suggestionDate, isSelected && styles.suggestionDateSelected]} allowFontScaling>
          {rec.date}
        </Text>
        <Text style={[styles.suggestionTime, isSelected && styles.suggestionTimeSelected]} allowFontScaling>
          {rec.timeSlot}
        </Text>
      </View>
      <View style={styles.badgeRow}>
        {rec.reasons?.includes("PREFERRED_DATE") && (
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonBadgeText} allowFontScaling>
              Preferred Date
            </Text>
          </View>
        )}
        {rec.reasons?.includes("PREFERRED_TIME") && (
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonBadgeText} allowFontScaling>
              Preferred Time
            </Text>
          </View>
        )}
        {rec.preferredPriestAvailable === true && (
          <View
            style={[styles.reasonBadge, styles.badgeSuccess]}
            accessibilityLabel={PREFERRED_PRIEST_AVAILABLE_TOOLTIP}
          >
            <Text style={styles.badgeSuccessText} allowFontScaling>
              {PREFERRED_PRIEST_AVAILABLE_LABEL}
            </Text>
          </View>
        )}
        {rec.preferredPriestAvailable === false && (
          <View
            style={[styles.reasonBadge, styles.badgeWarning]}
            accessibilityLabel={PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP}
          >
            <Text style={styles.badgeWarningText} allowFontScaling>
              {PREFERRED_PRIEST_UNAVAILABLE_LABEL}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  suggestionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  suggestionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  suggestionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  suggestionDate: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  suggestionDateSelected: {
    color: colors.primary,
  },
  suggestionTime: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  suggestionTimeSelected: {
    color: colors.primary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  reasonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  reasonBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  badgeSuccess: {
    backgroundColor: "#ecfdf5",
  },
  badgeSuccessText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  badgeWarning: {
    backgroundColor: "#fffbeb",
  },
  badgeWarningText: {
    fontSize: 12,
    color: "#b45309",
    fontWeight: "600",
  },
});
