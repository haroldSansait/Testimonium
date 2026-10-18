import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthButton, AuthScaffold } from "@/components/auth";
import { LegalModal } from "@/components/legal/LegalModal";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { useLegalPolicies } from "@/hooks/useLegalPolicies";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { evaluatePasswordStrength } from "@/utils/passwordStrength";

export default function RegisterScreen() {
  const { signUpWithEmail, signInWithGoogle, isRegistering, isSigningIn } = useAuth();
  const {
    data: policies,
    isLoading: isPoliciesLoading,
    isError: isPoliciesError,
    error: policiesError,
    refetch: refetchPolicies,
  } = useLegalPolicies();
  const showGoogleButton = isGoogleAuthAvailable();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordStrength = evaluatePasswordStrength(password);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"TERMS" | "PRIVACY" | null>(null);

  const handleSubmit = async () => {
    if (isRegistering || isSigningIn) return;

    if (!policies?.termsOfService || !policies?.privacyPolicy) {
      setError("Authoritative legal policies are currently unavailable. Please retry.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("First Name and Last Name are required.");
      return;
    }

    if (!email.trim() || !password || !confirmPassword) {
      setError("Please fill in all required account fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError("You must accept both the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setError(null);
    try {
      await signUpWithEmail(
        email.trim(),
        password,
        {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          suffix: suffix.trim() || undefined,
        },
        {
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: policies.termsOfService.version,
          privacyVersion: policies.privacyPolicy.version,
        }
      );
    } catch (cause) {
      if (isAppError(cause) && cause.code === "LEGAL_ACCEPTANCE_VERSION_CONFLICT") {
        setTermsAccepted(false);
        setPrivacyAccepted(false);
        await refetchPolicies();
        setError("The legal policies changed while you were registering. Please review and accept the updated versions.");
      } else {
        setError(
          isAppError(cause)
            ? cause.message
            : "Registration could not be completed. Please check your details and try again."
        );
      }
    }
  };

  const handleGoogleSignUp = async () => {
    if (isRegistering || isSigningIn) return;
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "We could not sign up with Google. Please try again."
      );
    }
  };

  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 6 &&
    password === confirmPassword &&
    termsAccepted &&
    privacyAccepted &&
    Boolean(policies?.termsOfService && policies?.privacyPolicy);

  return (
    <AuthScaffold
      compactHero
      heroMinHeight={185}
      roundedSurface
    >
      <View style={styles.formContainer}>
        {/* Concise Heading & Subtitle */}
        <View style={styles.headerBlock}>
          <Text style={styles.heading} accessibilityRole="header" allowFontScaling>
            Create Account
          </Text>
          <Text style={styles.subtitle} allowFontScaling>
            Register to access parish services.
          </Text>
        </View>

        {/* Error Notice */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.danger}
              style={{ marginTop: 1 }}
            />
            <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
              {error}
            </Text>
          </View>
        )}

        {/* Section 1: Personal Details */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle} allowFontScaling>
            Personal Information
          </Text>
          <View style={styles.sectionFields}>
            <TextInput
              label="First Name *"
              value={firstName}
              onChangeText={(val) => {
                setFirstName(val);
                if (error) setError(null);
              }}
              placeholder="e.g. Juan"
              autoCapitalize="words"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />
            <TextInput
              label="Middle Name (Optional)"
              value={middleName}
              onChangeText={setMiddleName}
              placeholder="e.g. Santos"
              autoCapitalize="words"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />
            <TextInput
              label="Last Name *"
              value={lastName}
              onChangeText={(val) => {
                setLastName(val);
                if (error) setError(null);
              }}
              placeholder="e.g. Dela Cruz"
              autoCapitalize="words"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />
            <TextInput
              label="Suffix (Optional)"
              value={suffix}
              onChangeText={setSuffix}
              placeholder="e.g. Jr., III"
              autoCapitalize="words"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />
          </View>
        </View>

        {/* Section 2: Account Credentials */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle} allowFontScaling>
            Account Credentials
          </Text>
          <View style={styles.sectionFields}>
            <TextInput
              label="Email Address *"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="e.g. juan.delacruz@example.com"
              leftIcon="mail-outline"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />
            <TextInput
              label="Password *"
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (error) setError(null);
              }}
              isPassword
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
              leftIcon="lock-closed-outline"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />

            {/* Live Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer} accessibilityLiveRegion="polite">
                <View style={styles.strengthHeader}>
                  <Text style={styles.strengthLabelText}>Password Strength:</Text>
                  <Text
                    style={[
                      styles.strengthValueText,
                      passwordStrength.level === "STRONG"
                        ? styles.strengthStrong
                        : passwordStrength.level === "MODERATE"
                        ? styles.strengthModerate
                        : styles.strengthWeak,
                    ]}
                  >
                    {passwordStrength.label.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.strengthBarRow}>
                  <View
                    style={[
                      styles.strengthBarSegment,
                      passwordStrength.score >= 1
                        ? (passwordStrength.level === "STRONG"
                          ? styles.barStrong
                          : passwordStrength.level === "MODERATE"
                          ? styles.barModerate
                          : styles.barWeak)
                        : styles.barInactive,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBarSegment,
                      passwordStrength.score >= 2
                        ? (passwordStrength.level === "STRONG"
                          ? styles.barStrong
                          : passwordStrength.level === "MODERATE"
                          ? styles.barModerate
                          : styles.barWeak)
                        : styles.barInactive,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBarSegment,
                      passwordStrength.score >= 3 ? styles.barStrong : styles.barInactive,
                    ]}
                  />
                </View>
                <Text style={styles.strengthFeedbackText}>{passwordStrength.feedback}</Text>
              </View>
            )}

            <TextInput
              label="Confirm Password *"
              value={confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (error) setError(null);
              }}
              isPassword
              autoComplete="new-password"
              placeholder="Re-enter your password"
              leftIcon="lock-closed-outline"
              inputContainerStyle={styles.roundedInput}
              editable={!isRegistering && !isSigningIn}
            />

            {/* Password Validation Hints */}
            <View style={styles.passwordHints}>
              <Text
                style={[
                  styles.hintItem,
                  password.length >= 6 ? styles.hintValid : styles.hintMuted,
                ]}
                allowFontScaling
              >
                • Minimum 6 characters {password.length >= 6 ? "✓" : ""}
              </Text>
              {confirmPassword.length > 0 && (
                <Text
                  style={[
                    styles.hintItem,
                    password === confirmPassword ? styles.hintValid : styles.hintInvalid,
                  ]}
                  allowFontScaling
                >
                  • Passwords {password === confirmPassword ? "match ✓" : "do not match ✗"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Section 3: Legal Terms & Privacy */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle} allowFontScaling>
            Consent & Agreements
          </Text>

          {isPoliciesLoading && (
            <Text style={styles.checkboxLabel} allowFontScaling>
              Loading authoritative legal policies...
            </Text>
          )}

          {isPoliciesError && (
            <View style={styles.errorContainer}>
              <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
                {policiesError?.message || "Authoritative legal policies are unavailable."}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading legal policies"
                onPress={() => { void refetchPolicies(); }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.legalCheckboxes}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="Accept Terms of Service"
              disabled={!policies || isPoliciesLoading}
              onPress={() => setTermsAccepted((prev) => !prev)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={15} color="#FFF" />}
              </View>
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel} allowFontScaling>
                  I agree to the{" "}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="View Terms of Service"
                  onPress={() => setActiveModal("TERMS")}
                  hitSlop={8}
                >
                  <Text style={styles.linkText} allowFontScaling>
                    Terms of Service ({policies?.termsOfService.version ?? "Unavailable"})
                  </Text>
                </Pressable>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
              accessibilityLabel="Accept Privacy Policy"
              disabled={!policies || isPoliciesLoading}
              onPress={() => setPrivacyAccepted((prev) => !prev)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}>
                {privacyAccepted && <Ionicons name="checkmark" size={15} color="#FFF" />}
              </View>
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel} allowFontScaling>
                  I acknowledge the{" "}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="View Privacy Policy"
                  onPress={() => setActiveModal("PRIVACY")}
                  hitSlop={8}
                >
                  <Text style={styles.linkText} allowFontScaling>
                    Privacy Policy ({policies?.privacyPolicy.version ?? "Unavailable"})
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Primary Pill Registration Button */}
        <View style={styles.actionsBlock}>
          <AuthButton
            title={isRegistering ? "Creating Account..." : "Create Account"}
            variant="primary"
            loading={isRegistering}
            disabled={!isFormValid || isRegistering || isSigningIn}
            onPress={() => {
              void handleSubmit();
            }}
            testID="register-submit-btn"
            accessibilityLabel="Create Account"
          />

          {/* Alternative Google Sign-up */}
          {showGoogleButton && (
            <View style={styles.googleSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText} allowFontScaling>
                  OR
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <AuthButton
                title="Sign Up with Google"
                variant="google"
                leftComponent={<GoogleLogo size={20} />}
                loading={isSigningIn}
                disabled={isRegistering || isSigningIn}
                onPress={() => {
                  void handleGoogleSignUp();
                }}
                testID="register-google-btn"
                accessibilityLabel="Sign up with Google"
              />
            </View>
          )}

          {/* Small Navigation Link to Sign In */}
          <View style={styles.footerRow}>
            <Text style={styles.footerPromptText} allowFontScaling>
              Already have an account?{" "}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Sign In"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => router.replace("/(auth)/login")}
              disabled={isRegistering || isSigningIn}
            >
              <Text style={styles.footerLinkText} allowFontScaling>
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <LegalModal
        visible={activeModal !== null}
        type={activeModal || "TERMS"}
        onClose={() => setActiveModal(null)}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  formContainer: {
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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...fontStyles.captionBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.neutral[650],
    marginBottom: spacing.sm,
  },
  sectionFields: {
    gap: spacing.md,
  },
  passwordHints: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
    marginTop: -spacing.xs,
  },
  hintItem: {
    ...fontStyles.caption,
    fontSize: 12,
  },
  hintValid: {
    color: colors.success,
    fontWeight: "600",
  },
  hintInvalid: {
    color: colors.danger,
    fontWeight: "600",
  },
  hintMuted: {
    color: colors.textSecondary,
  },
  strengthContainer: {
    gap: 4,
    marginTop: -spacing.xs,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  strengthLabelText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  strengthValueText: {
    ...fontStyles.captionBold,
    letterSpacing: 0.5,
  },
  strengthStrong: {
    color: colors.success,
  },
  strengthModerate: {
    color: colors.warning,
  },
  strengthWeak: {
    color: colors.danger,
  },
  strengthBarRow: {
    flexDirection: "row",
    gap: 4,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBarSegment: {
    flex: 1,
    height: "100%",
    borderRadius: 2,
  },
  barStrong: {
    backgroundColor: colors.success,
  },
  barModerate: {
    backgroundColor: colors.warning,
  },
  barWeak: {
    backgroundColor: colors.danger,
  },
  barInactive: {
    backgroundColor: colors.borderLight,
  },
  strengthFeedbackText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  legalCheckboxes: {
    gap: spacing.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    flex: 1,
  },
  checkboxLabel: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  linkText: {
    ...fontStyles.bodySmall,
    color: colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  retryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.brand[700],
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  retryButtonText: {
    ...fontStyles.captionBold,
    color: "#FFFFFF",
  },
  actionsBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  googleSection: {
    width: "100%",
    marginTop: spacing.sm,
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
    marginTop: spacing.xl,
    paddingVertical: spacing.xs,
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
  roundedInput: {
    borderRadius: radii.md,
  },
});
