import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { sendPasswordResetEmail } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
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
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>ACCOUNT RECOVERY</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Reset Password
          </Text>
          <Text style={styles.copy} allowFontScaling>
            Enter your registered email address to receive password reset instructions.
          </Text>
        </View>

        {/* Success Alert */}
        {success ? (
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text style={styles.successTitle} allowFontScaling>
              Reset Link Sent
            </Text>
            <Text style={styles.successCopy} allowFontScaling>
              We sent a password reset link to{" "}
              <Text style={{ fontWeight: "700" }}>{email.trim()}</Text>. Please check your inbox and follow the instructions.
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
              style={{ width: "100%", marginTop: spacing.sm }}
            />
          </Card>
        ) : (
          <>
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

            {/* Form Card */}
            <Card style={styles.formCard}>
              <View style={styles.fields}>
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
              </View>

              <Button
                title={loading ? "Sending Link..." : "Send Reset Link"}
                size="lg"
                loading={loading}
                disabled={loading || !email.trim()}
                onPress={() => {
                  void handleSubmit();
                }}
              />
            </Card>

            {/* Diocesan Coordination Notice */}
            <Card variant="muted" style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.primary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle} allowFontScaling>
                    Need Diocesan Assistance?
                  </Text>
                  <Text style={styles.infoCopy} allowFontScaling>
                    If you no longer have access to your email or require assistance with your account, please contact your Diocese Coordinator or Parish Secretary.
                  </Text>
                </View>
              </View>
            </Card>

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
          </>
        )}
      </View>
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
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  successCard: {
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radii.lg,
  },
  successTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
  },
  successCopy: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.md,
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  infoTitle: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  infoCopy: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
  actions: {
    gap: spacing.sm,
  },
});
