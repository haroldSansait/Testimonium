/**
 * Canonical Terms of Service Component
 * Source: testimonium-parishioner-web/src/components/legal/TermsContent.tsx as reconciled 2026-08-20
 * Legal version: v1.0
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export const TermsContent: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Important Notice:</Text>
        <Text style={styles.noticeText}>
          By accessing, registering, or using the TESTIMONIUM Sacramental Record Portal, you enter
          into a legally binding agreement with the Roman Catholic Diocese of San Carlos. Please
          review these terms thoroughly.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Account & Parishioner Responsibilities</Text>
        <Text style={styles.paragraph}>
          Users registering on the TESTIMONIUM portal are responsible for providing truthful,
          complete, and up-to-date accurate information during profile registration and certificate
          requests.
        </Text>
        <Text style={styles.bulletItem}>• You must safeguard your login credentials and authentication tokens.</Text>
        <Text style={styles.bulletItem}>• You are strictly liable for any request or activity submitted under your authenticated user account.</Text>
        <Text style={styles.bulletItem}>• Sharing accounts with unauthorized third parties is prohibited.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Sacramental Record Verification & Governance</Text>
        <Text style={styles.paragraph}>
          All sacramental records (Baptismal, Confirmation, Marriage, Death certificates) rendered
          on TESTIMONIUM remain the canonical property of the Roman Catholic Diocese of San Carlos.
        </Text>
        <Text style={styles.subtext}>
          Official verification remains subject to physical canonical ledger validation by
          authorized Parish Secretaries and Priests. Submission of false information or altered
          receipts for payment processing constitutes fraud under Philippine Law.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Acceptable Use & Prohibited Conduct</Text>
        <Text style={styles.paragraph}>When interacting with the platform, you agree NOT to:</Text>
        <Text style={styles.bulletItem}>• Attempt automated bot requests or rate-limit circumvention.</Text>
        <Text style={styles.bulletItem}>• Upload fraudulent payment receipts or malformed files to Cloudflare R2 storage.</Text>
        <Text style={styles.bulletItem}>• Impersonate parish personnel, clergy, or another parishioner.</Text>
        <Text style={styles.bulletItem}>• Reverse engineer or attempt unauthorized access to Diocese administration endpoints.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Data Retention & Privacy Compliance</Text>
        <Text style={styles.paragraph}>
          Personal information, sacramental details, and uploaded verification receipts are stored
          securely in compliance with the Republic Act No. 10173 (Philippine Data Privacy Act of 2012).
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Account Suspension & Termination</Text>
        <Text style={styles.paragraph}>
          The Diocese reserves the right to suspend or deactivate any account found violating security
          standards, attempting rate-limit abuse, or submitting fraudulent requests.
        </Text>
      </View>

      <View style={styles.contactBox}>
        <Text style={styles.contactTitle}>Have questions regarding these terms?</Text>
        <Text style={styles.contactText}>Contact the Vicariate Chancery Office at support@testimonium.org</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  noticeBox: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noticeTitle: {
    fontWeight: "700",
    color: "#78350F",
    fontSize: typography.caption,
  },
  noticeText: {
    color: "#92400E",
    fontSize: typography.caption,
    lineHeight: 20,
  },
  section: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  subtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  bulletItem: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    lineHeight: 20,
    paddingLeft: spacing.sm,
  },
  contactBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  contactTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
    fontSize: typography.caption,
  },
  contactText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
});
