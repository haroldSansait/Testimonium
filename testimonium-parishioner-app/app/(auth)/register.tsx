import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { TextInput } from "@/components/ui/TextInput";
import { FormSection } from "@/components/ui/FormSection";
import { Divider } from "@/components/ui/Divider";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { evaluatePasswordStrength } from "@/utils/passwordStrength";

export default function RegisterScreen() {
  const { signUpWithEmail, signInWithGoogle, isRegistering, isSigningIn } = useAuth();
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
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
        }
      );
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "Registration could not be completed. Please check your details and try again."
      );
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
    privacyAccepted;

  return (
    <AuthScaffold
      compactHero
      title="Create Account"
      subtitle="Register for sacramental services and certificate records with the Vicariate of Canlaon."
    >
      <View style={styles.formContainer}>
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
        <FormSection title="Personal Information">
          <TextInput
            label="First Name *"
            value={firstName}
            onChangeText={(val) => {
              setFirstName(val);
              if (error) setError(null);
            }}
            placeholder="e.g. Juan"
            autoCapitalize="words"
            editable={!isRegistering && !isSigningIn}
          />
          <TextInput
            label="Middle Name (Optional)"
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="e.g. Santos"
            autoCapitalize="words"
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
            editable={!isRegistering && !isSigningIn}
          />
          <TextInput
            label="Suffix (Optional)"
            value={suffix}
            onChangeText={setSuffix}
            placeholder="e.g. Jr., III"
            autoCapitalize="words"
            editable={!isRegistering && !isSigningIn}
          />
        </FormSection>

        <Divider style={styles.sectionDivider} />

        {/* Section 2: Account Credentials */}
        <FormSection title="Account Credentials">
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
            editable={!isRegistering && !isSigningIn}
          />

          {/* Password Validation Hints */}
          <View style={styles.passwordHints}>
            <Text style={styles.hintTitle} allowFontScaling>
              Password Requirements:
            </Text>
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
        </FormSection>

        <Divider style={styles.sectionDivider} />

        {/* Section 3: Legal Terms & Privacy */}
        <FormSection title="Legal Terms & Privacy Consent">
          <View style={styles.legalCheckboxes}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="Accept Terms of Service"
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
                    Terms of Service
                  </Text>
                </Pressable>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
              accessibilityLabel="Accept Privacy Policy"
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
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </FormSection>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={isRegistering ? "Creating Account..." : "Register Account"}
            size="lg"
            variant="primary"
            fullWidth
            loading={isRegistering}
            disabled={!isFormValid || isRegistering || isSigningIn}
            onPress={() => {
              void handleSubmit();
            }}
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
                title="Sign Up with Google"
                size="lg"
                variant="secondary"
                fullWidth
                leftComponent={<GoogleLogo size={20} />}
                loading={isSigningIn}
                disabled={isRegistering || isSigningIn}
                onPress={() => {
                  void handleGoogleSignUp();
                }}
              />
            </>
          )}

          <Button
            title="Already have an account? Sign In"
            size="lg"
            variant="outline"
            fullWidth
            disabled={isRegistering || isSigningIn}
            onPress={() =>
              navigateBackOrReplace(
                router.canGoBack,
                router.back,
                () => router.replace("/(auth)/login")
              )
            }
          />
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
    paddingVertical: spacing.sm,
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
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  passwordHints: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 2,
    marginTop: spacing.xxs,
  },
  strengthContainer: {
    gap: 4,
    marginTop: -4,
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
  hintTitle: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  hintItem: {
    ...fontStyles.caption,
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
  legalCheckboxes: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkbox: {
    width: 20,
    height: 20,
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
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionDivider: {
    marginBottom: spacing.lg,
  },
});
