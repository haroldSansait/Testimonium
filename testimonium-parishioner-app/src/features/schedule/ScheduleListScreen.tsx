import React, { useState } from "react";
import {
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
import { useScheduleList } from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
} from "./presentation";
import { getScheduleEventLabel, type ScheduleItem } from "./types";

type ScopeTab = "upcoming" | "history";

export const ScheduleListScreen: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ScopeTab>("upcoming");

  const {
    data: schedules = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useScheduleList(activeTab);

  const handleStartBooking = () => {
    router.push("/(app)/schedule/new" as any);
  };

  const handleSchedulePress = (item: ScheduleItem) => {
    router.push(`/(app)/schedule/${item.id}` as any);
  };

  const renderScheduleCard = ({ item }: { item: ScheduleItem }) => {
    const badge = getScheduleStatusBadge(item.status);
    const hasProposal = isRescheduleProposalPending(item.status);
    const eventLabel = getScheduleEventLabel(item.eventType);
    const dateFormatted = formatScheduleDate(item.requestedDate, "short");
    const timeSlot = extractTimeSlotFromSchedule(item);

    return (
      <TouchableOpacity
        style={[styles.card, hasProposal && styles.cardHighlight]}
        onPress={() => handleSchedulePress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${eventLabel} at ${item.parish?.parishName || "Parish"}, status ${badge.label}`}
      >
        {hasProposal && (
          <View style={styles.proposalBanner}>
            <Ionicons name="alert-circle" size={16} color="#1E40AF" />
            <Text style={styles.proposalBannerText}>
              Reschedule Proposed by Parish Staff
            </Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {item.displayTitle || eventLabel}
            </Text>
            {item.displayTitle && item.displayTitle !== eventLabel && (
              <Text style={styles.eventSubtitle}>{eventLabel}</Text>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.statusText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.parish?.parishName || "Parish"}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText}>{dateFormatted}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={15} color={colors.textMuted} />
            <Text style={styles.metaText}>{timeSlot}</Text>
          </View>
        </View>

        {item.assignedPriest?.fullName && (
          <View style={styles.priestRow}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={styles.priestText} numberOfLines={1}>
              Priest: {item.assignedPriest.fullName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule"
        subtitle="Sacraments, Masses & Blessings"
        rightAction={
          <Button
            title="New"
            size="sm"
            variant="primary"
            icon="add"
            onPress={handleStartBooking}
            accessibilityLabel="New schedule request"
          />
        }
      />

      {/* Scope Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "upcoming" && styles.activeTab]}
          onPress={() => setActiveTab("upcoming")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.activeTabText,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => setActiveTab("history")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Body */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={110} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={110} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={110} borderRadius={radii.md} style={styles.skeleton} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Failed to Load Schedule"
            description="Unable to connect to the server. Please check your network and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderScheduleCard}
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
                icon="calendar-outline"
                title={
                  activeTab === "upcoming"
                    ? "No Upcoming Schedules"
                    : "No Schedule History"
                }
                description={
                  activeTab === "upcoming"
                    ? "You have no upcoming schedules. Schedule a sacrament or mass intention."
                    : "Your completed and past schedules will appear here."
                }
                actionLabel={activeTab === "upcoming" ? "New Schedule" : undefined}
                onAction={activeTab === "upcoming" ? handleStartBooking : undefined}
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
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  activeTab: {
    backgroundColor: colors.primarySoft,
  },
  tabText: {
    ...fontStyles.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: "700",
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  loadingContainer: {
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
  emptyContainer: {
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHighlight: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC",
  },
  proposalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#EFF6FF",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.xs,
    marginBottom: spacing.sm,
  },
  proposalBannerText: {
    ...fontStyles.caption,
    fontSize: 12,
    fontWeight: "700",
    color: "#1E40AF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  eventTitle: {
    ...fontStyles.subheading,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  eventSubtitle: {
    ...fontStyles.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  priestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  priestText: {
    ...fontStyles.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
