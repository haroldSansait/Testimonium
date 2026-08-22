import React from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/theme/tokens";
import { PrivacyContent } from "./PrivacyContent";
import { TermsContent } from "./TermsContent";

interface LegalModalProps {
  visible: boolean;
  type: "TERMS" | "PRIVACY";
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ visible, type, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {type === "TERMS" ? "Terms of Service" : "Privacy Policy"}
          </Text>
          <Text style={styles.subtitle}>Roman Catholic Diocese of San Carlos</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {type === "TERMS" ? <TermsContent /> : <PrivacyContent />}
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Close Document" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});