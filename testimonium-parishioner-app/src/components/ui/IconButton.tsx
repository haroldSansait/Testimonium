import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import { colors, radii } from "@/theme/tokens";

export interface IconButtonProps {
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: number;
  variant?: "ghost" | "surface" | "primary";
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  style,
  size = 44,
  variant = "ghost",
  disabled = false,
}) => {
  const targetSize = Math.max(size, 44);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [
        styles.base,
        { width: targetSize, height: targetSize, minWidth: 44, minHeight: 44 },
        variant === "surface" && styles.variantSurface,
        variant === "primary" && styles.variantPrimary,
        pressed && !disabled && (variant === "primary" ? styles.pressedPrimary : styles.pressedDefault),
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.pill,
  },
  variantSurface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  variantPrimary: {
    backgroundColor: colors.brand[700],
  },
  pressedDefault: {
    backgroundColor: colors.neutral[50],
    opacity: 0.85,
  },
  pressedPrimary: {
    backgroundColor: colors.brand[800],
  },
  disabled: {
    opacity: 0.4,
  },
});
