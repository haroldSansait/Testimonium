import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { AppHeader } from "@/components/ui/AppHeader";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { colors, spacing } from "@/theme/tokens";

export const PrivacyPolicyScreen: React.FC = () => {
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
        title="Privacy Policy"
        subtitle="Vicariate of Canlaon"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset() },
        ]}
      >
        <PrivacyContent />
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
