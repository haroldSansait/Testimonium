import React from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, Button, EmptyState, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "./api";
import type { NotificationItem } from "./types";

export const NotificationListScreen: React.FC = () => {
  const router = useRouter();

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
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.isRead;
    const iconName =
      item.referenceType === "DOCUMENT_REQUEST"
        ? "document-text"
        : item.referenceType === "SCHEDULE_REQUEST"
        ? "calendar"
        : "notifications";

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${isUnread ? "Unread" : "Read"}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, isUnread && styles.unreadIconBox]}>
            <Ionicons
              name={iconName}
              size={18}
              color={isUnread ? colors.primary : colors.textMuted}
            />
          </View>

          <View style={styles.headerTextCol}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, isUnread && styles.unreadTitle]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.timestamp}>
              {formatTimestamp(item.dateSent || item.createdAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>

        {(item.referenceType === "DOCUMENT_REQUEST" || item.referenceType === "SCHEDULE_REQUEST") && item.referenceId ? (
          <View style={styles.actionPrompt}>
            <Text style={styles.actionPromptText}>
              {item.referenceType === "DOCUMENT_REQUEST"
                ? "View Document Request"
                : "View Schedule"}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        ) : null}
      </TouchableOpacity>
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
        onBack={handleBack}
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
          <Skeleton height={90} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={90} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={90} borderRadius={radii.md} style={styles.skeleton} />
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
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeleton: {
    marginBottom: spacing.xs,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  unreadCard: {
    borderColor: colors.primary + "35",
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadIconBox: {
    backgroundColor: colors.primarySoft,
  },
  headerTextCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...fontStyles.body,
    fontWeight: "500",
    color: colors.textPrimary,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  timestamp: {
    ...fontStyles.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  message: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  actionPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionPromptText: {
    ...fontStyles.caption,
    fontWeight: "600",
    color: colors.primary,
  },
});
