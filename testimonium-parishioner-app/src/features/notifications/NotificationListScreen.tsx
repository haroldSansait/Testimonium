import React, { useMemo } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { AppHeader, Button, EmptyState, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "./api";
import type { NotificationItem } from "./types";

export interface NotificationListScreenProps {
  showBackButton?: boolean;
}

export interface NotificationGroup {
  title: "Today" | "Yesterday" | "Earlier";
  data: NotificationItem[];
}

export const getManilaDateKey = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const previousCalendarDateKey = (dateKey: string): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(previous.getUTCDate()).padStart(2, "0")}`;
};

export const groupNotificationsByManilaDate = (
  notifications: NotificationItem[],
  now: Date = new Date()
): NotificationGroup[] => {
  if (notifications.length === 0) return [];

  const todayDate = getManilaDateKey(now);
  const yesterdayDate = previousCalendarDateKey(todayDate);
  const todayItems: NotificationItem[] = [];
  const yesterdayItems: NotificationItem[] = [];
  const earlierItems: NotificationItem[] = [];

  for (const item of notifications) {
    const date = new Date(item.dateSent || item.createdAt);
    const dateKey = !isNaN(date.getTime()) ? getManilaDateKey(date) : "";
    if (dateKey === todayDate) {
      todayItems.push(item);
    } else if (dateKey === yesterdayDate) {
      yesterdayItems.push(item);
    } else {
      earlierItems.push(item);
    }
  }

  const groups: NotificationGroup[] = [];
  if (todayItems.length > 0) groups.push({ title: "Today", data: todayItems });
  if (yesterdayItems.length > 0) {
    groups.push({ title: "Yesterday", data: yesterdayItems });
  }
  if (earlierItems.length > 0) groups.push({ title: "Earlier", data: earlierItems });
  return groups;
};

export const NotificationListScreen: React.FC<NotificationListScreenProps> = ({
  showBackButton = true,
}) => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();

  const {
    data: notifications = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useNotifications();

  const unreadCount = useUnreadNotificationCount();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(home)" as any);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }

    if (item.referenceType === "DOCUMENT_REQUEST" && item.referenceId) {
      router.push(`/(app)/requests/${item.referenceId}` as any);
    } else if (item.referenceType === "SCHEDULE_REQUEST" && item.referenceId) {
      router.push(`/(app)/schedule/${item.referenceId}` as any);
    } else {
      Alert.alert(item.title, item.message);
    }
  };

  const formatTimestamp = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group notifications chronologically into Today, Yesterday, Earlier
  const groupedSections = useMemo(
    () => groupNotificationsByManilaDate(notifications),
    [notifications]
  );

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.isRead;
    const iconName =
      item.referenceType === "DOCUMENT_REQUEST"
        ? "document-text-outline"
        : item.referenceType === "SCHEDULE_REQUEST"
        ? "calendar-outline"
        : "notifications-outline";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          isUnread && styles.unreadRow,
          pressed && styles.pressedRow,
        ]}
        onPress={() => handleNotificationPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${isUnread ? "Unread" : "Read"}`}
      >
        <View style={styles.iconCol}>
          <Ionicons
            name={iconName}
            size={20}
            color={isUnread ? colors.primary : colors.textSecondary}
          />
        </View>

        <View style={styles.contentCol}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextContainer}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text
                style={[styles.title, isUnread && styles.unreadTitle]}
                numberOfLines={2}
                allowFontScaling
              >
                {item.title}
              </Text>
            </View>
            <Text style={styles.timestamp} allowFontScaling>
              {formatTimestamp(item.dateSent || item.createdAt)}
            </Text>
          </View>

          <Text style={styles.message} numberOfLines={4} allowFontScaling>
            {item.message}
          </Text>

          {(item.referenceType === "DOCUMENT_REQUEST" ||
            item.referenceType === "SCHEDULE_REQUEST") &&
          item.referenceId ? (
            <View style={styles.actionPrompt}>
              <Text style={styles.actionPromptText} allowFontScaling>
                {item.referenceType === "DOCUMENT_REQUEST"
                  ? "View Request Details"
                  : "View Schedule Details"}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : undefined
        }
        onBack={showBackButton ? handleBack : undefined}
        rightAction={
          unreadCount > 0 ? (
            <Button
              title="Mark all read"
              variant="outline"
              size="sm"
              loading={markAllReadMutation.isPending}
              onPress={handleMarkAllRead}
              accessibilityLabel="Mark all notifications as read"
            />
          ) : undefined
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={64} borderRadius={radii.xs} style={styles.skeleton} />
          <Skeleton height={64} borderRadius={radii.xs} style={styles.skeleton} />
          <Skeleton height={64} borderRadius={radii.xs} style={styles.skeleton} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Failed to Load Notifications"
            description="Unable to load your notifications. Please check your network connection."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </View>
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionHeaderText} allowFontScaling>
                {title}
              </Text>
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: contentBottomInset() },
          ]}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="notifications-outline"
                title="No Notifications"
                description="You're all caught up! Updates regarding your document requests and schedules will appear here."
              />
            </View>
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeleton: {
    marginBottom: spacing.xxs,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyContainer: {
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
  sectionHeaderBox: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  sectionHeaderText: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  unreadRow: {
    backgroundColor: colors.surface,
  },
  pressedRow: {
    backgroundColor: colors.surfaceVariant,
  },
  iconCol: {
    width: 28,
    marginTop: 2,
    alignItems: "center",
  },
  contentCol: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  titleTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: spacing.xs,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  title: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
    fontSize: 14,
  },
  unreadTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  timestamp: {
    ...fontStyles.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  message: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  actionPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  actionPromptText: {
    ...fontStyles.caption,
    fontWeight: "600",
    color: colors.primary,
  },
});
