import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { navigateBackOrReplace } from "@/services/navigation/back";

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, isSigningIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const showGoogleButton = isGoogleAuthAvailable();

  const handleSubmit = async () => {
    if (isSigningIn) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    setError(null);
    try {
      await signInWithEmail(trimmedEmail, password);
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "We could not sign you in. Please verify your credentials."
      );
    }
  };

  const handleGoogleSubmit = async () => {
    if (isSigningIn) return;
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "We could not sign in with Google. Please try again."
      );
    }
  };

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>TESTIMONIUM PORTAL</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Sign In
          </Text>
          <Text style={styles.copy} allowFontScaling>
            Enter your registered credentials to access your sacramental services and records.
          </Text>
        </View>

        {/* Error Notice */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.danger}
              style={styles.errorIcon}
            />
            <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
              {error}
            </Text>
          </View>
        )}

        {/* Form Card */}
        <Card style={styles.formCard}>
          <View style={styles.fields}>
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="e.g. parishioner@example.com"
              leftIcon="mail-outline"
              editable={!isSigningIn}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              autoComplete="current-password"
              placeholder="Enter your password"
              leftIcon="lock-closed-outline"
              editable={!isSigningIn}
            />

            <View style={styles.forgotRow}>
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password" as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Forgot password? Instructions to reset password"
              >
                <Text style={styles.forgotText} allowFontScaling>
                  Forgot Password?
                </Text>
              </Pressable>
            </View>
          </View>

          <Button
            title={isSigningIn ? "Signing In..." : "Sign In"}
            size="lg"
            loading={isSigningIn}
            disabled={isSigningIn || !email.trim() || !password}
            onPress={() => {
              void handleSubmit();
            }}
          />
        </Card>

        {/* Alternative Actions */}
        <View style={styles.actions}>
          {showGoogleButton && (
            <Button
              title="Continue with Google"
              size="lg"
              variant="secondary"
              loading={isSigningIn}
              disabled={isSigningIn}
              onPress={() => {
                void handleGoogleSubmit();
              }}
            />
          )}

          <Button
            title="Create New Account"
            size="lg"
            variant="outline"
            disabled={isSigningIn}
            onPress={() => router.push("/(auth)/register" as any)}
          />

          <Button
            title="Back"
            variant="ghost"
            disabled={isSigningIn}
            onPress={() =>
              navigateBackOrReplace(
                router.canGoBack,
                router.back,
                () => router.replace("/(auth)/welcome")
              )
            }
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  dioceseBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  dioceseBadgeText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: {
    ...fontStyles.title,
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  copy: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  forgotRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: -spacing.xs,
  },
  forgotText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
  },
});
