import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthScaffold } from "@/components/auth";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { StateView } from "@/components/ui/StateView";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, spacing } from "@/theme/tokens";

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
    <AuthScaffold
      title="Sign In"
      subtitle="Enter your credentials to access sacramental services and records."
    >
      <View style={styles.formContent}>
        {error && (
          <StateView.InlineError
            message={error}
            style={styles.errorContainer}
          />
        )}

        <View style={styles.fields}>
          <TextInput
            label="Email Address"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (error) setError(null);
            }}
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
            onChangeText={(val) => {
              setPassword(val);
              if (error) setError(null);
            }}
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
          variant="primary"
          fullWidth
          loading={isSigningIn}
          disabled={isSigningIn || !email.trim() || !password}
          onPress={() => {
            void handleSubmit();
          }}
        />

        {/* Alternative Actions */}
        <View style={styles.actions}>
          {showGoogleButton && (
            <>
              <View style={styles.dividerRow}>
                <Divider style={styles.dividerLine} />
                <Text style={styles.dividerText} allowFontScaling>
                  OR
                </Text>
                <Divider style={styles.dividerLine} />
              </View>

              <Button
                title="Sign In with Google"
                size="lg"
                variant="secondary"
                fullWidth
                leftComponent={<GoogleLogo size={20} />}
                loading={isSigningIn}
                disabled={isSigningIn}
                onPress={() => {
                  void handleGoogleSubmit();
                }}
              />
            </>
          )}

          <Button
            title="Create New Account"
            size="lg"
            variant="outline"
            fullWidth
            disabled={isSigningIn}
            onPress={() => router.push("/(auth)/register" as any)}
          />

          <Button
            title="Back"
            variant="ghost"
            fullWidth
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
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  formContent: {
    paddingVertical: spacing.sm,
  },
  errorContainer: {
    marginBottom: spacing.md,
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
    color: colors.brand[700],
    fontWeight: "600",
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
  },
  dividerText: {
    ...fontStyles.caption,
    color: colors.neutral[500],
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
