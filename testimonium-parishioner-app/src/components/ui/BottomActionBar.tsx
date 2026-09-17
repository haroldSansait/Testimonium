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

export interface BottomActionBarProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  children,
  style,
  contentStyle,
  onLayout,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16);

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
    width: "100%",
    gap: spacing.sm,
  },
});
