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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.base,
        { width: Math.max(size, 44), height: Math.max(size, 44), minWidth: 44, minHeight: 44 },
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
    borderColor: colors.border,
  },
  variantPrimary: {
    backgroundColor: colors.primary,
  },
  pressedDefault: {
    backgroundColor: colors.surfaceVariant,
    opacity: 0.85,
  },
  pressedPrimary: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.4,
  },
});
