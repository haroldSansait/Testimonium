import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface FilterTriggerProps {
  activeCount?: number;
  onPress: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export const FilterTrigger: React.FC<FilterTriggerProps> = ({
  activeCount = 0,
  onPress,
  label = "Filter",
  style,
}) => {
  const hasActiveFilters = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${hasActiveFilters ? `, ${activeCount} active` : ""}`}
      style={({ pressed }) => [
        styles.container,
        hasActiveFilters && styles.containerActive,
        pressed && styles.pressed,
        style,
      ]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons
        name="filter-outline"
        size={16}
        color={hasActiveFilters ? colors.brand[700] : colors.neutral[800]}
        style={styles.icon}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
      <Text
        style={[
          styles.label,
          hasActiveFilters && styles.labelActive,
        ]}
        allowFontScaling
      >
        {label}
      </Text>
      {hasActiveFilters ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} allowFontScaling>
            {activeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  containerActive: {
    borderColor: colors.brand[700],
    backgroundColor: colors.brand[50],
  },
  icon: {
    marginRight: 2,
  },
  label: {
    ...fontStyles.captionMedium,
    color: colors.neutral[800],
    fontWeight: "600",
  },
  labelActive: {
    color: colors.brand[700],
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand[700],
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
