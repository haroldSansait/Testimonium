import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthButton, AuthScaffold } from "@/components/auth";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function VerifyEmailScreen() {
  const { user, isCheckingVerification, checkEmailVerification, resendVerification, logout } = useAuth();

  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleCheck = async () => {
    if (isCheckingVerification) return;
    setFeedback(null);

    const verified = await checkEmailVerification(false);
    if (!verified) {
      setFeedback({
        type: "info",
        message: "Your email address has not been verified yet. Please check your inbox (and spam folder) and click the verification link.",
      });
    }
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0) return;
    setIsResending(true);
    setFeedback(null);

    try {
      const response = await resendVerification();
      setCooldown(response.retryAfter || 60);
      setFeedback({
        type: "success",
        message: `A fresh verification link has been sent to ${user?.email || "your email address"}.`,
      });
    } catch (cause) {
      if (isAppError(cause) && cause.retryAfterMs) {
        setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      }
      setFeedback({
        type: "error",
        message: isAppError(cause) ? cause.message : "Could not resend verification email. Please try again later.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const destinationEmail = user?.email || "your registered email";

  return (
    <AuthScaffold
      title="Verify Your Email"
      subtitle="To access your sacramental document requests and canonical appointments, please confirm ownership of your email address."
    >
      <View style={styles.container}>
        {/* Email Destination Row */}
        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={24} color={colors.primary} style={styles.mailIcon} />
          <View style={styles.emailTextContainer}>
            <Text style={styles.emailLabel}>Verification link sent to:</Text>
            <Text style={styles.emailValue} numberOfLines={1} allowFontScaling>
              {destinationEmail}
            </Text>
          </View>
        </View>

        {/* Feedback Notice */}
        {feedback && (
          <View
            style={[
              styles.feedbackContainer,
              feedback.type === "success" && styles.feedbackSuccess,
              feedback.type === "error" && styles.feedbackError,
              feedback.type === "info" && styles.feedbackInfo,
            ]}
          >
            <Ionicons
              name={
                feedback.type === "success"
                  ? "checkmark-circle"
                  : feedback.type === "error"
                  ? "alert-circle"
                  : "information-circle"
              }
              size={18}
              color={
                feedback.type === "success"
                  ? colors.success
                  : feedback.type === "error"
                  ? colors.danger
                  : colors.info
              }
              style={{ marginTop: 1 }}
            />
            <Text
              accessibilityRole="alert"
              style={[
                styles.feedbackText,
                feedback.type === "success" && styles.feedbackSuccessText,
                feedback.type === "error" && styles.feedbackErrorText,
                feedback.type === "info" && styles.feedbackInfoText,
              ]}
              allowFontScaling
            >
              {feedback.message}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <AuthButton
            title={isCheckingVerification ? "Checking Status..." : "I've Verified My Email"}
            variant="primary"
            loading={isCheckingVerification}
            disabled={isCheckingVerification}
            onPress={() => {
              void handleCheck();
            }}
            testID="verify-email-check-btn"
            accessibilityLabel="I've Verified My Email"
          />

          <AuthButton
            title={
              isResending
                ? "Sending..."
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend Verification Email"
            }
            variant="outline"
            loading={isResending}
            disabled={isResending || cooldown > 0 || isCheckingVerification}
            onPress={() => {
              void handleResend();
            }}
            testID="verify-email-resend-btn"
            accessibilityLabel="Resend Verification Email"
          />
        </View>

        {/* Sign Out Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText} allowFontScaling>
            Wrong account?
          </Text>
          <Button
            title="Sign Out / Use Another Account"
            variant="ghost"
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  mailIcon: {
    marginTop: 1,
  },
  emailTextContainer: {
    flex: 1,
  },
  emailLabel: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emailValue: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: 2,
  },
  feedbackContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
  },
  feedbackError: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  feedbackInfo: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoBorder,
  },
  feedbackText: {
    ...fontStyles.caption,
    lineHeight: 18,
    flex: 1,
  },
  feedbackSuccessText: {
    color: colors.success,
  },
  feedbackErrorText: {
    color: colors.danger,
  },
  feedbackInfoText: {
    color: colors.info,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  footerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
});