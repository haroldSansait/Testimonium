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
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { EventBannerCarousel } from "@/features/events/components/EventBannerCarousel";
import { parseEventDateOnly } from "@/features/events/presentation";
import { useUnreadNotificationCount } from "@/features/notifications/api";
import { useRequestList } from "@/features/requests/api";
import { formatDocumentType, formatStatus } from "@/features/requests/presentation";
import { useScheduleList } from "@/features/schedule/api";
import { getScheduleStatusBadge } from "@/features/schedule/presentation";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, shadows, spacing } from "@/theme/tokens";

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
      {/* App Header with Branded TESTIMONIUM Wordmark and Notification Badge */}
      <AppHeader
        title="TESTIMONIUM"
        titleStyle={styles.brandTitle}
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
          {/* Maroon Welcome Banner matching Web Portal */}
          <View style={styles.welcomeBanner}>
            <Text style={styles.dioceseTag} allowFontScaling>
              DIOCESE OF SAN CARLOS • VICARIATE OF CANLAON
            </Text>
            <Text style={styles.greetingTitle} allowFontScaling>
              {greetingTitle}
            </Text>
            <Text style={styles.greetingSubtitle} allowFontScaling>
              Manage document requests, schedule canonical appointments, and explore parish records across the Vicariate of Canlaon.
            </Text>

            {profile?.needsProfileCompletion && (
              <View style={styles.profileReminder}>
                <View style={styles.profileReminderTextWrap}>
                  <Ionicons name="alert-circle" size={18} color="#FDE68A" />
                  <Text style={styles.profileReminderText} allowFontScaling>
                    Complete your profile to access all services.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Complete"
                  onPress={() => router.push("/(app)/profile/edit" as any)}
                  style={({ pressed }) => [
                    styles.profileReminderBtn,
                    pressed && styles.profileReminderBtnPressed,
                  ]}
                >
                  <Text style={styles.profileReminderBtnText} allowFontScaling>
                    Complete
                  </Text>
                </Pressable>
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
                  const docTitle = formatDocumentType(req.documentType);
                  const statusInfo = formatStatus(req.status, req.isDraft);
                  const tracking = req.trackingNumber || `REQ-${req.id}`;
                  const parishName = req.parish?.parishName;

                  return (
                    <ListRow
                      key={req.id}
                      title={docTitle}
                      subtitle={`Tracking: ${tracking}${parishName ? ` • ${parishName}` : ""}`}
                      trailing={<StatusLabel status={req.isDraft ? "DRAFT" : req.status} />}
                      showDivider={idx < recentRequests.length - 1}
                      onPress={() => router.push(`/(app)/requests/${req.id}` as any)}
                      accessibilityLabel={`Request ${docTitle}, tracking ${tracking}, status: ${statusInfo.label}`}
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
                  const statusInfo = getScheduleStatusBadge(item.status);

                  return (
                    <ListRow
                      key={item.id}
                      title={title}
                      subtitle={`${dateStr}${parishName ? ` • ${parishName}` : ""}`}
                      trailing={<StatusLabel status={item.status} />}
                      showDivider={idx < upcomingAppointments.length - 1}
                      onPress={() => router.push(`/(app)/schedule/${item.id}` as any)}
                      accessibilityLabel={`Appointment ${title} on ${dateStr}, status: ${statusInfo.label}`}
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
  brandTitle: {
    ...fontStyles.titleSerif,
    color: colors.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: 0.8,
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
  welcomeBanner: {
    backgroundColor: "#6B0F1A",
    borderColor: "#4A0A12",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs + 2,
    ...shadows.md,
  },
  dioceseTag: {
    ...fontStyles.meta,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 11,
    lineHeight: 15,
  },
  greetingTitle: {
    ...fontStyles.titleSerif,
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
  },
  greetingSubtitle: {
    ...fontStyles.bodySmall,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 19,
  },
  profileReminder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: radii.sm,
    padding: spacing.sm + 2,
    marginTop: spacing.xs,
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  profileReminderTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flex: 1,
    minWidth: 180,
  },
  profileReminderText: {
    ...fontStyles.caption,
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "500",
    flex: 1,
  },
  profileReminderBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.button,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  profileReminderBtnPressed: {
    opacity: 0.9,
  },
  profileReminderBtnText: {
    ...fontStyles.captionBold,
    color: "#6B0F1A",
    fontSize: 12,
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
