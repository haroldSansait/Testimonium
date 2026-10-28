import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  iconStyle?: StyleProp<TextStyle>;
  leftComponent?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  icon,
  iconSize,
  iconStyle,
  leftComponent,
  fullWidth = false,
  loading = false,
  disabled,
  style,
  textStyle,
  numberOfLines = 1,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const defaultHitSlop =
    size === "sm"
      ? { top: 4, bottom: 4, left: 4, right: 4 }
      : undefined;

  const iconColor =
    variant === "primary" || variant === "danger"
      ? colors.surface
      : colors.brand[700];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={props.hitSlop ?? defaultHitSlop}
      style={(state) => [
        styles.base,
        fullWidth && styles.fullWidth,
        size === "sm" && styles.sizeSm,
        size === "md" && styles.sizeMd,
        size === "lg" && styles.sizeLg,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        state.pressed && !isDisabled && (variant === "primary" ? styles.pressedPrimary : styles.pressedDefault),
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "outline" || variant === "ghost" || variant === "secondary"
              ? colors.brand[700]
              : colors.surface
          }
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {leftComponent ? (
            leftComponent
          ) : icon ? (
            <Ionicons
              name={icon}
              size={iconSize ?? (size === "sm" ? 16 : 18)}
              color={iconColor}
              style={[styles.icon, iconStyle]}
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
              textStyle,
            ]}
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
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
    borderRadius: radii.button,
    flexDirection: "row",
  },
  sizeSm: {
    minHeight: 44,
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
    backgroundColor: colors.brand[700],
  },
  secondary: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[700],
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.danger,
  },
  fullWidth: {
    width: "100%",
    alignSelf: "stretch",
  },
  pressedPrimary: {
    backgroundColor: colors.brand[800],
    opacity: 0.95,
  },
  pressedDefault: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...fontStyles.button,
    textAlign: "center",
  },
  labelSm: {
    ...fontStyles.captionMedium,
    fontSize: 13,
  },
  labelLg: {
    ...fontStyles.subheading,
    fontSize: 16,
  },
  primaryLabel: {
    color: colors.surface,
  },
  secondaryLabel: {
    color: colors.brand[700],
  },
  outlineLabel: {
    color: colors.neutral[950],
  },
  ghostLabel: {
    color: colors.brand[700],
  },
  dangerLabel: {
    color: colors.surface,
  },
  disabledLabel: {
    color: colors.neutral[500],
  },
});