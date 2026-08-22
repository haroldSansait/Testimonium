import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        state.pressed && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" || variant === "ghost" ? colors.primary : colors.surface}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" && styles.primaryLabel,
            variant === "secondary" && styles.secondaryLabel,
            variant === "outline" && styles.outlineLabel,
            variant === "ghost" && styles.ghostLabel,
            isDisabled && styles.disabledLabel,
          ]}
          allowFontScaling
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: "row",
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
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.body,
    fontWeight: "600",
    textAlign: "center",
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
  disabledLabel: {
    color: colors.disabled,
  },
});