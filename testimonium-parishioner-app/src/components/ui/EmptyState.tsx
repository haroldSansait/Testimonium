import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = "information-circle-outline",
  actionLabel,
  onAction,
  actionLoading = false,
  style,
  compact = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        style,
      ]}
      accessible={true}
    >
      <View style={[styles.iconContainer, compact && styles.iconContainerCompact]}>
        <Ionicons
          name={icon}
          size={compact ? 28 : 40}
          color={colors.primary}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      </View>
      <Text
        style={[styles.title, compact && styles.titleCompact]}
        allowFontScaling
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[styles.description, compact && styles.descriptionCompact]}
          allowFontScaling
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          variant="secondary"
          size={compact ? "sm" : "md"}
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  containerCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  iconContainerCompact: {
    width: 48,
    height: 48,
    marginBottom: spacing.sm,
  },
  title: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  titleCompact: {
    ...fontStyles.subheading,
    marginBottom: spacing.xxs,
  },
  description: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  descriptionCompact: {
    ...fontStyles.caption,
    maxWidth: 240,
  },
  actionButton: {
    marginTop: spacing.md,
  },
});

