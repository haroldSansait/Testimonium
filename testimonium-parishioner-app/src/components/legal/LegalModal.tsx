import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
          <Text style={styles.title}>
            {type === "TERMS" ? "Terms of Service" : "Privacy Policy"}
          </Text>
          <Text style={styles.subtitle}>Vicariate of Canlaon</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {type === "TERMS" ? <TermsContent /> : <PrivacyContent />}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
            },
          ]}
        >
          <Button title="Close Document" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});