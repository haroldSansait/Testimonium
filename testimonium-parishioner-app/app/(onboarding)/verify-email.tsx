import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>EMAIL VERIFICATION</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Verify Your Email
          </Text>
          <Text style={styles.copy} allowFontScaling>
            To access your sacramental document requests and canonical appointments, please confirm ownership of your email address.
          </Text>
        </View>

        <Card style={styles.emailCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.emailTextContainer}>
            <Text style={styles.emailCardLabel}>Verification Link Sent To:</Text>
            <Text style={styles.emailCardValue} numberOfLines={1} allowFontScaling>
              {destinationEmail}
            </Text>
          </View>
        </Card>

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

        <View style={styles.actions}>
          <Button
            title={isCheckingVerification ? "Checking Status..." : "I've Verified My Email"}
            size="lg"
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
            size="lg"
            loading={isResending}
            disabled={isResending || cooldown > 0 || isCheckingVerification}
            onPress={() => {
              void handleResend();
            }}
          />
        </View>

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
  emailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  emailTextContainer: {
    flex: 1,
  },
  emailCardLabel: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emailCardValue: {
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
    marginBottom: spacing.md,
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
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  footerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
});