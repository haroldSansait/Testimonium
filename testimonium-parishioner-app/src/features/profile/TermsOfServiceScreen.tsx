import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, Card } from "@/components/ui";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export const TermsOfServiceScreen: React.FC = () => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/profile/settings" as any);
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Terms of Service"
        subtitle="Diocese of San Carlos"
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.effectiveDate}>Effective Date: August 2026</Text>

          <Text style={styles.heading}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using TESTIMONIUM, the official sacramental records and scheduling portal of the Roman Catholic Diocese of San Carlos, you agree to comply with and be bound by these Terms of Service, diocesan policies, and relevant provisions of the Code of Canon Law.
          </Text>

          <Text style={styles.heading}>2. Sacramental Document Requests</Text>
          <Text style={styles.paragraph}>
            Sacramental certificates (Baptism, Confirmation, Marriage, Death/Burial) issued through this portal are official ecclesiastical documents. You certify that all personal information and supporting documents submitted are true, authentic, and pertain to the authorized requester or subject of the record.
          </Text>
          <Text style={styles.paragraph}>
            Submission of falsified records or unauthorized requests is strictly prohibited and may result in revocation of access and referral to appropriate diocesan and legal authorities.
          </Text>

          <Text style={styles.heading}>3. Sacramental Scheduling</Text>
          <Text style={styles.paragraph}>
            Parish schedules, canonical interviews, and mass intentions scheduled through TESTIMONIUM are subject to review, verification, and confirmation by the relevant parish office and clergy.
          </Text>
          <Text style={styles.paragraph}>
            The parish reserves the right to propose alternative dates or decline requests based on pastoral schedule, liturgical calendar constraints, or canonical prerequisites.
          </Text>

          <Text style={styles.heading}>4. User Account Security</Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your authenticated session. You agree to notify the diocesan administrator immediately of any unauthorized access.
          </Text>

          <Text style={styles.heading}>5. Ecclesiastical Authority & Modifications</Text>
          <Text style={styles.paragraph}>
            The Diocese of San Carlos reserves the right to update these terms to reflect changes in pastoral guidelines, canonical norms, or technical requirements. Continued use of the service constitutes acceptance of any modifications.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  effectiveDate: {
    ...fontStyles.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  heading: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  paragraph: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
