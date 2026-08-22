import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { navigateBackOrReplace } from '@/services/navigation/back';

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

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling>
          Create Account
        </Text>
        <Text style={styles.copy} allowFontScaling>
          Register for parishioner services with the Diocese of San Carlos.
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionHeader} allowFontScaling>
          Personal Information
        </Text>
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

      <View style={styles.formSection}>
        <Text style={styles.sectionHeader} allowFontScaling>
          Account Credentials
        </Text>
        <TextInput
          label="Email Address *"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="e.g. juan.delacruz@example.com"
          editable={!isRegistering}
        />
        <TextInput
          label="Password *"
          value={password}
          onChangeText={setPassword}
          isPassword
          autoComplete="new-password"
          placeholder="Minimum 6 characters"
          editable={!isRegistering}
        />
        <TextInput
          label="Confirm Password *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
          autoComplete="new-password"
          placeholder="Re-enter your password"
          editable={!isRegistering}
        />
      </View>

      <View style={styles.legalSection}>
        <Text style={styles.sectionHeader} allowFontScaling>
          Legal Compliance
        </Text>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel="Accept Terms of Service"
          onPress={() => setTermsAccepted((prev) => !prev)}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxLabel} allowFontScaling>
              I agree to the{" "}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="View Terms of Service"
              onPress={() => setActiveModal("TERMS")}
              hitSlop={4}
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
            {privacyAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxLabel} allowFontScaling>
              I agree to the{" "}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="View Privacy Policy"
              onPress={() => setActiveModal("PRIVACY")}
              hitSlop={4}
            >
              <Text style={styles.linkText} allowFontScaling>
                Privacy Policy
              </Text>
            </Pressable>
          </View>
        </Pressable>
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
          title={isRegistering ? "Creating Account..." : "Create Account"}
          loading={isRegistering}
          disabled={isRegistering}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Button
          title="Already have an account? Sign In"
          variant="outline"
          disabled={isRegistering}
          onPress={() =>
            navigateBackOrReplace(
              router.canGoBack,
              router.back,
              () => router.replace('/(auth)/login')
            )
          }
        />
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
    paddingVertical: spacing.md,
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
  formSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  legalSection: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  checkboxTextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    flex: 1,
  },
  checkboxLabel: {
    fontSize: typography.caption,
    color: colors.textPrimary,
  },
  linkText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
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
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});
