import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function LegalScreen() {
  const { isAcceptingLegal, acceptLegal, pendingLegalAction, cancelGoogleJitLegal, logout } = useAuth();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState<"TERMS" | "PRIVACY" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGoogleJit = pendingLegalAction?.kind === "GOOGLE_JIT_LOGIN";

  const handleAccept = async () => {
    if (!termsAccepted || !privacyAccepted) {
      setError("Please check both boxes to accept the Terms of Service and Privacy Policy.");
      return;
    }

    setError(null);
    try {
      await acceptLegal({
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "Could not record legal acceptance. Please check your connection and try again."
      );
    }
  };

  const handleCancel = async () => {
    if (isGoogleJit) {
      await cancelGoogleJitLegal();
    } else {
      await logout();
    }
  };

  return (
    <AuthScaffold
      title="Legal Acceptance Required"
      subtitle={
        isGoogleJit
          ? "Welcome to TESTIMONIUM! Before we create your parishioner account, please review and accept our Terms of Service and Privacy Policy."
          : "We have updated our terms and policies. Please review and accept them to continue accessing TESTIMONIUM."
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

        {/* Form Section */}
        <FormSection title="Vicariate of Canlaon Terms & Privacy">
          <View style={styles.legalCheckboxes}>
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
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </FormSection>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isAcceptingLegal ? "Saving Acceptance..." : "Accept & Continue"}
            size="lg"
            loading={isAcceptingLegal}
            disabled={isAcceptingLegal || !termsAccepted || !privacyAccepted}
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