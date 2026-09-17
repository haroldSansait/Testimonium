import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export interface PageSectionProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  serifTitle?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  serifTitle = false,
  children,
  style,
  titleStyle,
  contentStyle,
}) => {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text
              style={[
                styles.title,
                serifTitle && fontStyles.titleSerif,
                titleStyle,
              ]}
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
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionPressed,
              ]}
            >
              <Text style={styles.actionText} allowFontScaling>
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...fontStyles.heading,
    color: colors.neutral[950],
  },
  subtitle: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    marginTop: 2,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...fontStyles.button,
    color: colors.brand[700],
  },
  content: {
    width: "100%",
  },
});
