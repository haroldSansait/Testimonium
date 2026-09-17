import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  type ViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface ScreenProps extends ViewProps {
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  safeArea?: boolean;
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  scrollable = false,
  keyboardAvoiding = true,
  safeArea = true,
  edges = ["top", "left", "right"],
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  ...props
}) => {
  if (scrollable) {
    const scrollContent = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );

    const wrappedContent = keyboardAvoiding ? (
      <KeyboardAvoidingView
        style={styles.flex}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {scrollContent}
      </KeyboardAvoidingView>
    ) : (
      scrollContent
    );

    if (safeArea) {
      return (
        <SafeAreaView edges={edges} style={[styles.screen, style]} {...props}>
          {wrappedContent}
        </SafeAreaView>
      );
    }

    return (
      <View style={[styles.screen, style]} {...props}>
        {wrappedContent}
      </View>
    );
  }

  if (safeArea) {
    return (
      <SafeAreaView edges={edges} style={[styles.screen, style]} {...props}>
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.flex}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            {children}
          </KeyboardAvoidingView>
        ) : (
          children
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.screen, style]} {...props}>
      {children}
    </View>
  );
};

export const LoadingState: React.FC<{ label?: string }> = ({
  label = "Loading TESTIMONIUM\u2026",
}) => (
  <View style={styles.centerScreen}>
    <View style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingLabel} allowFontScaling>
        {label}
      </Text>
    </View>
  </View>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => (
  <View style={styles.centerScreen}>
    <View style={styles.errorCard}>
      <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
        {message}
      </Text>
      {onRetry ? (
        <Text
          onPress={onRetry}
          style={styles.retryLink}
          accessibilityRole="button"
          allowFontScaling
        >
          Try Again
        </Text>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.control,
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  loadingLabel: {
    ...fontStyles.bodyMedium,
    color: colors.neutral[650],
  },
  errorCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.control,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    maxWidth: 320,
    width: "100%",
  },
  errorText: {
    ...fontStyles.bodySmall,
    color: colors.danger,
    textAlign: "center",
  },
  retryLink: {
    ...fontStyles.button,
    color: colors.primary,
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    textAlignVertical: "center",
  },
});
