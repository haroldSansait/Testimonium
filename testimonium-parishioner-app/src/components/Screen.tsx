import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme/tokens";

export interface ScreenProps extends ViewProps {
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  safeArea?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  scrollable = false,
  keyboardAvoiding = true,
  safeArea = true,
  contentContainerStyle,
  ...props
}) => {
  const Container = safeArea ? SafeAreaView : View;

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

    return (
      <Container style={[styles.screen, style]} {...props}>
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {scrollContent}
          </KeyboardAvoidingView>
        ) : (
          scrollContent
        )}
      </Container>
    );
  }

  return (
    <Container style={[styles.screen, style]} {...props}>
      {children}
    </Container>
  );
};

export const LoadingState: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <Screen style={styles.center}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={styles.label} allowFontScaling>
      {label}
    </Text>
  </Screen>
);

export const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <Screen style={styles.center}>
    <Text accessibilityRole="alert" style={styles.error} allowFontScaling>
      {message}
    </Text>
  </Screen>
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 16,
  },
});