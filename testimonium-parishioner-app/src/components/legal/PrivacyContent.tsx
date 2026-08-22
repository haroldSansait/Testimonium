/**
 * Canonical Privacy Policy Component
 * Source: testimonium-parishioner-web/src/components/legal/PrivacyContent.tsx as reconciled 2026-08-20
 * Legal version: v1.0
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export const PrivacyContent: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          To process certificate requests, parish appointments, and verification, TESTIMONIUM collects:
        </Text>
        <Text style={styles.bulletItem}>• Profile Information: Full name, email address, contact telephone number, and home address.</Text>
        <Text style={styles.bulletItem}>• Sacramental Records: Date of birth, baptismal details, confirmation records, parents&apos; names, and marriage registry data.</Text>
        <Text style={styles.bulletItem}>• Transaction Data: Uploaded payment receipts and GCash/Maya reference numbers.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Third-Party Infrastructure Services</Text>
        <Text style={styles.paragraph}>
          Your data is processed using production-grade infrastructure with strict security protocols:
        </Text>
        <Text style={styles.bulletItem}>• Firebase Authentication: Manages secure user identities, Google Sign-In tokens, and email verification state.</Text>
        <Text style={styles.bulletItem}>• Cloudflare R2 Object Storage: Stores encrypted uploaded attachments and payment receipts under restricted access policies.</Text>
        <Text style={styles.bulletItem}>• Automated OCR Engine: Processes uploaded payment proofs for reference and amount validation without retaining raw image caches.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Data Retention & Usage</Text>
        <Text style={styles.paragraph}>
          The Diocese uses collected information strictly for validating canonical sacramental requests and maintaining immutable audit logs. Personal data is never sold, rented, or commercialized.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Cookies & Session Management</Text>
        <Text style={styles.paragraph}>
          We use secure session tokens and local storage strictly necessary for authentication and session protection. No third-party tracking cookies are used.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Your Rights Under Philippine Privacy Law</Text>
        <Text style={styles.paragraph}>
          Under Republic Act No. 10173, you have the right to request access to your personal records, request corrections to erroneous entries, and request information regarding data processing protocols.
        </Text>
      </View>

      <View style={styles.contactBox}>
        <Text style={styles.contactTitle}>Diocese Data Protection Officer</Text>
        <Text style={styles.contactText}>Direct inquiries to privacy@testimonium.org</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
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