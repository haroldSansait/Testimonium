import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { navigateBackOrReplace } from "@/services/navigation/back";

export default function RegisterScreen() {
  const { signUpWithEmail, isRegistering } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<"TERMS" | "PRIVACY" | null>(null);

  const handleSubmit = async () => {
    if (isRegistering) return;

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

  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 6 &&
    password === confirmPassword &&
    termsAccepted &&
    privacyAccepted;

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>PARISHIONER REGISTRATION</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Create Account
          </Text>
          <Text style={styles.copy} allowFontScaling>
            Register for sacramental services and certificate records with the Diocese of San Carlos.
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

        {/* Personal Details Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Personal Information
          </Text>
          <View style={styles.fields}>
            <TextInput
              label="First Name *"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Juan"
              autoCapitalize="words"
              editable={!isRegistering}
            />
            <TextInput
              label="Middle Name (Optional)"
              value={middleName}
              onChangeText={setMiddleName}
              placeholder="e.g. Santos"
              autoCapitalize="words"
              editable={!isRegistering}
            />
            <TextInput
              label="Last Name *"
              value={lastName}
              onChangeText={setLastName}
              placeholder="e.g. Dela Cruz"
              autoCapitalize="words"
              editable={!isRegistering}
            />
            <TextInput
              label="Suffix (Optional)"
              value={suffix}
              onChangeText={setSuffix}
              placeholder="e.g. Jr., III"
              autoCapitalize="words"
              editable={!isRegistering}
            />
          </View>
        </Card>

        {/* Account Credentials Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Account Credentials
          </Text>
          <View style={styles.fields}>
            <TextInput
              label="Email Address *"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="e.g. juan.delacruz@example.com"
              leftIcon="mail-outline"
              editable={!isRegistering}
            />
            <TextInput
              label="Password *"
              value={password}
              onChangeText={setPassword}
              isPassword
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
              leftIcon="lock-closed-outline"
              editable={!isRegistering}
            />
            <TextInput
              label="Confirm Password *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              autoComplete="new-password"
              placeholder="Re-enter your password"
              leftIcon="lock-closed-outline"
              editable={!isRegistering}
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
          </View>
        </Card>

        {/* Legal Consent Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Legal Terms & Privacy Consent *
          </Text>

          <View style={styles.legalCheckboxes}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="Accept Terms of Service"
              onPress={() => setTermsAccepted((prev) => !prev)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
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
                {privacyAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
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
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isRegistering ? "Creating Account..." : "Register Account"}
            size="lg"
            loading={isRegistering}
            disabled={!isFormValid || isRegistering}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <Button
            title="Already have an account? Sign In"
            size="lg"
            variant="outline"
            disabled={isRegistering}
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
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeaderTitle: {
    ...fontStyles.captionBold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  fields: {
    gap: spacing.md,
  },
  passwordHints: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 2,
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
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 2,
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
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
