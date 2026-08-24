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
              size={44}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </IconButton>
          </View>
        ) : null}

        {!largeTitle ? (
          <View style={[styles.titleSlot, !onBack && styles.titleSlotNoBack]}>
            <Text
              style={[styles.title, !onBack && styles.titleNoBack]}
              numberOfLines={1}
              accessibilityRole="header"
              allowFontScaling
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[styles.subtitle, !onBack && styles.subtitleNoBack]}
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

        {rightAction ? (
          <View style={styles.rightSlot}>
            {rightAction}
          </View>
        ) : onBack ? (
          <View style={styles.rightEmptySlot} />
        ) : null}
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
    borderBottomColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    gap: spacing.xs,
  },
  leftSlot: {
    width: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  titleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  titleSlotNoBack: {
    alignItems: "flex-start",
    paddingHorizontal: 0,
    paddingRight: spacing.sm,
  },
  flexFill: {
    flex: 1,
  },
  rightSlot: {
    justifyContent: "center",
    alignItems: "flex-end",
    flexShrink: 0,
  },
  rightEmptySlot: {
    width: 44,
  },
  title: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  titleNoBack: {
    textAlign: "left",
  },
  subtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxs,
  },
  subtitleNoBack: {
    textAlign: "left",
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
