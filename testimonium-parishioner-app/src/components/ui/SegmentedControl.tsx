import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string = string>({
  options,
  selectedValue,
  onSelect,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const isSelected = option.value === selectedValue;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              isSelected && styles.segmentSelected,
            ]}
          >
            <Text
              style={[
                styles.label,
                isSelected && styles.labelSelected,
              ]}
              allowFontScaling
            >
              {option.label}
            </Text>
            {typeof option.badge === "number" && option.badge > 0 ? (
              <View
                style={[
                  styles.badge,
                  isSelected && styles.badgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected && styles.badgeTextSelected,
                  ]}
                  allowFontScaling
                >
                  {option.badge}
                </Text>
              </View>
            ) : null}
            {isSelected && <View style={styles.activeIndicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    width: "100%",
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    position: "relative",
    gap: spacing.xs,
  },
  segmentSelected: {
    backgroundColor: "transparent",
  },
  label: {
    ...fontStyles.bodySmall,
    fontWeight: "500",
    color: colors.neutral[650],
  },
  labelSelected: {
    fontWeight: "600",
    color: colors.brand[700],
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[200],
  },
  badgeSelected: {
    backgroundColor: colors.brand[50],
  },
  badgeText: {
    ...fontStyles.caption,
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[650],
  },
  badgeTextSelected: {
    color: colors.brand[700],
  },
  activeIndicator: {
    position: "absolute",
    bottom: -1,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.brand[700],
    borderRadius: 1,
  },
});
