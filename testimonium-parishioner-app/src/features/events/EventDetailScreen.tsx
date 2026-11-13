import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/Typography";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  Button,
  EmptyState,
  PageSection,
  RecordSection,
  Skeleton,
  StatusLabel,
} from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useParishDetail } from "@/features/parishes/api";
import {
  buildEmailUrl,
  buildMapUrl,
  buildPhoneUrl,
  openExternalUrl,
} from "@/features/parishes/utils";
import {
  exportIcsCalendarFile,
  openGoogleCalendarExport,
} from "@/services/calendar/calendarExport";
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
  const [calendarBusy, setCalendarBusy] = useState(false);
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
  const { data: parish } = useParishDetail(
    event?.parishId ? String(event.parishId) : undefined
  );

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
  const parishName = parish?.name || event.parish?.parishName;
  const venueLocation = [
    event.location,
    parish?.address,
    parish?.municipalityCity,
    parish?.province,
  ]
    .filter(Boolean)
    .join(", ");
  const phoneUrl = buildPhoneUrl(parish?.contactNumber);
  const emailUrl = buildEmailUrl(parish?.email);
  const mapUrl = buildMapUrl({
    latitude: parish?.latitude,
    longitude: parish?.longitude,
    address: event.location || parish?.address || venueLocation,
    name: parishName || event.title,
  });

  const handleGoogleCalendar = async () => {
    setCalendarBusy(true);
    try {
      const opened = await openGoogleCalendarExport({
        uidPrefix: "testimonium-event",
        id: event.id,
        title: parishName ? `${event.title} — ${parishName}` : event.title,
        date: event.eventDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: venueLocation || parishName,
        description: event.description,
      });
      if (!opened) {
        Alert.alert("Unavailable", "This event does not have a valid date for calendar export.");
      }
    } catch (err: unknown) {
      Alert.alert(
        "Calendar Export Failed",
        err instanceof Error ? err.message : "Unable to open Google Calendar."
      );
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleExportIcs = async () => {
    setCalendarBusy(true);
    try {
      const result = await exportIcsCalendarFile({
        uidPrefix: "testimonium-event",
        id: event.id,
        title: parishName ? `${event.title} — ${parishName}` : event.title,
        date: event.eventDate,
        startTime: event.startTime,
        endTime: event.endTime,
        location: venueLocation || parishName,
        description: event.description,
      });
      if (result.method === "saved") {
        Alert.alert(
          "Calendar File Saved",
          "The .ics event invitation was saved to your selected folder."
        );
      } else if (result.method === "failed") {
        Alert.alert("Export Failed", "Unable to export .ics calendar file.");
      }
    } catch (err: unknown) {
      Alert.alert(
        "Export Failed",
        err instanceof Error ? err.message : "Unable to export .ics calendar file."
      );
    } finally {
      setCalendarBusy(false);
    }
  };

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

        {/* Calendar Export */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.calendarTitle} allowFontScaling>
              Save Event to Calendar
            </Text>
          </View>
          <Text style={styles.calendarHint} allowFontScaling>
            Times follow Philippine Standard Time (Asia/Manila).
          </Text>
          <View style={styles.calendarActions}>
            <Button
              title="Google Calendar"
              size="sm"
              variant="outline"
              icon="logo-google"
              onPress={() => void handleGoogleCalendar()}
              disabled={calendarBusy}
              style={styles.calendarBtn}
            />
            <Button
              title="Export .ICS"
              size="sm"
              variant="secondary"
              icon="download-outline"
              onPress={() => void handleExportIcs()}
              disabled={calendarBusy}
              style={styles.calendarBtn}
            />
          </View>
        </View>

        {/* Parish Church Section */}
        {event.parish ? (
          <PageSection title="Parish Church & Contact" style={styles.sectionSpacing}>
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
                  {parishName || event.parish.parishName}
                </Text>
                {venueLocation ? (
                  <Text style={styles.parishSubtext} allowFontScaling>
                    {venueLocation}
                  </Text>
                ) : null}
                {parish?.contactNumber ? (
                  <Text style={styles.parishSubtext} allowFontScaling>
                    Phone: {parish.contactNumber}
                  </Text>
                ) : null}
                {parish?.email ? (
                  <Text style={styles.parishSubtext} allowFontScaling>
                    Email: {parish.email}
                  </Text>
                ) : null}
                <Text style={styles.parishTapHint} allowFontScaling>
                  Tap to view full parish profile →
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primary}
              />
            </Pressable>

            {phoneUrl || emailUrl || mapUrl ? (
              <View style={styles.contactActionsRow}>
                {phoneUrl ? (
                  <Button
                    title="Call Parish"
                    variant="secondary"
                    size="sm"
                    icon="call-outline"
                    onPress={() => void openExternalUrl(phoneUrl)}
                    style={styles.calendarBtn}
                  />
                ) : null}
                {emailUrl ? (
                  <Button
                    title="Email"
                    variant="secondary"
                    size="sm"
                    icon="mail-outline"
                    onPress={() => void openExternalUrl(emailUrl)}
                    style={styles.calendarBtn}
                  />
                ) : null}
                {mapUrl ? (
                  <Button
                    title="Directions"
                    variant="outline"
                    size="sm"
                    icon="navigate-outline"
                    onPress={() => void openExternalUrl(mapUrl)}
                    style={styles.calendarBtn}
                  />
                ) : null}
              </View>
            ) : null}
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
  calendarCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  calendarTitle: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  calendarHint: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  calendarActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  calendarBtn: {
    flex: 1,
  },
  parishTapHint: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  contactActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
