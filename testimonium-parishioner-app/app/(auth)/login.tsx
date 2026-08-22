import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { navigateBackOrReplace } from '@/services/navigation/back';

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
        isAppError(cause) ? cause.message : "We could not sign you in. Please verify your credentials."
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
        isAppError(cause) ? cause.message : "We could not sign in with Google. Please try again."
      );
    }
  };

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling>
          Sign In
        </Text>
        <Text style={styles.copy} allowFontScaling>
          Use your registered TESTIMONIUM account to access your sacramental services.
        </Text>
      </View>

      <View style={styles.fields}>
        <TextInput
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="e.g. parishioner@example.com"
          editable={!isSigningIn}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          isPassword
          autoComplete="current-password"
          placeholder="Enter your password"
          editable={!isSigningIn}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
            {error}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={isSigningIn ? "Signing In..." : "Sign In"}
          loading={isSigningIn}
          disabled={isSigningIn || !email.trim() || !password}
          onPress={() => {
            void handleSubmit();
          }}
        />

        {showGoogleButton && (
          <Button
            title="Continue with Google"
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
              () => router.replace('/(auth)/welcome')
            )
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "700",
  },
  copy: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  fields: {
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
