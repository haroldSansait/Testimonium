import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { isGoogleAuthAvailable } from "@/services/auth/googleAuth";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function WelcomeScreen() {
  const { state, error, sessionIssue, isSigningIn, signInWithGoogle, retryBootstrap, logout } = useAuth();
  const showGoogleButton = isGoogleAuthAvailable();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setGoogleError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setGoogleError(
        isAppError(cause) ? cause.message : "We could not sign in with Google. Please try again."
      );
    }
  };

  if (state === "SESSION_ERROR") {
    return (
      <Screen scrollable style={styles.container}>
        <View style={styles.innerContainer}>
          <Card variant="muted" style={styles.errorCard}>
            <Ionicons name="alert-circle" size={32} color={colors.danger} />
            <Text style={styles.errorCardTitle} allowFontScaling>
              Session Verification Issue
            </Text>
            <Text style={styles.errorCardCopy} allowFontScaling>
              {sessionIssue?.message || error || "We could not verify your TESTIMONIUM account."}
            </Text>
          </Card>

          <View style={styles.actions}>
            {sessionIssue?.retryable && (
              <Button
                title="Retry Verification"
                onPress={() => {
                  void retryBootstrap();
                }}
              />
            )}
            <Button
              title="Sign Out / Switch Account"
              variant="outline"
              onPress={() => {
                void logout();
              }}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Brand Header */}
        <View style={styles.brandHero}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>DIOCESE OF SAN CARLOS</Text>
          </View>
          <Text style={styles.brandTitle} allowFontScaling>
            TESTIMONIUM
          </Text>
          <Text style={styles.brandSubtitle} allowFontScaling>
            Parishioner Mobile Portal
          </Text>
          <Text style={styles.brandCopy} allowFontScaling>
            Access sacramental records, schedule canonical appointments, and track certificate requests across the diocese.
          </Text>

          {/* Key Services Preview Pills */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.featureText} allowFontScaling>
                Sacramental Document Processing
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.featureText} allowFontScaling>
                Canonical Appointments & Blessings
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="search-outline" size={16} color={colors.primary} />
              <Text style={styles.featureText} allowFontScaling>
                Real-Time Certificate Status Tracking
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Sign In"
            size="lg"
            onPress={() => router.push("/(auth)/login")}
          />
          <Button
            title="Create an Account"
            size="lg"
            variant="outline"
            onPress={() => router.push("/(auth)/register" as any)}
          />
          {showGoogleButton && (
            <>
              <Button
                title="Continue with Google"
                size="lg"
                variant="secondary"
                loading={isSigningIn}
                disabled={isSigningIn}
                onPress={() => {
                  void handleGoogleSignIn();
                }}
              />
              {googleError && (
                <View style={styles.errorBanner}>
                  <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
                    {googleError}
                  </Text>
                </View>
              )}
            </>
          )}

          <Text style={styles.footerNote} allowFontScaling>
            Roman Catholic Diocese of San Carlos
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    minHeight: "100%",
  },
  brandHero: {
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  dioceseBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  dioceseBadgeText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  brandTitle: {
    ...fontStyles.display,
    color: colors.primary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  brandCopy: {
    ...fontStyles.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  featureList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  featureText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    textAlign: "center",
  },
  errorCard: {
    alignItems: "center",
    padding: spacing.lg,
    marginVertical: spacing.xl,
    gap: spacing.sm,
  },
  errorCardTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  errorCardCopy: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  footerNote: {
    ...fontStyles.meta,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});