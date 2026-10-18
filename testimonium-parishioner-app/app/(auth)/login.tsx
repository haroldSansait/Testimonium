import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthButton, AuthScaffold } from "@/components/auth";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { StateView } from "@/components/ui/StateView";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, isSigningIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const showGoogleButton = isGoogleAuthAvailable();

  const handleBack = () => {
    navigateBackOrReplace(
      router.canGoBack,
      router.back,
      () => router.replace("/(auth)/welcome")
    );
  };

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
      compactHero
      heroMinHeight={185}
      roundedSurface
    >
      <View style={styles.formContent}>
        {/* Concise Heading & Subtitle */}
        <View style={styles.headerBlock}>
          <Text style={styles.heading} accessibilityRole="header" allowFontScaling>
            Welcome Back
          </Text>
          <Text style={styles.subtitle} allowFontScaling>
            Sign in to continue.
          </Text>
        </View>

        {/* Error Notice */}
        {error && (
          <StateView.InlineError
            message={error}
            style={styles.errorContainer}
          />
        )}

        {/* Email & Password Fields */}
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
            inputContainerStyle={styles.roundedInput}
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
            inputContainerStyle={styles.roundedInput}
            editable={!isSigningIn}
          />

          {/* Accessible Forgot Password Link */}
          <View style={styles.forgotRow}>
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel="Forgot password? Instructions to reset password"
            >
              <Text style={styles.forgotText} allowFontScaling>
                Forgot Password?
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Primary Pill Sign In Button */}
        <AuthButton
          title={isSigningIn ? "Signing In..." : "Sign In"}
          variant="primary"
          loading={isSigningIn}
          disabled={isSigningIn || !email.trim() || !password}
          onPress={() => {
            void handleSubmit();
          }}
          testID="login-submit-btn"
          accessibilityLabel="Sign In"
        />

        {/* Alternative Google Sign-in */}
        {showGoogleButton && (
          <View style={styles.secondarySection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText} allowFontScaling>
                OR
              </Text>
              <View style={styles.dividerLine} />
            </View>

            <AuthButton
              title="Sign In with Google"
              variant="google"
              leftComponent={<GoogleLogo size={20} />}
              loading={isSigningIn}
              disabled={isSigningIn}
              onPress={() => {
                void handleGoogleSubmit();
              }}
              testID="login-google-btn"
              accessibilityLabel="Sign in with Google"
            />
          </View>
        )}

        {/* Small Navigation Link to Create Account */}
        <View style={styles.footerRow}>
          <Text style={styles.footerPromptText} allowFontScaling>
            {"Don't have an account? "}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create Account"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.push("/(auth)/register" as any)}
            disabled={isSigningIn}
          >
            <Text style={styles.footerLinkText} allowFontScaling>
              Create Account
            </Text>
          </Pressable>
        </View>

        {/* Centered Back Action to Welcome Screen */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to welcome screen"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleBack}
          disabled={isSigningIn}
          style={styles.backLinkRow}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={colors.brand[700]}
            style={styles.backIcon}
          />
          <Text style={styles.backLinkText} allowFontScaling>
            Back
          </Text>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  formContent: {
    paddingVertical: spacing.xs,
  },
  headerBlock: {
    marginBottom: spacing.lg,
  },
  heading: {
    ...fontStyles.titleSerif,
    color: colors.neutral[950],
    fontSize: 24,
    lineHeight: 30,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    ...fontStyles.body,
    color: colors.neutral[650],
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 13,
  },
  secondarySection: {
    width: "100%",
    marginTop: spacing.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral[300],
  },
  dividerText: {
    ...fontStyles.caption,
    color: colors.neutral[500],
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 11,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.xxs,
  },
  footerPromptText: {
    ...fontStyles.body,
    color: colors.neutral[650],
    fontSize: 14,
  },
  footerLinkText: {
    ...fontStyles.body,
    color: colors.brand[700],
    fontWeight: "700",
    fontSize: 14,
  },
  backLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backIcon: {
    marginRight: 4,
  },
  backLinkText: {
    ...fontStyles.button,
    color: colors.brand[700],
    fontSize: 14,
    fontWeight: "600",
  },
  roundedInput: {
    borderRadius: radii.md,
  },
});
