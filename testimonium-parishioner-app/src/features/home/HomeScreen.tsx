import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { Divider } from "@/components/ui/Divider";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { Button } from "@/components/ui/Button";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { EventBannerCarousel } from "@/features/events/components/EventBannerCarousel";
import { parseEventDateOnly } from "@/features/events/presentation";
import { useUnreadNotificationCount } from "@/features/notifications/api";
import { useRequestList } from "@/features/requests/api";
import { useScheduleList } from "@/features/schedule/api";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { profile, isRegistrationSession } = useAuth();
  const { contentBottomInset } = useAppLayoutMetrics();

  const { data: requestsData, isFetching: isRequestsFetching, refetch: refetchRequests } = useRequestList({ limit: 3 });
  const { data: scheduleData, isFetching: isScheduleFetching, refetch: refetchSchedule } = useScheduleList("upcoming");
  const unreadNotificationsCount = useUnreadNotificationCount();

  const isRefreshing = isRequestsFetching || isScheduleFetching;

  const handleRefresh = async () => {
    await Promise.all([
      refetchRequests(),
      refetchSchedule(),
    ]);
  };

  const firstName = profile?.fullName
    ? profile.fullName.trim().split(/\s+/)[0]
    : "";
  const validFirstName =
    firstName &&
    firstName.toLowerCase() !== "undefined" &&
    firstName.toLowerCase() !== "null"
      ? firstName
      : "";

  const greetingTitle = isRegistrationSession
    ? validFirstName ? `Welcome, ${validFirstName}!` : "Welcome!"
    : validFirstName ? `Welcome back, ${validFirstName}!` : "Welcome back!";

  const recentRequests = requestsData?.data || [];
  const upcomingAppointments = Array.isArray(scheduleData) ? scheduleData.slice(0, 2) : [];

  const bottomPadding = contentBottomInset("tab");

  return (
    <Screen safeArea={true} style={styles.screen}>
      {/* App Header with Notification Badge */}
      <AppHeader
        title="TESTIMONIUM"
        subtitle="Diocese of San Carlos"
        rightAction={
          <View style={styles.bellContainer}>
            <IconButton
              onPress={() => router.push("/notifications" as any)}
              accessibilityLabel={`Notifications${unreadNotificationsCount > 0 ? `, ${unreadNotificationsCount} unread` : ""}`}
              accessibilityHint="Opens notifications screen"
              size={44}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={colors.primary}
              />
            </IconButton>
            {unreadNotificationsCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <ContentColumn style={styles.column}>
          {/* Greeting Banner */}
          <View style={styles.greetingHeader}>
            <Text style={styles.dioceseTag} allowFontScaling>
              DIOCESE OF SAN CARLOS
            </Text>
            <Text style={styles.greetingTitle} allowFontScaling>
              {greetingTitle}
            </Text>
            <Text style={styles.greetingSubtitle} allowFontScaling>
              Canonical services and sacramental document records.
            </Text>

            {profile?.needsProfileCompletion && (
              <View style={styles.profileReminder}>
                <View style={styles.profileReminderTextWrap}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.profileReminderText} allowFontScaling>
                    Complete your profile to access all services.
                  </Text>
                </View>
                <Button
                  title="Complete"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push("/(app)/profile/edit" as any)}
                />
              </View>
            )}
          </View>

          {/* Three-Day Events Carousel */}
          <EventBannerCarousel
            onEventPress={(event) => {
              const { year, month } = parseEventDateOnly(event.eventDate);
              router.push({
                pathname: "/(app)/events/[id]" as any,
                params: {
                  id: String(event.id),
                  year: String(year),
                  month: String(month),
                },
              });
            }}
            onViewAllPress={() => router.push("/(app)/events" as any)}
          />

          <Divider />

          {/* Recent Document Requests (Flat Divided Rows) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle} allowFontScaling>
                  Document Activity
                </Text>
                <Text style={styles.sectionSubtitle} allowFontScaling>
                  Recent certificate requests
                </Text>
              </View>
              {recentRequests.length > 0 && (
                <Pressable
                  onPress={() => router.push("/(app)/(tabs)/(requests)" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="View all document requests"
                  hitSlop={8}
                >
                  <Text style={styles.sectionLink} allowFontScaling>
                    View All
                  </Text>
                </Pressable>
              )}
            </View>

            {recentRequests.length > 0 ? (
              <View style={styles.rowsContainer}>
                {recentRequests.map((req, idx) => {
                  const docTitle = req.documentType
                    ? req.documentType.replace(/_/g, " ")
                    : "Certificate Request";
                  const tracking = req.trackingNumber || `REQ-${req.id}`;
                  const parishName = req.parish?.parishName;

                  return (
                    <ListRow
                      key={req.id}
                      title={docTitle}
                      subtitle={`Tracking: ${tracking}${parishName ? ` • ${parishName}` : ""}`}
                      trailing={<StatusLabel status={req.status} />}
                      showDivider={idx < recentRequests.length - 1}
                      onPress={() => router.push(`/(app)/requests/${req.id}` as any)}
                      accessibilityLabel={`Request ${docTitle}, tracking ${tracking}`}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyActivityRow}>
                <Text style={styles.emptyText} allowFontScaling>
                  No recent document requests.
                </Text>
              </View>
            )}
          </View>

          <Divider />

          {/* Upcoming Schedule Activity (Flat Divided Rows) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle} allowFontScaling>
                  Appointments
                </Text>
                <Text style={styles.sectionSubtitle} allowFontScaling>
                  Scheduled services & blessings
                </Text>
              </View>
              {upcomingAppointments.length > 0 && (
                <Pressable
                  onPress={() => router.push("/(app)/(tabs)/(schedule)" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="View full schedule"
                  hitSlop={8}
                >
                  <Text style={styles.sectionLink} allowFontScaling>
                    View Schedule
                  </Text>
                </Pressable>
              )}
            </View>

            {upcomingAppointments.length > 0 ? (
              <View style={styles.rowsContainer}>
                {upcomingAppointments.map((item, idx) => {
                  const title = item.displayTitle || item.eventType.replace(/_/g, " ");
                  const dateStr = item.requestedDate;
                  const parishName = item.parish?.parishName;

                  return (
                    <ListRow
                      key={item.id}
                      title={title}
                      subtitle={`${dateStr}${parishName ? ` • ${parishName}` : ""}`}
                      trailing={<StatusLabel status={item.status} />}
                      showDivider={idx < upcomingAppointments.length - 1}
                      onPress={() => router.push(`/(app)/schedule/${item.id}` as any)}
                      accessibilityLabel={`Appointment ${title} on ${dateStr}`}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyActivityRow}>
                <Text style={styles.emptyText} allowFontScaling>
                  No upcoming canonical appointments scheduled.
                </Text>
              </View>
            )}
          </View>

          <Divider />

          {/* Editorial Entries: Caloy & Parish Directory */}
          <View style={styles.discoverySection}>
            <ListRow
              title="Ask Caloy"
              subtitle="Sacramental guidelines, document requirements & parish inquiries"
              leading={
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              }
              showChevron
              showDivider
              onPress={() => router.push("/(app)/(tabs)/(caloy)" as any)}
              accessibilityLabel="Ask Caloy, TESTIMONIUM virtual assistant"
            />

            <ListRow
              title="Parish Directory"
              subtitle="Explore parishes, schedules, and diocesan offices"
              leading={
                <Ionicons name="business-outline" size={20} color={colors.primary} />
              }
              showChevron
              showDivider={false}
              onPress={() => router.push("/(app)/(tabs)/(parishes)" as any)}
              accessibilityLabel="Explore Parish Directory"
            />
          </View>
        </ContentColumn>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  bellContainer: {
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
  },
  column: {
    gap: spacing.lg,
  },
  greetingHeader: {
    paddingHorizontal: spacing.xxs,
    gap: spacing.xxs,
  },
  dioceseTag: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  greetingTitle: {
    ...fontStyles.titleSerif,
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
  },
  greetingSubtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  profileReminder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  profileReminderTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  profileReminderText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  sectionTitle: {
    ...fontStyles.heading,
    fontFamily: fontStyles.titleSerif.fontFamily,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  sectionSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sectionLink: {
    ...fontStyles.captionBold,
    color: colors.primary,
  },
  rowsContainer: {
    backgroundColor: colors.surface,
  },
  emptyActivityRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxs,
  },
  emptyText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  discoverySection: {
    gap: spacing.xxs,
  },
});
