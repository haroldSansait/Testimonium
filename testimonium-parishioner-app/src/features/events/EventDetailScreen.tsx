import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, Card, EmptyState, Skeleton } from "@/components/ui";
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
          <Skeleton height={140} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={160} borderRadius={radii.md} style={styles.skeleton} />
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

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Event Details"
        subtitle={event.parish?.parishName}
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Event Title Card */}
        <Card style={styles.mainCard}>
          <View style={styles.badgeRow}>
            <View style={styles.eventTypeBadge}>
              <Text style={styles.eventTypeText}>{event.eventType}</Text>
            </View>
          </View>

          <Text style={styles.titleText}>{event.title}</Text>
        </Card>

        {/* Schedule & Location Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Schedule & Venue</Text>

          <View style={styles.detailRow}>
            <View style={styles.iconCol}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{dateFormatted}</Text>
            </View>
          </View>

          {timeFormatted && (
            <View style={styles.detailRow}>
              <View style={styles.iconCol}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{timeFormatted}</Text>
              </View>
            </View>
          )}

          {event.location && (
            <View style={styles.detailRow}>
              <View style={styles.iconCol}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Location / Venue</Text>
                <Text style={styles.detailValue}>{event.location}</Text>
              </View>
            </View>
          )}

          {event.parish && (
            <TouchableOpacity
              style={styles.detailRow}
              onPress={handleParishPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconCol}>
                <Ionicons name="business-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Parish Church</Text>
                <View style={styles.parishLinkRow}>
                  <Text style={styles.parishLinkText}>
                    {event.parish.parishName}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={colors.primary}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}
        </Card>

        {/* Description / Additional Information */}
        {event.description && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About this Event</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </Card>
        )}
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  skeleton: {
    marginBottom: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  mainCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  eventTypeBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  eventTypeText: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  titleText: {
    ...fontStyles.heading,
    fontSize: 20,
    color: colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    ...fontStyles.subheading,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  iconCol: {
    width: 28,
    alignItems: "center",
    marginTop: 2,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  detailValue: {
    ...fontStyles.body,
    color: colors.textPrimary,
    fontWeight: "600",
    marginTop: 1,
  },
  parishLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  parishLinkText: {
    ...fontStyles.body,
    color: colors.primary,
    fontWeight: "600",
  },
  descriptionText: {
    ...fontStyles.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
