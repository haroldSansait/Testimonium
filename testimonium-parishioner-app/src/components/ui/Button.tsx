import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const defaultHitSlop =
    size === "sm"
      ? { top: 6, bottom: 6, left: 6, right: 6 }
      : undefined;

  const iconColor =
    variant === "primary" || variant === "danger"
      ? colors.surface
      : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={props.hitSlop ?? defaultHitSlop}
      style={(state) => [
        styles.base,
        size === "sm" && styles.sizeSm,
        size === "md" && styles.sizeMd,
        size === "lg" && styles.sizeLg,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "outline" || variant === "ghost" || variant === "secondary"
              ? colors.primary
              : colors.surface
          }
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? (
            <Ionicons
              name={icon}
              size={size === "sm" ? 16 : 18}
              color={iconColor}
              style={styles.icon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          ) : null}
          <Text
            style={[
              styles.label,
              size === "sm" && styles.labelSm,
              size === "lg" && styles.labelLg,
              variant === "primary" && styles.primaryLabel,
              variant === "secondary" && styles.secondaryLabel,
              variant === "outline" && styles.outlineLabel,
              variant === "ghost" && styles.ghostLabel,
              variant === "danger" && styles.dangerLabel,
              isDisabled && styles.disabledLabel,
            ]}
            allowFontScaling
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: "row",
  },
  sizeSm: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sizeMd: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sizeLg: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: spacing.xs,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...fontStyles.button,
    textAlign: "center",
  },
  labelSm: {
    ...fontStyles.captionMedium,
  },
  labelLg: {
    ...fontStyles.subheading,
  },
  primaryLabel: {
    color: colors.surface,
  },
  secondaryLabel: {
    color: colors.primary,
  },
  outlineLabel: {
    color: colors.textPrimary,
  },
  ghostLabel: {
    color: colors.primary,
  },
  dangerLabel: {
    color: colors.surface,
  },
  disabledLabel: {
    color: colors.disabled,
  },
});