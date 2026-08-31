import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, Card } from "@/components/ui";
import { colors, fontStyles, spacing } from "@/theme/tokens";

const topics = [
  ["Requesting a certificate", "Choose your parish and certificate, provide the requested supporting files, and review before submitting. Track corrections, payment, processing, and pickup in Requests."],
  ["Scheduling a service", "Follow Parish → Service → Date → Time Slot → Confirmation. The app displays only the parish’s currently configured dates and time slots."],
  ["Reschedule proposals", "Open the schedule request or its notification, review the parish’s proposed date and time, then accept or decline."],
  ["Payments", "Follow the instructions on your owned request and upload a clear receipt. Never share passwords, verification codes, or payment credentials."],
  ["Events", "The event feed contains public parish events. Parish-private events are limited to authorized parish staff."],
] as const;

export const HelpScreen: React.FC = () => {
  const router = useRouter();
  return <Screen safeArea style={styles.screen}><AppHeader title="Help Center" subtitle="Using TESTIMONIUM" onBack={() => router.canGoBack() ? router.back() : router.replace("/(app)/profile/settings" as any)} /><ScrollView contentContainerStyle={styles.content}>{topics.map(([title, description]) => <Card key={title} style={styles.card}><Text style={styles.heading}>{title}</Text><Text style={styles.paragraph}>{description}</Text></Card>)}</ScrollView></Screen>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.cardBorder, padding: spacing.md, gap: spacing.xs },
  heading: { ...fontStyles.subheading, color: colors.textPrimary, fontWeight: "700" },
  paragraph: { ...fontStyles.bodySmall, color: colors.textSecondary, lineHeight: 20 },
});
