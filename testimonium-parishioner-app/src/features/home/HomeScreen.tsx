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
import { AppHeader, Badge, BadgeVariant, Button, Card, IconButton, SectionHeader } from "@/components/ui";
import { UpcomingEventsSection } from "@/features/events/UpcomingEventsSection";
import { useCurrentMonthEvents } from "@/features/events/api";
import { useUnreadNotificationCount } from "@/features/notifications/api";
import { useRequestList } from "@/features/requests/api";
import { useScheduleList } from "@/features/schedule/api";
import { useAuth } from "@/providers/AuthProvider";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { profile, isRegistrationSession } = useAuth();
  const { requireCompleteProfile } = useRequireCompleteProfile();

  const { isFetching: isEventsFetching, refetch: refetchEvents } = useCurrentMonthEvents();
  const { data: requestsData, isFetching: isRequestsFetching, refetch: refetchRequests } = useRequestList({ limit: 3 });
  const { data: scheduleData, isFetching: isScheduleFetching, refetch: refetchSchedule } = useScheduleList("upcoming");
  const unreadNotificationsCount = useUnreadNotificationCount();

  const isRefreshing = isEventsFetching || isRequestsFetching || isScheduleFetching;

  const handleRefresh = async () => {
    await Promise.all([
      refetchEvents(),
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

  const recentRequests = requestsData?.data || [];
  const upcomingAppointments = Array.isArray(scheduleData) ? scheduleData.slice(0, 2) : [];

  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case "COMPLETED":
      case "READY_FOR_PICKUP":
      case "CONFIRMED":
      case "APPROVED":
        return "success";
      case "PENDING":
      case "PAYMENT_PENDING":
      case "REQUESTED":
        return "warning";
      case "UNDER_REVIEW":
      case "PROCESSING":
      case "PAYMENT_UNDER_REVIEW":
      case "PAYMENT_VERIFIED":
        return "info";
      case "NEEDS_CORRECTION":
      case "PROPOSED":
        return "correction";
      case "REJECTED":
      case "CANCELLED":
      case "DECLINED":
        return "danger";
      default:
        return "neutral";
    }
  };

  const formatStatusLabel = (status: string): string => {
    return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

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
        contentContainerStyle={styles.scrollContent}
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
        {/* Greeting Banner */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>ROMAN CATHOLIC DIOCESE OF SAN CARLOS</Text>
          </View>

          <Text style={styles.greetingTitle} allowFontScaling>
            {isRegistrationSession
              ? validFirstName ? `Welcome, ${validFirstName}!` : "Welcome!"
              : validFirstName ? `Welcome back, ${validFirstName}!` : "Welcome back!"}
          </Text>
          <Text style={styles.bannerCopy} allowFontScaling>
            Access sacramental records, schedule canonical appointments, and track certificate requests across the diocese.
          </Text>

          <View style={styles.bannerActionRow}>
            <Button
              title="Request Document"
              size="sm"
              onPress={() => requireCompleteProfile(() => router.push("/(app)/requests/new" as any))}
              style={styles.bannerBtn}
            />
            <Button
              title="Schedule Appointment"
              size="sm"
              variant="secondary"
              onPress={() => requireCompleteProfile(() => router.push("/(app)/schedule/new" as any))}
              style={styles.bannerBtn}
            />
          </View>

          {profile?.needsProfileCompletion && (
            <View style={styles.profileReminderContainer}>
              <View style={styles.profileReminderContent}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.profileReminderText} allowFontScaling>
                  Complete your profile to access document and schedule requests.
                </Text>
              </View>
              <Button
                title="Complete Profile"
                size="sm"
                variant="outline"
                onPress={() => router.push("/(app)/(tabs)/profile" as any)}
                style={styles.profileReminderBtn}
              />
            </View>
          )}
        </Card>

        {/* Ask Caloy Entry Card */}
        <Pressable
          onPress={() => router.push("/(app)/caloy" as any)}
          accessibilityRole="button"
          accessibilityLabel="Ask Caloy, TESTIMONIUM virtual assistant. Need help with requests, schedules, requirements, parish information, or other questions?"
          accessibilityHint="Navigates to full-screen Caloy chat"
          style={({ pressed }) => [styles.caloyCard, pressed && styles.caloyCardPressed]}
        >
          <View style={styles.caloyCardContent}>
            <View style={styles.caloyIconCircle}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <View style={styles.caloyTextContainer}>
              <View style={styles.caloyTitleRow}>
                <Text style={styles.caloyTitle} allowFontScaling>
                  Ask Caloy
                </Text>
                <View style={styles.caloyBadge}>
                  <Text style={styles.caloyBadgeText}>AI ASSISTANT</Text>
                </View>
              </View>
              <Text style={styles.caloySubtitle} allowFontScaling>
                Need help with requests, schedules, requirements, parish information, or other TESTIMONIUM questions?
              </Text>
            </View>
          </View>
          <View style={styles.caloyFooter}>
            <Text style={styles.caloyActionText} allowFontScaling>
              Chat with Caloy
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>

        {/* Quick Access Grid (6 Services in 2-Column Responsive Flex Rows) */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Quick Access Services"
            subtitle="Frequently used diocesan services"
          />

          <View style={styles.grid}>
            {/* Row 1 */}
            <View style={styles.gridRow}>
              {/* 1. Request Document */}
              <Pressable
                onPress={() => requireCompleteProfile(() => router.push("/(app)/requests/new" as any))}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Request Document"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>Request Document</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Certificates & records
                </Text>
              </Pressable>

              {/* 2. Track Request */}
              <Pressable
                onPress={() => router.push("/(app)/(tabs)/(requests)" as any)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Track Request"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.infoSoft }]}>
                  <Ionicons name="search-outline" size={22} color={colors.info} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>Track Request</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Real-time status updates
                </Text>
              </Pressable>
            </View>

            {/* Row 2 */}
            <View style={styles.gridRow}>
              {/* 3. Schedule Appointment */}
              <Pressable
                onPress={() => requireCompleteProfile(() => router.push("/(app)/schedule/new" as any))}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Schedule Appointment"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.success} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>Schedule Appointment</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Masses, blessings & interviews
                </Text>
              </Pressable>

              {/* 4. Parish Directory */}
              <Pressable
                onPress={() => router.push("/(app)/(tabs)/(parishes)" as any)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Parish Directory"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.warningSoft }]}>
                  <Ionicons name="business-outline" size={22} color={colors.warning} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>Parish Directory</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Offices, hours & contact info
                </Text>
              </Pressable>
            </View>

            {/* Row 3 */}
            <View style={styles.gridRow}>
              {/* 5. Notifications */}
              <Pressable
                onPress={() => router.push("/notifications" as any)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>Notifications</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Alerts & official notices
                </Text>
              </Pressable>

              {/* 6. My Profile */}
              <Pressable
                onPress={() => router.push("/(app)/(tabs)/(profile)" as any)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
                accessibilityRole="button"
                accessibilityLabel="My Profile"
              >
                <View style={[styles.gridIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name="person-outline" size={22} color={colors.textPrimary} />
                </View>
                <Text style={styles.gridTitle} allowFontScaling>My Profile</Text>
                <Text style={styles.gridSubtitle} numberOfLines={2} allowFontScaling>
                  Contact & account details
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Recent Document Requests Summary */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Recent Document Requests"
            actionLabel="View All"
            onAction={() => router.push("/(app)/(tabs)/(requests)" as any)}
          />

          {recentRequests.length > 0 ? (
            <View style={styles.cardStack}>
              {recentRequests.map((req) => (
                <Pressable
                  key={req.id}
                  onPress={() => router.push(`/(app)/requests/${req.id}` as any)}
                  style={({ pressed }) => [styles.itemCard, pressed && styles.itemCardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Request ${req.trackingNumber || req.id}`}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle} numberOfLines={1} allowFontScaling>
                      {req.documentType ? req.documentType.replace(/_/g, " ") : "Certificate Request"}
                    </Text>
                    <Badge
                      label={formatStatusLabel(req.status)}
                      variant={getStatusBadgeVariant(req.status)}
                      size="sm"
                    />
                  </View>
                  <Text style={styles.itemTracking} allowFontScaling>
                    Tracking #: {req.trackingNumber || `REQ-${req.id}`}
                  </Text>
                  {req.parish?.parishName && (
                    <Text style={styles.itemMeta} numberOfLines={1} allowFontScaling>
                      Parish: {req.parish.parishName}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Card variant="muted" style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={24} color={colors.textSecondary} />
              <Text style={styles.emptyCardText} allowFontScaling>
                No active document requests.
              </Text>
              <Button
                title="Start a Request"
                size="sm"
                variant="outline"
                onPress={() => requireCompleteProfile(() => router.push("/(app)/requests/new" as any))}
              />
            </Card>
          )}
        </View>

        {/* Upcoming Appointments Summary */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Upcoming Appointments"
            actionLabel="View Schedule"
            onAction={() => router.push("/(app)/(tabs)/(schedule)" as any)}
          />

          {upcomingAppointments.length > 0 ? (
            <View style={styles.cardStack}>
              {upcomingAppointments.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/(app)/schedule/${item.id}` as any)}
                  style={({ pressed }) => [styles.itemCard, pressed && styles.itemCardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Appointment ${item.displayTitle || item.eventType}`}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle} numberOfLines={1} allowFontScaling>
                      {item.displayTitle || item.eventType.replace(/_/g, " ")}
                    </Text>
                    <Badge
                      label={formatStatusLabel(item.status)}
                      variant={getStatusBadgeVariant(item.status)}
                      size="sm"
                    />
                  </View>
                  <View style={styles.itemRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.itemMeta} allowFontScaling>
                      {item.requestedDate}
                    </Text>
                  </View>
                  {item.parish?.parishName && (
                    <Text style={styles.itemMeta} numberOfLines={1} allowFontScaling>
                      Parish: {item.parish.parishName}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <Card variant="muted" style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
              <Text style={styles.emptyCardText} allowFontScaling>
                No upcoming canonical appointments scheduled.
              </Text>
              <Button
                title="Book Appointment"
                size="sm"
                variant="outline"
                onPress={() => requireCompleteProfile(() => router.push("/(app)/schedule/new" as any))}
              />
            </Card>
          )}
        </View>

        {/* Upcoming Events Preview */}
        <UpcomingEventsSection
          limit={3}
          title="Upcoming This Month"
          subtitle="Public masses and community events"
          onParishPress={(parishId) => router.push(`/parishes/${parishId}` as any)}
        />

        {/* Parish Directory Discovery Card */}
        <Pressable
          onPress={() => router.push("/(app)/(tabs)/(parishes)" as any)}
          accessibilityRole="button"
          accessibilityLabel="Explore Parish Directory. Browse parishes across the Diocese of San Carlos"
          accessibilityHint="Navigates to the Parish Directory tab"
          style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconCircle}>
              <Ionicons
                name="business-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle} allowFontScaling>
                Parish Directory
              </Text>
              <Text style={styles.heroSubtitle} allowFontScaling>
                Browse parishes, patron saints, office hours, and contact details across the diocese.
              </Text>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroActionText} allowFontScaling>
              Explore Parishes
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>
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
    padding: spacing.md,
    paddingBottom: spacing.xxl + 80,
    gap: spacing.lg,
  },
  bannerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  bannerBadgeText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  greetingTitle: {
    ...fontStyles.title,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  bannerCopy: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  bannerActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  bannerBtn: {
    flex: 1,
  },
  sectionContainer: {
    gap: spacing.xs,
  },
  grid: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  gridCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  gridIconCircle: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  gridTitle: {
    ...fontStyles.captionBold,
    color: colors.textPrimary,
  },
  gridSubtitle: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  cardStack: {
    gap: spacing.xs,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  itemCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  itemTitle: {
    ...fontStyles.captionBold,
    color: colors.textPrimary,
    flex: 1,
    textTransform: "capitalize",
  },
  itemTracking: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  itemMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyCardText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  heroCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  heroSubtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  heroActionText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    marginRight: spacing.xxs,
  },
  profileReminderContainer: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    gap: spacing.xs,
  },
  profileReminderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  profileReminderText: {
    ...fontStyles.bodySmall,
    color: colors.surface,
    flex: 1,
    fontWeight: "500",
  },
  profileReminderBtn: {
    alignSelf: "flex-end",
    backgroundColor: colors.surface,
  },
  caloyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  caloyCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  caloyCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  caloyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  caloyTextContainer: {
    flex: 1,
  },
  caloyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  caloyTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
  },
  caloyBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  caloyBadgeText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  caloySubtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  caloyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  caloyActionText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
    marginRight: spacing.xxs,
  },
});
