import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLegalPolicies } from "@/hooks/useLegalPolicies";
import { colors, radii, spacing, fontStyles } from "@/theme/tokens";

export const TermsContent: React.FC = () => {
  const { data: policies, isLoading, isError, error, refetch } = useLegalPolicies();

  if (isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText} allowFontScaling>
          Loading authoritative Terms of Service...
        </Text>
      </View>
    );
  }

  if (isError || !policies?.termsOfService) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
        <Text style={styles.errorText} allowFontScaling>
          {error?.message || "Unable to load current Terms of Service."}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading Terms of Service"
          onPress={() => void refetch()}
          style={styles.retryButton}
        >
          <Ionicons name="refresh" size={16} color="#FFF" />
          <Text style={styles.retryButtonText} allowFontScaling>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const terms = policies.termsOfService;
  const effectiveDate = terms.effectiveAt
    ? new Date(terms.effectiveAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "August 1, 2026";

  return (
    <View style={styles.container}>
      <View style={styles.metaBadge}>
        <Text style={styles.metaVersion} allowFontScaling>
          Version {terms.version}
        </Text>
        <Text style={styles.metaDivider} allowFontScaling>
          •
        </Text>
        <Text style={styles.metaDate} allowFontScaling>
          Effective {effectiveDate}
        </Text>
      </View>

      <View style={styles.readingSurface}>
        <Text style={styles.textContent} allowFontScaling selectable>
          {terms.content}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  stateContainer: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  errorText: {
    ...fontStyles.bodySmall,
    color: colors.danger,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  retryButtonText: {
    ...fontStyles.captionMedium,
    color: "#FFF",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    alignSelf: "flex-start",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metaVersion: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  metaDivider: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  metaDate: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  readingSurface: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  textContent: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    lineHeight: 22,
  },
});
