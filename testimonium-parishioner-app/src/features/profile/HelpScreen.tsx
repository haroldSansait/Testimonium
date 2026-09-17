import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { AppHeader } from "@/components/ui/AppHeader";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

const topics = [
  [
    "Requesting a certificate",
    "Choose your parish and certificate, provide the requested supporting files, and review before submitting. Track corrections, payment, processing, and pickup in Requests.",
  ],
  [
    "Scheduling a service",
    "Follow Parish → Service → Date → Time Slot → Confirmation. The app displays only the parish’s currently configured dates and time slots.",
  ],
  [
    "Reschedule proposals",
    "Open the schedule request or its notification, review the parish’s proposed date and time, then accept or decline.",
  ],
  [
    "Payments",
    "Follow the instructions on your owned request and upload a clear receipt. Never share passwords, verification codes, or payment credentials.",
  ],
  [
    "Events",
    "The event feed contains public parish events. Parish-private events are limited to authorized parish staff.",
  ],
] as const;

export const HelpScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();

  return (
    <Screen safeArea style={styles.screen}>
      <AppHeader
        title="Help Center"
        subtitle="Using TESTIMONIUM"
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(app)/profile/settings" as any)
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset() },
        ]}
      >
        <View style={styles.readingSurface}>
          {topics.map(([title, description], idx) => (
            <View
              key={title}
              style={[
                styles.topicSection,
                idx === topics.length - 1 && styles.topicSectionLast,
              ]}
            >
              <Text style={styles.heading} allowFontScaling>
                {title}
              </Text>
              <Text style={styles.paragraph} allowFontScaling>
                {description}
              </Text>
            </View>
          ))}
        </View>
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
  readingSurface: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  topicSection: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xxs,
  },
  topicSectionLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  heading: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  paragraph: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
