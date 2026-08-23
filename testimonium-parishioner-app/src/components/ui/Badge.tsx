import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export type BadgeVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "primary",
  size = "md",
  style,
  textStyle,
  icon,
}) => {
  return (
    <View
      style={[
        styles.badge,
        size === "sm" && styles.badgeSm,
        size === "lg" && styles.badgeLg,
        variant === "primary" && styles.variantPrimary,
        variant === "secondary" && styles.variantSecondary,
        variant === "success" && styles.variantSuccess,
        variant === "warning" && styles.variantWarning,
        variant === "danger" && styles.variantDanger,
        variant === "info" && styles.variantInfo,
        variant === "neutral" && styles.variantNeutral,
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          variant === "primary" && styles.textPrimary,
          variant === "secondary" && styles.textSecondary,
          variant === "success" && styles.textSuccess,
          variant === "warning" && styles.textWarning,
          variant === "danger" && styles.textDanger,
          variant === "info" && styles.textInfo,
          variant === "neutral" && styles.textNeutral,
          textStyle,
        ]}
        numberOfLines={1}
        allowFontScaling
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.pill,
  },
  badgeSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
  },
  badgeLg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  text: {
    ...fontStyles.captionMedium,
  },
  variantPrimary: {
    backgroundColor: colors.tagBg,
  },
  textPrimary: {
    color: colors.tagText,
  },
  variantSecondary: {
    backgroundColor: colors.surfaceVariant,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  variantSuccess: {
    backgroundColor: colors.successSoft,
  },
  textSuccess: {
    color: colors.success,
  },
  variantWarning: {
    backgroundColor: colors.warningSoft,
  },
  textWarning: {
    color: colors.warning,
  },
  variantDanger: {
    backgroundColor: colors.dangerSoft,
  },
  textDanger: {
    color: colors.danger,
  },
  variantInfo: {
    backgroundColor: colors.infoSoft,
  },
  textInfo: {
    color: colors.info,
  },
  variantNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textNeutral: {
    color: colors.textSecondary,
  },
});
