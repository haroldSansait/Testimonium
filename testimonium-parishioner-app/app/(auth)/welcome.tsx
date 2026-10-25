import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthButton, AuthScaffold } from "@/components/auth";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { StateView } from "@/components/ui/StateView";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { fontStyles, spacing } from "@/theme/tokens";

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
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen Mt. Kanlaon background asset */}
      <Image
        source={require("../../assets/images/mt-kanlaon.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />

      {/* Balanced TESTIMONIUM deep-maroon overlay */}
      <View style={styles.brandOverlay} />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top & Middle Brand Section */}
          <View style={styles.brandSection}>
            <Text style={styles.dioceseText} allowFontScaling>
              VICARIATE OF CANLAON
            </Text>

            <Text
              style={styles.wordmark}
              accessibilityRole="header"
              allowFontScaling
            >
              TESTIMONIUM
            </Text>
          </View>

          {/* Lower Section: Authentication Actions */}
          <View style={styles.actionsSection}>
            {googleError && (
              <View style={styles.errorBannerWrapper}>
                <StateView.InlineError
                  message={googleError}
                  style={styles.errorBanner}
                />
              </View>
            )}

            <View style={styles.buttonGroup}>
              {/* Primary Pill Button */}
              <AuthButton
                title="Sign In"
                variant="welcome-primary"
                onPress={() => router.push("/(auth)/login")}
                testID="welcome-sign-in-btn"
                accessibilityLabel="Sign in to your account"
              />

              {/* Secondary Pill Button */}
              <AuthButton
                title="Create Account"
                variant="welcome-outline"
                onPress={() => router.push("/(auth)/register" as any)}
                testID="welcome-register-btn"
                accessibilityLabel="Create a new account"
              />

              {/* Google Sign-in */}
              {showGoogleButton && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText} allowFontScaling>
                      OR
                    </Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <AuthButton
                    title="Continue with Google"
                    variant="welcome-google"
                    leftComponent={<GoogleLogo size={20} />}
                    loading={isSigningIn}
                    disabled={isSigningIn}
                    onPress={() => {
                      void handleGoogleSignIn();
                    }}
                    testID="welcome-google-btn"
                    accessibilityLabel="Continue with Google account"
                  />
                </>
              )}
            </View>

            {/* Quiet Ecclesiastical Identity Footnote */}
            <Text style={styles.footerNote} allowFontScaling>
              Roman Catholic Diocese • Parishioner Portal
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#7B1C2A",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  brandOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(123, 28, 42, 0.82)",
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  brandSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  dioceseText: {
    ...fontStyles.captionBold,
    color: "rgba(255, 255, 255, 0.90)",
    letterSpacing: 2,
    fontSize: 12,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  wordmark: {
    ...fontStyles.displaySerif,
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 3,
    textAlign: "center",
  },
  actionsSection: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingTop: spacing.md,
  },
  errorBannerWrapper: {
    marginBottom: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    overflow: "hidden",
  },
  errorBanner: {
    margin: 0,
  },
  buttonGroup: {
    gap: spacing.md,
    width: "100%",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dividerText: {
    ...fontStyles.caption,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 12,
  },
  footerNote: {
    ...fontStyles.caption,
    color: "rgba(255, 255, 255, 0.65)",
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});