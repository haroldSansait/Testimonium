import React, { useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface TextInputProps extends NativeTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  secureTextEntry,
  leftIcon,
  rightIcon,
  containerStyle,
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
    <View style={[styles.group, containerStyle]}>
      {label ? (
        <Text style={styles.label} allowFontScaling>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.textSecondary}
            style={styles.leftIcon}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        ) : null}

        <NativeTextInput
          accessibilityLabel={label || props.placeholder || "Text input"}
          style={[styles.input, style]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={shouldHideText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          allowFontScaling
          {...props}
        />

        {rightIcon}

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
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
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
  leftIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    ...fontStyles.body,
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
    ...fontStyles.captionMedium,
    color: colors.primary,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    marginTop: 2,
  },
  helperText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});