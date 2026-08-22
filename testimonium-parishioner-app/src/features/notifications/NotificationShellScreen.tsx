import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, EmptyState } from "@/components/ui";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, spacing } from "@/theme/tokens";

export const NotificationShellScreen: React.FC = () => {
  const router = useRouter();

  const handleBack = () => {
    navigateBackOrReplace(
      () => router.canGoBack(),
      () => router.back(),
      () => router.replace("/(app)/(tabs)/(home)" as any)
    );
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Notifications"
        onBack={handleBack}
        backAccessibilityLabel="Back to home"
      />

      <View style={styles.content}>
        <EmptyState
          icon="notifications-outline"
          title="No Notifications Yet"
          description="Diocesan announcements, mass schedules, and updates will appear here in an upcoming release."
          actionLabel="Back to Home"
          onAction={handleBack}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
});
