import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function WelcomeScreen() {
  const { state, error, sessionIssue, isSigningIn, signInWithGoogle, retryBootstrap, logout } = useAuth();
  const showGoogleButton = isGoogleAuthAvailable();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setGoogleError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setGoogleError(
        isAppError(cause) ? cause.message : "We could not sign in with Google. Please try again."
      );
    }
  };

  if (state === "SESSION_ERROR") {
    return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} allowFontScaling>
            Session Issue
          </Text>
          <Text style={styles.copy} allowFontScaling>
            {sessionIssue?.message || error || "We could not verify your TESTIMONIUM account."}
          </Text>
        </View>

        <View style={styles.actions}>
          {sessionIssue?.retryable && (
            <Button
              title="Retry Session"
              onPress={() => {
                void retryBootstrap();
              }}
            />
          )}
          <Button
            title="Sign Out / Use Different Account"
            variant="outline"
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.brandHero}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>DIOCESE OF SAN CARLOS</Text>
        </View>
        <Text style={styles.title} allowFontScaling>
          TESTIMONIUM
        </Text>
        <Text style={styles.subtitle} allowFontScaling>
          Parishioner Mobile Portal
        </Text>
        <Text style={styles.copy} allowFontScaling>
          Sacramental document processing, canonical appointments, and certificate tracking.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Sign In"
          onPress={() => router.push("/(auth)/login")}
        />
        <Button
          title="Create an Account"
          variant="outline"
          onPress={() => router.push("/(auth)/register" as any)}
        />
        {showGoogleButton && (
          <>
            <Button
              title="Continue with Google"
              variant="secondary"
              loading={isSigningIn}
              disabled={isSigningIn}
              onPress={() => {
                void handleGoogleSignIn();
              }}
            />
            {googleError && (
              <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
                {googleError}
              </Text>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  brandHero: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  badgeContainer: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textPrimary,
    fontSize: typography.heading,
    fontWeight: "600",
  },
  copy: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  header: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 20,
  },
});