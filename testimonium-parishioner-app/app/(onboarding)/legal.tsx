import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { useAuth } from "@/providers/AuthProvider";
import { useLegalPolicies } from "@/hooks/useLegalPolicies";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { LegalAcceptancePayload } from "@/types/auth";

export default function LegalScreen() {
  const {
    isAcceptingLegal,
    acceptLegal,
    pendingLegalAction,
    cancelGoogleJitLegal,
    logout,
    profile,
  } = useAuth();

  const {
    data: policies,
    isLoading: isPoliciesLoading,
    isError: isPoliciesError,
    error: policiesError,
    refetch: refetchPolicies,
  } = useLegalPolicies();

  const isGoogleJit = pendingLegalAction?.kind === "GOOGLE_JIT_LOGIN";

  // Determine which policies require acceptance
  const needsTerms = isGoogleJit || Boolean(profile && !profile.termsAccepted);
  const needsPrivacy = isGoogleJit || Boolean(profile && !profile.privacyAccepted);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState<"TERMS" | "PRIVACY" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!policies?.termsOfService || !policies?.privacyPolicy) {
      setError("Authoritative legal policies are currently unavailable. Please retry.");
      return;
    }

    if (needsTerms && !termsAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    if (needsPrivacy && !privacyAccepted) {
      setError("Please acknowledge the Privacy Policy to continue.");
      return;
    }

    setError(null);

    const payload: LegalAcceptancePayload = {};
    if (isGoogleJit) {
      payload.termsAccepted = true;
      payload.privacyAccepted = true;
      payload.termsVersion = policies.termsOfService.version;
      payload.privacyVersion = policies.privacyPolicy.version;
    } else {
      if (needsTerms) {
        payload.termsAccepted = true;
        payload.termsVersion = policies.termsOfService.version;
      }
      if (needsPrivacy) {
        payload.privacyAccepted = true;
        payload.privacyVersion = policies.privacyPolicy.version;
      }
    }

    try {
      await acceptLegal(payload);
    } catch (cause) {
      if (isAppError(cause) && cause.code === "LEGAL_ACCEPTANCE_VERSION_CONFLICT") {
        setError("The legal policies were updated by the diocese while you were reviewing. Please review the updated version and confirm acceptance.");
        setTermsAccepted(false);
        setPrivacyAccepted(false);
        void refetchPolicies();
      } else {
        setError(
          isAppError(cause)
            ? cause.message
            : "Could not record legal acceptance. Please check your connection and try again."
        );
      }
    }
  };

  const handleCancel = async () => {
    if (isGoogleJit) {
      await cancelGoogleJitLegal();
    } else {
      await logout();
    }
  };

  const canSubmit =
    (!needsTerms || termsAccepted) &&
    (!needsPrivacy || privacyAccepted) &&
    Boolean(policies?.termsOfService && policies?.privacyPolicy) &&
    !isAcceptingLegal &&
    !isPoliciesLoading;

  return (
    <AuthScaffold
      title="Legal Acceptance Required"
      subtitle={
        isGoogleJit
          ? "Welcome to TESTIMONIUM! Before we create your parishioner account, please review and accept our Terms of Service and Privacy Policy."
          : "The Diocese has updated its legal policies. Please review and accept the updated terms to continue."
      }
    >
      <View style={styles.container}>
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

        {isPoliciesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText} allowFontScaling>
              Loading authoritative legal policies...
            </Text>
          </View>
        ) : isPoliciesError || !policies ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={styles.errorText} allowFontScaling>
              {policiesError?.message || "Unable to load current legal policies."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refetchPolicies()}
              style={styles.retryButton}
            >
              <Ionicons name="refresh" size={14} color="#FFF" />
              <Text style={styles.retryButtonText} allowFontScaling>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Form Section */
          <FormSection title="Vicariate of Canlaon Terms &amp; Privacy">
            <View style={styles.legalCheckboxes}>
              {needsTerms && (
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
                      I have read and agree to the{" "}
                    </Text>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="View Terms of Service"
                      onPress={() => setActiveModal("TERMS")}
                      hitSlop={8}
                    >
                      <Text style={styles.linkText} allowFontScaling>
                        Terms of Service ({policies.termsOfService.version})
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}

              {needsPrivacy && (
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
                      I have read and agree to the{" "}
                    </Text>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="View Privacy Policy"
                      onPress={() => setActiveModal("PRIVACY")}
                      hitSlop={8}
                    >
                      <Text style={styles.linkText} allowFontScaling>
                        Privacy Policy ({policies.privacyPolicy.version})
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
            </View>
          </FormSection>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isAcceptingLegal ? "Saving Acceptance..." : "Accept & Continue"}
            size="lg"
            loading={isAcceptingLegal}
            disabled={!canSubmit}
            onPress={() => {
              void handleAccept();
            }}
          />

          <Button
            title="Cancel / Sign Out"
            variant="outline"
            size="lg"
            disabled={isAcceptingLegal}
            onPress={() => {
              void handleCancel();
            }}
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
  container: {
    gap: spacing.lg,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  retryButtonText: {
    ...fontStyles.captionMedium,
    color: "#FFF",
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
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    flexWrap: "wrap",
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
  },
});