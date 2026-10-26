import { useOtpCooldown } from '@/hooks/useOtpCooldown';
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { OtpInput } from "@/components/ui/OtpInput";
import { FormSection } from "@/components/ui/FormSection";
import { authApi } from "@/services/api/endpoints/auth";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { navigateBackOrReplace } from "@/services/navigation/back";

type ResetStep = "EMAIL" | "OTP" | "NEW_PASSWORD" | "SUCCESS";

export default function ForgotPasswordScreen() {
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [step, setStep] = useState<ResetStep>("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useOtpCooldown();



  // Step 1: Request Password Reset OTP
  const handleRequestOtp = async () => {
    if (loading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid registered email address.");
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.requestPasswordResetOtp(trimmedEmail);
      if (!mountedRef.current) return;
      setCooldown(response.cooldownSeconds || 60);
      setStep("OTP");
    } catch (cause) {
      if (!mountedRef.current) return;
      if (isAppError(cause) && cause.retryAfterMs) setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      setError(
        isAppError(cause)
          ? cause.message
          : "Failed to request password reset. Please try again."
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (loading || cooldown > 0) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.requestPasswordResetOtp(email.trim());
      if (!mountedRef.current) return;
      setCooldown(response.cooldownSeconds || 60);
      setOtp("");
    } catch (cause) {
      if (!mountedRef.current) return;
      if (isAppError(cause) && cause.retryAfterMs) setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      setError(
        isAppError(cause)
          ? cause.message
          : "Failed to resend reset code. Please try again."
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || otp).trim();
    if (loading) return;
    if (finalCode.length !== 6) {
      setError("Please enter the full 6-digit reset code.");
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.verifyPasswordResetOtp(email.trim(), finalCode);
      if (!mountedRef.current) return;
      if (!response.resetToken) throw new Error("Reset session missing. Request a new code.");
      setResetToken(response.resetToken);
      setStep("NEW_PASSWORD");
    } catch (cause) {
      if (!mountedRef.current) return;
      if (isAppError(cause) && cause.retryAfterMs) setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      setError(
        isAppError(cause)
          ? cause.message
          : "Invalid or expired reset code. Please try again."
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Step 3: Complete Password Reset
  const handleCompleteReset = async () => {
    if (loading) return;
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await authApi.completePasswordReset({
        email: email.trim(),
        resetToken,
        newPassword,
      });
      if (!mountedRef.current) return;
      setResetToken(""); setNewPassword(""); setConfirmPassword("");
      setStep("SUCCESS");
    } catch (cause) {
      if (!mountedRef.current) return;
      if (isAppError(cause) && cause.retryAfterMs) setCooldown(Math.ceil(cause.retryAfterMs / 1000));
      setError(
        isAppError(cause)
          ? cause.message
          : "Failed to reset password. The session may have expired."
      );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const getTitle = () => {
    switch (step) {
      case "EMAIL":
        return "Forgot Password";
      case "OTP":
        return "Verify Reset Code";
      case "NEW_PASSWORD":
        return "Set New Password";
      case "SUCCESS":
        return "Password Reset Complete";
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case "EMAIL":
        return "Enter your registered email address to receive a 6-digit recovery code.";
      case "OTP":
        return `If your account is eligible, check ${email.trim()} for a code.`;
      case "NEW_PASSWORD":
        return "Choose a strong password with at least 8 characters.";
      case "SUCCESS":
        return "Your password has been securely updated. You can now sign in.";
    }
  };

  return (
    <AuthScaffold title={getTitle()} subtitle={getSubtitle()}>
      {/* Error Notice */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} style={styles.errorIcon} />
          <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
            {error}
          </Text>
        </View>
      )}

      {step === "NEW_PASSWORD" && <Button title="Request a fresh code" variant="ghost" disabled={loading} onPress={() => {
        setResetToken(""); setNewPassword(""); setConfirmPassword(""); setOtp(""); setError(null); setStep("EMAIL");
      }} />}
      {/* Step 1: Email Form */}
      {step === "EMAIL" && (
        <View style={styles.formContainer}>
          <FormSection style={styles.fieldsSection}>
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="e.g. parishioner@example.com"
              leftIcon="mail-outline"
              editable={!loading}
              testID="forgot-password-email-input"
            />

            <Button
              title={loading ? "Sending Code..." : "Send Verification Code"}
              size="lg"
              loading={loading}
              disabled={loading || !email.trim()}
              onPress={() => {
                void handleRequestOtp();
              }}
              testID="forgot-password-submit-email-btn"
            />
          </FormSection>

          <View style={styles.assistanceNotice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <View style={styles.assistanceTextWrap}>
              <Text style={styles.assistanceTitle} allowFontScaling>
                Need Diocesan Assistance?
              </Text>
              <Text style={styles.assistanceCopy} allowFontScaling>
                If you no longer have access to your email, please contact your Diocese Coordinator or Parish Secretary.
              </Text>
            </View>
          </View>

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

      {/* Step 2: OTP Verification */}
      {step === "OTP" && (
        <View style={styles.formContainer}>
          <View style={styles.otpSection}>
            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (error) setError(null);
              }}
              onComplete={(code) => {
                void handleVerifyOtp(code);
              }}
              disabled={loading}
              hasError={Boolean(error)}
              autoFocus={true}
              testID="forgot-password-otp-input"
            />
            <Text style={styles.otpHelpText} allowFontScaling>
              Code expires in 10 minutes. Check your spam folder if not received.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              title={loading ? "Verifying..." : "Verify Code"}
              size="lg"
              loading={loading}
              disabled={loading || otp.trim().length !== 6}
              onPress={() => {
                void handleVerifyOtp();
              }}
              testID="forgot-password-verify-otp-btn"
            />

            <Button
              title={
                loading
                  ? "Please wait..."
                  : cooldown > 0
                  ? `Resend Code in ${cooldown}s`
                  : "Resend Code"
              }
              variant="outline"
              disabled={loading || cooldown > 0}
              onPress={() => {
                void handleResendOtp();
              }}
            />

            <Button
              title="Use a Different Email"
              variant="ghost"
              disabled={loading}
              onPress={() => {
                setStep("EMAIL");
                setOtp("");
                setError(null);
              }}
            />
          </View>
        </View>
      )}

      {/* Step 3: Set New Password */}
      {step === "NEW_PASSWORD" && (
        <View style={styles.formContainer}>
          <FormSection style={styles.fieldsSection}>
            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (error) setError(null);
              }}
              isPassword
              autoComplete="new-password"
              maxLength={128}
              placeholder="At least 8 characters"
              leftIcon="lock-closed-outline"
              editable={!loading}
              testID="forgot-password-new-password"
            />

            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (error) setError(null);
              }}
              isPassword
              placeholder="Re-enter your new password"
              leftIcon="lock-closed-outline"
              editable={!loading}
              testID="forgot-password-confirm-password"
            />

            <Button
              title={loading ? "Resetting Password..." : "Reset Password"}
              size="lg"
              loading={loading}
              disabled={loading || !newPassword || !confirmPassword}
              onPress={() => {
                void handleCompleteReset();
              }}
              testID="forgot-password-complete-btn"
            />
          </FormSection>
        </View>
      )}

      {/* Step 4: Success */}
      {step === "SUCCESS" && (
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={styles.successTitle} allowFontScaling>
            Password Reset Complete
          </Text>
          <Text style={styles.successCopy} allowFontScaling>
            Your password has been successfully reset. Please sign in with your new password to continue.
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
            testID="forgot-password-return-login-btn"
          />
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
    marginBottom: spacing.sm,
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
  otpSection: {
    alignItems: "center",
    gap: spacing.xs,
  },
  otpHelpText: {
    ...fontStyles.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xxs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
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
    maxWidth: 320,
  },
  fullWidthButton: {
    width: "100%",
    marginTop: spacing.md,
  },
});
