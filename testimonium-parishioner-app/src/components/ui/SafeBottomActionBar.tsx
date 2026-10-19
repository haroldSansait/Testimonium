import React from "react";
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, spacing } from "@/theme/tokens";

export interface SafeBottomActionBarProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const BOTTOM_BREATHING_ROOM = 10;

export const SafeBottomActionBar: React.FC<SafeBottomActionBarProps> = ({
  children,
  style,
  contentStyle,
  onLayout,
}) => {
  const insets = useSafeAreaInsets();
  // Provide modest additional breathing room (8-12dp) above the Android system
  // navigation bar and iOS home indicator, while respecting device safe-area insets.
  const bottomPadding = Math.max(insets.bottom, spacing.md) + BOTTOM_BREATHING_ROOM;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { paddingBottom: bottomPadding },
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadows.sheet,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: spacing.sm,
  },
});
