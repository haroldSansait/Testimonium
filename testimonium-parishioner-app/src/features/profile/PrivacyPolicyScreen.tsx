import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, Card } from "@/components/ui";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export const PrivacyPolicyScreen: React.FC = () => {
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
        title="Privacy Policy"
        subtitle="Diocese of San Carlos"
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.effectiveDate}>Effective Date: August 2026</Text>

          <Text style={styles.heading}>1. Commitment to Data Privacy</Text>
          <Text style={styles.paragraph}>
            The Roman Catholic Diocese of San Carlos is dedicated to safeguarding personal information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and ecclesiastical confidentiality standards regarding sacramental registers.
          </Text>

          <Text style={styles.heading}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect personal information necessary for sacramental processing and identity verification:
          </Text>
          <Text style={styles.paragraph}>
            • Account Data: Full name, verified email address, contact telephone number, and residential address.
          </Text>
          <Text style={styles.paragraph}>
            • Document & Sacramental Data: Names of child/applicant, parentage, date and place of sacramental reception, purpose of request, and supporting identification documents (e.g. PSA certificates, valid government IDs).
          </Text>
          <Text style={styles.paragraph}>
            • Schedule Details: Appointment requests, parish selections, requested dates, and pastoral notes.
          </Text>

          <Text style={styles.heading}>3. Purpose of Processing</Text>
          <Text style={styles.paragraph}>
            Your information is processed strictly for:
          </Text>
          <Text style={styles.paragraph}>
            • Verifying identity and authority to receive sacramental certificates.
          </Text>
          <Text style={styles.paragraph}>
            • Locating canonical registry records across diocesan parish archives.
          </Text>
          <Text style={styles.paragraph}>
            • Managing clerical appointments and sending official transactional notices.
          </Text>

          <Text style={styles.heading}>4. Information Security & Storage</Text>
          <Text style={styles.paragraph}>
            All sensitive documents and personal data are encrypted in transit and at rest. Access is strictly limited to authorized parish secretaries, parish priests, and diocesan chancery personnel with a verified pastoral need.
          </Text>

          <Text style={styles.heading}>5. Rights of Data Subjects</Text>
          <Text style={styles.paragraph}>
            You have the right to access, verify, and request corrections to your personal profile information. For inquiries regarding historical sacramental registers or data privacy rights, please contact the Diocesan Chancery Office.
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
