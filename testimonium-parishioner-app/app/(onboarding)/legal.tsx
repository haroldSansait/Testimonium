import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/config/legal";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
    <Screen scrollable style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>COMPLIANCE & TERMS</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Legal Acceptance Required
          </Text>
          <Text style={styles.copy} allowFontScaling>
            {isGoogleJit
              ? "Welcome to TESTIMONIUM! Before we create your parishioner account, please review and accept our Terms of Service and Privacy Policy."
              : "We have updated our terms and policies. Please review and accept them to continue accessing TESTIMONIUM."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeader} allowFontScaling>
            Diocese of San Carlos Terms & Privacy
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
                I have read and agree to the{" "}
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
                I have read and agree to the{" "}
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
            title={isAcceptingLegal ? "Saving Acceptance..." : "Accept & Continue"}
            loading={isAcceptingLegal}
            disabled={isAcceptingLegal || !termsAccepted || !privacyAccepted}
            onPress={() => {
              void handleAccept();
            }}
          />

          <Button
            title="Cancel / Sign Out"
            variant="outline"
            disabled={isAcceptingLegal}
            onPress={() => {
              void handleCancel();
            }}
          />
        </View>

        <LegalModal
          visible={activeModal !== null}
          type={activeModal || "TERMS"}
          onClose={() => setActiveModal(null)}
        />
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardHeader: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
  },
});