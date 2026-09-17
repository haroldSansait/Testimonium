import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  EmptyState,
  PageSection,
  RecordSection,
  Skeleton,
  StatusLabel,
} from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useCurrentMonthEvents } from "./api";
import {
  formatEventDate,
  formatEventTime,
  getCurrentLocalMonthParams,
} from "./presentation";
import type { MonthParams } from "./types";

export const EventDetailScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();
  const params = useLocalSearchParams<{
    id: string;
    year?: string;
    month?: string;
  }>();

  const currentLocal = getCurrentLocalMonthParams();
  const year = params.year ? parseInt(params.year, 10) : currentLocal.year;
  const month = params.month ? parseInt(params.month, 10) : currentLocal.month;

  const monthParams: MonthParams = {
    year: !isNaN(year) && year > 0 ? year : currentLocal.year,
    month: !isNaN(month) && month >= 1 && month <= 12 ? month : currentLocal.month,
  };

  const { data: events = [], isLoading } = useCurrentMonthEvents(monthParams);

  const event = events.find((e) => String(e.id) === String(params.id));

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/events" as any);
    }
  };

  const handleParishPress = () => {
    if (event?.parishId) {
      router.push(`/(app)/parishes/${event.parishId}` as any);
    }
  };

  if (isLoading) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader title="Event Details" onBack={handleBack} />
        <View style={styles.content}>
          <Skeleton height={100} borderRadius={radii.xs} style={styles.skeleton} />
          <Skeleton height={180} borderRadius={radii.xs} style={styles.skeleton} />
        </View>
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader title="Event Details" onBack={handleBack} />
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Event Not Found"
            description="The requested event or liturgical schedule could not be found."
            actionLabel="View All Events"
            onAction={handleBack}
          />
        </View>
      </Screen>
    );
  }

  const timeFormatted = formatEventTime(event.startTime, event.endTime);
  const dateFormatted = formatEventDate(event.eventDate, "full");

  const scheduleFields = [
    {
      label: "Date",
      value: dateFormatted,
    },
    ...(timeFormatted
      ? [
          {
            label: "Time",
            value: timeFormatted,
          },
        ]
      : []),
    ...(event.location
      ? [
          {
            label: "Location / Venue",
            value: event.location,
          },
        ]
      : []),
  ];

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Event Details"
        subtitle={event.parish?.parishName}
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset() },
        ]}
      >
        {/* Main Event Title Block */}
        <View style={styles.heroBlock}>
          {event.eventType ? (
            <View style={styles.badgeRow}>
              <StatusLabel
                label={event.eventType.replace(/_/g, " ")}
                status={event.eventType}
                showDot={false}
              />
            </View>
          ) : null}

          <Text
            style={styles.titleText}
            accessibilityRole="header"
            allowFontScaling
          >
            {event.title}
          </Text>
        </View>

        {/* Schedule & Venue Record Section */}
        <RecordSection
          title="Schedule & Venue"
          fields={scheduleFields}
          style={styles.sectionSpacing}
        />

        {/* Parish Church Section */}
        {event.parish ? (
          <PageSection title="Parish Church" style={styles.sectionSpacing}>
            <Pressable
              onPress={handleParishPress}
              accessibilityRole="button"
              accessibilityLabel={`View ${event.parish.parishName}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.parishRow,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.primary}
                style={{ marginRight: spacing.sm }}
              />
              <View style={styles.parishInfoCol}>
                <Text style={styles.parishNameText} allowFontScaling>
                  {event.parish.parishName}
                </Text>
                <Text style={styles.parishSubtext} allowFontScaling>
                  Tap to view parish directory & sacraments
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primary}
              />
            </Pressable>
          </PageSection>
        ) : null}

        {/* Description / Additional Information */}
        {event.description ? (
          <PageSection title="About this Event" style={styles.sectionSpacing}>
            <Text style={styles.descriptionText} allowFontScaling>
              {event.description}
            </Text>
          </PageSection>
        ) : null}
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
  skeleton: {
    marginBottom: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  heroBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  titleText: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 20,
    lineHeight: 26,
  },
  sectionSpacing: {
    marginBottom: spacing.md,
  },
  parishRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pressed: {
    backgroundColor: colors.surfaceVariant,
  },
  parishInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  parishNameText: {
    ...fontStyles.bodyMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  parishSubtext: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  descriptionText: {
    ...fontStyles.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
