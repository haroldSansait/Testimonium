import { useOtpCooldown } from '@/hooks/useOtpCooldown';
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthButton, AuthScaffold } from "@/components/auth";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function VerifyEmailScreen() {
  const { user } = useAuth();
  return <VerifyEmailForm key={`${user?.uid}:${user?.email}`} />;
}

function VerifyEmailForm() {
  const { user, confirmEmailVerificationOtp, resendVerification, logout } = useAuth();

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useOtpCooldown();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);



  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || code).trim();
    if (isVerifying || isSuccess) return;
    if (finalCode.length !== 6) {
      setFeedback({
        type: "error",
        message: "Please enter the full 6-digit verification code.",
      });
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setIsVerifying(true);
    setFeedback(null);

    try {
      const confirmed = await confirmEmailVerificationOtp(finalCode);
      if (!mountedRef.current) return;
      if (!confirmed) throw new Error("Verification is still synchronizing. Please retry.");
      setIsSuccess(true);
      setFeedback({
        type: "success",
        message: "Email verified successfully! Updating your profile...",
      });
    } catch (cause) {
      if (!mountedRef.current) return;
      setFeedback({
        type: "error",
        message: isAppError(cause) ? cause.message : "Invalid or expired verification code. Please check and try again.",
      });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0 || isVerifying) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setIsResending(true);
    setFeedback(null);

    try {
      const response = await resendVerification();
      if (!mountedRef.current) return;
      setCooldown(response.cooldownRemainingSeconds || 60);
      setCode("");
      setFeedback({
        type: "success",
        message: response.message || `A new 6-digit verification code has been sent to ${user?.email || "your email address"}.`,
      });
    } catch (cause) {
      if (!mountedRef.current) return;
      if (isAppError(cause) && cause.retryAfterMs) {
        setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      }
      setFeedback({
        type: "error",
        message: isAppError(cause) ? cause.message : "Could not resend verification code. Please try again later.",
      });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsResending(false);
    }
  };

  useEffect(() => { void handleResend(); }, []);

  const destinationEmail = user?.email || "your registered email";

  return (
    <AuthScaffold
      title="Verify Your Email"
      subtitle="Enter the 6-digit verification code sent to your email address to confirm ownership."
    >
      <View style={styles.container}>
        {/* Email Destination Row */}
        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={24} color={colors.primary} style={styles.mailIcon} />
          <View style={styles.emailTextContainer}>
            <Text style={styles.emailLabel}>Verification email:</Text>
            <Text style={styles.emailValue} numberOfLines={1} allowFontScaling>
              {destinationEmail}
            </Text>
          </View>
        </View>

        {/* Success View */}
        {isSuccess ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={styles.successTitle} allowFontScaling>
              Email Verified
            </Text>
            <Text style={styles.successCopy} allowFontScaling>
              Your email address has been verified. Preparing your account...
            </Text>
          </View>
        ) : (
          <>
            {/* 6-Digit OTP Input */}
            <View style={styles.otpSection}>
              <Text style={styles.otpPrompt} allowFontScaling>
                Enter the 6-digit code
              </Text>
              <OtpInput
                value={code}
                onChange={(val) => {
                  setCode(val);
                  if (feedback?.type === "error") setFeedback(null);
                }}
                onComplete={(completedCode) => {
                  void handleVerify(completedCode);
                }}
                disabled={isVerifying || isResending}
                hasError={feedback?.type === "error"}
                autoFocus={true}
                testID="email-verification-otp"
              />
              <Text style={styles.otpHelpText} allowFontScaling>
                Code expires in 10 minutes. Check your spam folder if not received.
              </Text>
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
                title={isVerifying ? "Verifying Code..." : "Verify Code"}
                variant="primary"
                loading={isVerifying}
                disabled={isResending || isVerifying || code.trim().length !== 6}
                onPress={() => {
                  void handleVerify();
                }}
                testID="verify-email-submit-btn"
                accessibilityLabel="Verify Code"
              />

              <AuthButton
                title={
                  isResending
                    ? "Sending..."
                    : cooldown > 0
                    ? `Resend Code in ${cooldown}s`
                    : "Resend Verification Code"
                }
                variant="outline"
                loading={isResending}
                disabled={isResending || cooldown > 0 || isVerifying}
                onPress={() => {
                  void handleResend();
                }}
                testID="verify-email-resend-btn"
                accessibilityLabel="Resend Verification Code"
              />
            </View>
          </>
        )}

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
  otpSection: {
    alignItems: "center",
    gap: spacing.xs,
  },
  otpPrompt: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  otpHelpText: {
    ...fontStyles.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xxs,
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
  successContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  successIconWrap: {
    marginBottom: spacing.xs,
  },
  successTitle: {
    ...fontStyles.titleSerif,
    color: colors.success,
    textAlign: "center",
  },
  successCopy: {
    ...fontStyles.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  footerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
});