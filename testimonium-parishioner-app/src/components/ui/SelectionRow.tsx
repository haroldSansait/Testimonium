import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { Divider } from "./Divider";
import { MotionPressable } from "./MotionPressable";

export interface SelectionRowProps {
  title: string;
  subtitle?: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  mode?: "radio" | "checkbox";
  disabled?: boolean;
  badge?: React.ReactNode;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const SelectionRow: React.FC<SelectionRowProps> = ({
  title,
  subtitle,
  description,
  selected,
  onSelect,
  mode = "radio",
  disabled = false,
  badge,
  showDivider = true,
  style,
  titleStyle,
  accessibilityLabel,
}) => {
  return (
    <View style={styles.wrapper}>
      <MotionPressable
        onPress={onSelect}
        disabled={disabled}
        accessibilityRole={mode === "radio" ? "radio" : "checkbox"}
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={accessibilityLabel ?? title}
        style={[
          styles.container,
          selected && styles.containerSelected,
          disabled && styles.disabled,
          style,
        ]}
      >
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                selected && styles.titleSelected,
                titleStyle,
              ]}
              allowFontScaling
            >
              {title}
            </Text>
            {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
          </View>

          {subtitle ? (
            <Text style={styles.subtitle} allowFontScaling>
              {subtitle}
            </Text>
          ) : null}

          {description ? (
            <Text style={styles.description} allowFontScaling>
              {description}
            </Text>
          ) : null}
        </View>

        <View style={styles.indicatorSlot}>
          {mode === "radio" ? (
            <View
              style={[
                styles.radioOuter,
                selected && styles.radioOuterSelected,
              ]}
            >
              {selected && <View style={styles.radioInner} />}
            </View>
          ) : (
            <View
              style={[
                styles.checkOuter,
                selected && styles.checkOuterSelected,
              ]}
            >
              {selected && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={colors.surface}
                />
              )}
            </View>
          )}
        </View>
      </MotionPressable>
      {showDivider ? <Divider /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
  },
  containerSelected: {
    backgroundColor: colors.brand[50],
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  title: {
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.neutral[950],
  },
  titleSelected: {
    color: colors.brand[700],
  },
  badgeSlot: {
    marginLeft: spacing.xs,
  },
  subtitle: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    marginTop: 2,
  },
  description: {
    ...fontStyles.caption,
    color: colors.neutral[500],
    marginTop: 4,
  },
  indicatorSlot: {
    justifyContent: "center",
    alignItems: "center",
    width: 28,
    height: 28,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  radioOuterSelected: {
    borderColor: colors.brand[700],
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand[700],
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  checkOuterSelected: {
    borderColor: colors.brand[700],
    backgroundColor: colors.brand[700],
  },
  disabled: {
    opacity: 0.45,
  },
});
