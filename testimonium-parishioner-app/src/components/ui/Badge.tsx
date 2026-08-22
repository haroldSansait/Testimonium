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
  | "info"
  | "neutral";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "primary",
  style,
  textStyle,
  icon,
}) => {
  return (
    <View
      style={[
        styles.badge,
        variant === "primary" && styles.variantPrimary,
        variant === "secondary" && styles.variantSecondary,
        variant === "success" && styles.variantSuccess,
        variant === "warning" && styles.variantWarning,
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
