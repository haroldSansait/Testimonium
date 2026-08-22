import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          allowFontScaling
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} allowFontScaling>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel || actionLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText} allowFontScaling>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
  },
});
