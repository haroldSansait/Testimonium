import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { AppHeader } from "@/components/ui/AppHeader";
import { TermsContent } from "@/components/legal/TermsContent";
import { colors, spacing } from "@/theme/tokens";

export const TermsOfServiceScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();

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
        subtitle="Vicariate of Canlaon"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset() },
        ]}
      >
        <TermsContent />
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
  },
});
