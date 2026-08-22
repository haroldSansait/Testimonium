import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { AppHeader, EmptyState } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";

export const ScheduleShellScreen: React.FC = () => {
  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule & Appointments"
        subtitle="Mass Intentions & Ministry"
      />

      <View style={styles.content}>
        <EmptyState
          icon="calendar-outline"
          title="Parish Scheduling"
          description="Scheduling pastoral appointments, requesting mass intentions, and reserving church facilities will be available in an upcoming update."
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
