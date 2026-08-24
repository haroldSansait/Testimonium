import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { LegalModal } from "@/components/legal/LegalModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>COMPLIANCE & TERMS</Text>
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

        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Diocese of San Carlos Terms & Privacy
          </Text>

          <View style={styles.legalCheckboxes}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="Accept Terms of Service"
              onPress={() => setTermsAccepted((prev) => !prev)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
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
                {privacyAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
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
        </Card>

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
  cardHeaderTitle: {
    ...fontStyles.captionBold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  legalCheckboxes: {
    gap: spacing.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 2,
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
    marginBottom: spacing.md,
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