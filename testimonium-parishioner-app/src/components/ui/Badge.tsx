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
  | "neutral"
  | "pending"
  | "under-review"
  | "ready"
  | "rejected"
  | "correction";

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
  const getVariantStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.variantSecondary;
      case "success":
      case "ready":
        return styles.variantSuccess;
      case "warning":
      case "pending":
        return styles.variantWarning;
      case "danger":
      case "rejected":
        return styles.variantDanger;
      case "info":
      case "under-review":
        return styles.variantInfo;
      case "correction":
        return styles.variantCorrection;
      case "neutral":
        return styles.variantNeutral;
      case "primary":
      default:
        return styles.variantPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.textSecondary;
      case "success":
      case "ready":
        return styles.textSuccess;
      case "warning":
      case "pending":
        return styles.textWarning;
      case "danger":
      case "rejected":
        return styles.textDanger;
      case "info":
      case "under-review":
        return styles.textInfo;
      case "correction":
        return styles.textCorrection;
      case "neutral":
        return styles.textNeutral;
      case "primary":
      default:
        return styles.textPrimary;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        size === "sm" && styles.badgeSm,
        size === "lg" && styles.badgeLg,
        getVariantStyle(),
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          size === "sm" && styles.textSm,
          getTextStyle(),
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
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  badgeLg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  text: {
    ...fontStyles.meta,
    fontWeight: "700",
  },
  textSm: {
    fontSize: 12,
    lineHeight: 14,
  },
  variantPrimary: {
    backgroundColor: colors.tagBg,
    borderColor: colors.primary + "30",
  },
  textPrimary: {
    color: colors.tagText,
  },
  variantSecondary: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.border,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  variantSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
  },
  textSuccess: {
    color: colors.success,
  },
  variantWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
  },
  textWarning: {
    color: colors.warning,
  },
  variantDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  textDanger: {
    color: colors.danger,
  },
  variantInfo: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoBorder,
  },
  textInfo: {
    color: colors.info,
  },
  variantCorrection: {
    backgroundColor: colors.correctionSoft,
    borderColor: colors.correctionBorder,
  },
  textCorrection: {
    color: colors.correction,
  },
  variantNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  textNeutral: {
    color: colors.textSecondary,
  },
});
