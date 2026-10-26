import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AccessibilityInfo,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = false,
  containerStyle,
  testID = "otp-input",
}) => {
  const completedRef = useRef("");
  if (value.length < 6) completedRef.current = "";
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Shake animation on error
  useEffect(() => {
    if (hasError && !reduceMotion) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
    return () => { shakeAnim.stopAnimation(); };
  }, [hasError, shakeAnim, reduceMotion]);

  const handleChangeText = (text: string) => {
    if (disabled) return;
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
    onChange(cleaned);
    if (cleaned.length === 6 && onComplete && completedRef.current !== cleaned) {
      completedRef.current = cleaned;
      onComplete(cleaned);
    }
  };

  const handleContainerPress = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const digits = [0, 1, 2, 3, 4, 5];
  const focusedIndex = isFocused ? Math.min(value.length, 5) : -1;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        containerStyle,
        { transform: [{ translateX: shakeAnim }] },
      ]}
      testID={testID}
    >
      <Pressable
        onPress={handleContainerPress}
        style={styles.slotsRow}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityRole="none"
      >
        {digits.map((index) => {
          const char = value[index] || "";
          const isSlotActive = index === focusedIndex && !disabled;
          const isSlotFilled = Boolean(char);

          return (
            <View
              key={index}
              style={[
                styles.slot,
                isSlotActive && styles.slotActive,
                isSlotFilled && styles.slotFilled,
                hasError && styles.slotError,
                disabled && styles.slotDisabled,
              ]}
              testID={`${testID}-slot-${index}`}
            >
              <Text
                style={[
                  styles.slotText,
                  hasError && styles.slotTextError,
                  disabled && styles.slotTextDisabled,
                ]}
                allowFontScaling={false}
              >
                {char}
              </Text>
            </View>
          );
        })}
      </Pressable>

      {/* Hidden real input capturing all keyboard, paste, and auto-fill events */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        maxLength={6}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        editable={!disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        accessibilityLabel="Six-digit verification code"
        accessibilityHint="Enter the 6-digit numeric code received via email"
        testID={`${testID}-hidden-input`}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.sm,
  },
  slotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    gap: spacing.xs,
  },
  slot: {
    flex: 1,
    height: 52,
    maxWidth: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    elevation: 1,
  },
  slotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    elevation: 2,
  },
  slotFilled: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  slotError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  slotDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.6,
  },
  slotText: {
    ...fontStyles.title,
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  slotTextError: {
    color: colors.danger,
  },
  slotTextDisabled: {
    color: colors.textMuted,
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: 52,
    opacity: 0.01,
    color: "transparent",
  },
});
