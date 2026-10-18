import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export type AuthButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "google"
  | "ghost"
  | "welcome-primary"
  | "welcome-outline"
  | "welcome-google";

export interface AuthButtonProps {
  title: string;
  variant?: AuthButtonVariant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  leftComponent?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  variant = "primary",
  onPress,
  loading = false,
  disabled = false,
  leftComponent,
  style,
  accessibilityLabel,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const getIndicatorColor = () => {
    switch (variant) {
      case "primary":
      case "welcome-outline":
        return "#FFFFFF";
      case "welcome-primary":
      case "secondary":
      case "ghost":
        return colors.brand[800];
      case "google":
      case "welcome-google":
      case "outline":
      default:
        return colors.brand[700];
    }
  };

  const getVariantStyle = (pressed: boolean) => {
    switch (variant) {
      case "primary":
        return [
          styles.primary,
          pressed && !isDisabled && styles.pressedPrimary,
        ];
      case "secondary":
        return [
          styles.secondary,
          pressed && !isDisabled && styles.pressedSecondary,
        ];
      case "outline":
        return [
          styles.outline,
          pressed && !isDisabled && styles.pressedOutline,
        ];
      case "google":
        return [
          styles.google,
          pressed && !isDisabled && styles.pressedGoogle,
        ];
      case "welcome-primary":
        return [
          styles.welcomePrimary,
          pressed && !isDisabled && styles.pressedWelcomePrimary,
        ];
      case "welcome-outline":
        return [
          styles.welcomeOutline,
          pressed && !isDisabled && styles.pressedWelcomeOutline,
        ];
      case "welcome-google":
        return [
          styles.welcomeGoogle,
          pressed && !isDisabled && styles.pressedWelcomeGoogle,
        ];
      case "ghost":
        return [
          styles.ghost,
          pressed && !isDisabled && styles.pressedGhost,
        ];
      default:
        return styles.primary;
    }
  };

  const getLabelStyle = () => {
    switch (variant) {
      case "primary":
        return styles.primaryLabel;
      case "secondary":
        return styles.secondaryLabel;
      case "outline":
        return styles.outlineLabel;
      case "google":
        return styles.googleLabel;
      case "welcome-primary":
        return styles.welcomePrimaryLabel;
      case "welcome-outline":
        return styles.welcomeOutlineLabel;
      case "welcome-google":
        return styles.welcomeGoogleLabel;
      case "ghost":
        return styles.ghostLabel;
      default:
        return styles.primaryLabel;
    }
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.base,
        getVariantStyle(pressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getIndicatorColor()} />
      ) : (
        <View style={styles.contentRow}>
          {leftComponent ? (
            <View style={styles.leftComponentContainer}>{leftComponent}</View>
          ) : null}
          <Text
            style={[styles.label, getLabelStyle(), isDisabled && styles.disabledLabel]}
            allowFontScaling
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.pill,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  leftComponentContainer: {
    marginRight: spacing.sm,
  },
  label: {
    ...fontStyles.button,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  // Variant base styles
  primary: {
    backgroundColor: colors.brand[700],
    borderWidth: 0,
  },
  pressedPrimary: {
    backgroundColor: colors.brand[800],
    opacity: 0.95,
  },
  primaryLabel: {
    color: "#FFFFFF",
  },
  secondary: {
    backgroundColor: colors.brand[50],
    borderWidth: 1.5,
    borderColor: colors.brand[700],
  },
  pressedSecondary: {
    backgroundColor: "rgba(123, 28, 42, 0.12)",
  },
  secondaryLabel: {
    color: colors.brand[700],
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
  },
  pressedOutline: {
    backgroundColor: colors.neutral[50],
  },
  outlineLabel: {
    color: colors.neutral[950],
  },
  google: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
  },
  pressedGoogle: {
    backgroundColor: colors.neutral[50],
  },
  googleLabel: {
    color: colors.neutral[800],
    fontWeight: "600",
  },
  welcomePrimary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  pressedWelcomePrimary: {
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    transform: [{ scale: 0.985 }],
  },
  welcomePrimaryLabel: {
    color: colors.brand[800],
    fontWeight: "700",
  },
  welcomeOutline: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  pressedWelcomeOutline: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    transform: [{ scale: 0.985 }],
  },
  welcomeOutlineLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  welcomeGoogle: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  pressedWelcomeGoogle: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    transform: [{ scale: 0.985 }],
  },
  welcomeGoogleLabel: {
    color: colors.neutral[950],
    fontWeight: "600",
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  pressedGhost: {
    opacity: 0.7,
  },
  ghostLabel: {
    color: colors.brand[700],
  },
  // Disabled states
  disabled: {
    opacity: 0.5,
  },
  disabledLabel: {
    opacity: 0.8,
  },
});
