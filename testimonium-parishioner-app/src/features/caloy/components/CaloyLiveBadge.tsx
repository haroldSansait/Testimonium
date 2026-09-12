import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

interface CaloyLiveBadgeProps {
  label?: string;
}

export const CaloyLiveBadge: React.FC<CaloyLiveBadgeProps> = ({
  label = "Current TESTIMONIUM Data",
}) => {
  return (
    <View
      style={styles.badgeContainer}
      accessibilityRole="text"
      accessibilityLabel={`${label} verified live`}
    >
      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
      <Text style={styles.badgeText} allowFontScaling>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  badgeText: {
    ...fontStyles.meta,
    color: colors.success,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
