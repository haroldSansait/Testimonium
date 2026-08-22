import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import { colors, radii, shadows, spacing } from "@/theme/tokens";

export interface CardProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "muted" | "highlight";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "none" | "summary";
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = "default",
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = onPress ? "button" : "none",
  testID,
}) => {
  const isPressable = typeof onPress === "function";

  const cardStyle = [
    styles.card,
    variant === "elevated" && styles.elevated,
    variant === "muted" && styles.muted,
    variant === "highlight" && styles.highlight,
    style,
  ];

  if (isPressable) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessible={true}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={cardStyle}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  elevated: {
    ...shadows.sm,
    borderColor: "transparent",
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderLight,
  },
  highlight: {
    backgroundColor: colors.surface,
    borderColor: colors.primarySoft,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.92,
    backgroundColor: colors.surfaceMuted,
  },
});
