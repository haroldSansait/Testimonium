import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps,
  View,
} from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export interface TextInputProps extends NativeTextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const shouldHideText = isPassword ? !isPasswordVisible : secureTextEntry;

  const handleFocus: NativeTextInputProps["onFocus"] = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur: NativeTextInputProps["onBlur"] = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label} allowFontScaling>
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
        ]}
      >
        <NativeTextInput
          accessibilityLabel={label}
          style={[styles.input, style]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={shouldHideText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          allowFontScaling
          {...props}
        />

        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            accessibilityHint="Toggles password visibility"
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={styles.toggleButton}
            hitSlop={8}
          >
            <Text style={styles.toggleText} allowFontScaling>
              {isPasswordVisible ? "Hide" : "Show"}
            </Text>
          </Pressable>
        )}
      </View>

      {Boolean(error) && (
        <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
          {error}
        </Text>
      )}

      {Boolean(helperText) && !error && (
        <Text style={styles.helperText} allowFontScaling>
          {helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  inputContainer: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.primary,
  },
  errorBorder: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.body,
    paddingVertical: spacing.sm,
  },
  toggleButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.xs,
  },
  toggleText: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.primary,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 2,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});