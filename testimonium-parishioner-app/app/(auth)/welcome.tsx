import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthScaffold } from "@/components/auth";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { StateView } from "@/components/ui/StateView";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export default function WelcomeScreen() {
  const {
    state,
    error,
    sessionIssue,
    isSigningIn,
    signInWithGoogle,
    retryBootstrap,
    logout,
  } = useAuth();
  const showGoogleButton = isGoogleAuthAvailable();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setGoogleError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setGoogleError(
        isAppError(cause)
          ? cause.message
          : "We could not sign in with Google. Please try again."
      );
    }
  };

  if (state === "SESSION_ERROR") {
    return (
      <AuthScaffold title="Session Verification" subtitle="Account verification issue">
        <StateView.FullError
          title="Session Verification Issue"
          message={
            sessionIssue?.message ||
            error ||
            "We could not verify your TESTIMONIUM account."
          }
          onRetry={
            sessionIssue?.retryable
              ? () => {
                  void retryBootstrap();
                }
              : undefined
          }
          retryLabel="Retry Verification"
          onBack={() => {
            void logout();
          }}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Parishioner Portal"
      subtitle="Access sacramental records, canonical appointments, and certificate tracking."
    >
      <View style={styles.content}>
        <View style={styles.introBlock}>
          <Text style={styles.welcomeHeading} allowFontScaling>
            Welcome to TESTIMONIUM
          </Text>
          <Text style={styles.welcomeCopy} allowFontScaling>
            Sign in to manage your sacramental requests, request canonical appointments, and connect with your parish in the Vicariate of Canlaon.
          </Text>
        </View>

        {googleError && (
          <StateView.InlineError
            message={googleError}
            style={styles.errorBanner}
          />
        )}

        <View style={styles.actions}>
          <Button
            title="Sign In"
            size="lg"
            variant="primary"
            fullWidth
            onPress={() => router.push("/(auth)/login")}
          />

          <Button
            title="Create an Account"
            size="lg"
            variant="outline"
            fullWidth
            onPress={() => router.push("/(auth)/register" as any)}
          />

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
                title="Continue with Google"
                size="lg"
                variant="secondary"
                fullWidth
                leftComponent={<GoogleLogo size={20} />}
                loading={isSigningIn}
                disabled={isSigningIn}
                onPress={() => {
                  void handleGoogleSignIn();
                }}
              />
            </>
          )}

          <Text style={styles.footerNote} allowFontScaling>
            Vicariate of Canlaon
          </Text>
        </View>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
  },
  introBlock: {
    marginBottom: spacing.xl,
  },
  welcomeHeading: {
    ...fontStyles.titleSerif,
    color: colors.neutral[950],
    fontSize: 22,
    lineHeight: 28,
    marginBottom: spacing.xs,
  },
  welcomeCopy: {
    ...fontStyles.body,
    color: colors.neutral[650],
    lineHeight: 22,
  },
  errorBanner: {
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
    width: "100%",
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
  footerNote: {
    ...fontStyles.caption,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.md,
  },
});