import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
    <Screen scrollable style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>SECURITY & INTEGRITY</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Verify Your Email
          </Text>
          <Text style={styles.copy} allowFontScaling>
            To access your sacramental document requests and appointments, please verify ownership of your email address.
          </Text>
        </View>

        <View style={styles.emailCard}>
          <Text style={styles.emailCardLabel}>Verification sent to:</Text>
          <Text style={styles.emailCardValue} allowFontScaling>
            {destinationEmail}
          </Text>
        </View>

        {feedback && (
          <View
            style={[
              styles.feedbackContainer,
              feedback.type === "success" && styles.feedbackSuccess,
              feedback.type === "error" && styles.feedbackError,
              feedback.type === "info" && styles.feedbackInfo,
            ]}
          >
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

        <View style={styles.actions}>
          <Button
            title={isCheckingVerification ? "Checking Status..." : "I've Verified My Email"}
            loading={isCheckingVerification}
            disabled={isCheckingVerification}
            onPress={() => {
              void handleCheck();
            }}
          />

          <Button
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
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Wrong account?</Text>
          <Button
            title="Sign Out / Use Another Account"
            variant="ghost"
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  badgeContainer: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
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
  emailCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emailCardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  emailCardValue: {
    fontSize: typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  feedbackContainer: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  feedbackError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  feedbackInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  feedbackText: {
    fontSize: typography.caption,
    lineHeight: 20,
  },
  feedbackSuccessText: {
    color: "#065F46",
  },
  feedbackErrorText: {
    color: colors.danger,
  },
  feedbackInfoText: {
    color: "#1E40AF",
  },
  actions: {
    gap: spacing.md,
  },
  footer: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  footerText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
});