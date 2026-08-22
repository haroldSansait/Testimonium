import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { AppHeader, EmptyState } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";

export const RequestsShellScreen: React.FC = () => {
  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Document Requests"
        subtitle="Certificates & Records"
      />

      <View style={styles.content}>
        <EmptyState
          icon="document-text-outline"
          title="Document Requests"
          description="Requesting official sacramental certificates (Baptismal, Confirmation, Marriage) directly from your parish will be available in an upcoming update."
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
