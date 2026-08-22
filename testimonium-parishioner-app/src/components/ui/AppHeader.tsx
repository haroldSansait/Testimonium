import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IconButton } from "./IconButton";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  largeTitle?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel = "Go back",
  rightAction,
  style,
  largeTitle = false,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        {onBack ? (
          <View style={styles.leftSlot}>
            <IconButton
              onPress={onBack}
              accessibilityLabel={backAccessibilityLabel}
              accessibilityHint="Navigates to the previous screen"
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </IconButton>
          </View>
        ) : (
          <View style={styles.leftEmptySlot} />
        )}

        {!largeTitle ? (
          <View style={styles.centerSlot}>
            <Text
              style={styles.title}
              numberOfLines={1}
              accessibilityRole="header"
              allowFontScaling
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
                allowFontScaling
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.flexFill} />
        )}

        <View style={styles.rightSlot}>
          {rightAction || <View style={styles.rightEmptySlot} />}
        </View>
      </View>

      {largeTitle ? (
        <View style={styles.largeTitleContainer}>
          <Text
            style={styles.largeTitle}
            accessibilityRole="header"
            allowFontScaling
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.largeSubtitle} allowFontScaling>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  leftSlot: {
    width: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  leftEmptySlot: {
    width: 44,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  flexFill: {
    flex: 1,
  },
  rightSlot: {
    width: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  rightEmptySlot: {
    width: 44,
  },
  title: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxs,
  },
  largeTitleContainer: {
    paddingVertical: spacing.sm,
  },
  largeTitle: {
    ...fontStyles.title,
    color: colors.textPrimary,
  },
  largeSubtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
});
