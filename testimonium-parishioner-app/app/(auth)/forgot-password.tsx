import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { sendPasswordResetEmail } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { FormSection } from "@/components/ui/FormSection";
import { firebaseAuth } from "@/services/firebase";
import { firebaseErrorToAppError, isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { navigateBackOrReplace } from "@/services/navigation/back";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, trimmedEmail);
      setSuccess(true);
    } catch (cause) {
      const appErr = isAppError(cause) ? cause : firebaseErrorToAppError(cause);
      setError(appErr.message || "Failed to send password reset email. Please verify your address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Reset Password"
      subtitle="Enter your registered email address to receive password reset instructions."
    >
      {/* Success View */}
      {success ? (
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={44} color={colors.primary} />
          </View>
          <Text style={styles.successTitle} allowFontScaling>
            Reset Link Sent
          </Text>
          <Text style={styles.successCopy} allowFontScaling>
            We sent a password reset link to{" "}
            <Text style={styles.successEmail}>{email.trim()}</Text>. Please check your inbox and follow the instructions.
          </Text>
          <Button
            title="Return to Sign In"
            size="lg"
            onPress={() =>
              navigateBackOrReplace(
                router.canGoBack,
                router.back,
                () => router.replace("/(auth)/login")
              )
            }
            style={styles.fullWidthButton}
          />
        </View>
      ) : (
        <View style={styles.formContainer}>
          {/* Error Notice */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.danger}
                style={styles.errorIcon}
              />
              <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
                {error}
              </Text>
            </View>
          )}

          {/* Form Section */}
          <FormSection style={styles.fieldsSection}>
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="e.g. parishioner@example.com"
              leftIcon="mail-outline"
              editable={!loading}
            />

            <Button
              title={loading ? "Sending Link..." : "Send Reset Link"}
              size="lg"
              loading={loading}
              disabled={loading || !email.trim()}
              onPress={() => {
                void handleSubmit();
              }}
            />
          </FormSection>

          {/* Diocesan Coordination Notice */}
          <View style={styles.assistanceNotice}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.primary}
              style={{ marginTop: 1 }}
            />
            <View style={styles.assistanceTextWrap}>
              <Text style={styles.assistanceTitle} allowFontScaling>
                Need Diocesan Assistance?
              </Text>
              <Text style={styles.assistanceCopy} allowFontScaling>
                If you no longer have access to your email or require assistance with your account, please contact your Diocese Coordinator or Parish Secretary.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Back to Sign In"
              variant="ghost"
              disabled={loading}
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
      )}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: spacing.lg,
  },
  fieldsSection: {
    gap: spacing.md,
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
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  successIconWrap: {
    marginBottom: spacing.xs,
  },
  successTitle: {
    ...fontStyles.titleSerif,
    color: colors.primary,
    textAlign: "center",
  },
  successCopy: {
    ...fontStyles.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  successEmail: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  fullWidthButton: {
    width: "100%",
    marginTop: spacing.md,
  },
  assistanceNotice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  assistanceTextWrap: {
    flex: 1,
  },
  assistanceTitle: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  assistanceCopy: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
