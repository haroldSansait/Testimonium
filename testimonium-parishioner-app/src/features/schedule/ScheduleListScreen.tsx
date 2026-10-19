import { useScreenRefresh, useManualRefresh } from "@/hooks/useAutomaticRefresh";
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
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { Divider } from "@/components/ui/Divider";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import { useScheduleList } from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
  getScheduleDisplayTitle,
} from "./presentation";
import { getScheduleEventLabel, type ScheduleItem } from "./types";

type ScopeTab = "upcoming" | "history";

export const ScheduleListScreen: React.FC = () => {
  const router = useRouter();
  const refreshOptions = useScreenRefresh();
  const { requireCompleteProfile } = useRequireCompleteProfile();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [activeTab, setActiveTab] = useState<ScopeTab>("upcoming");

  const {
    data: scheduleData,
    isLoading,
    error,
    refetch,
  } = useScheduleList(activeTab, refreshOptions);
  const { refreshing, onRefresh } = useManualRefresh(() => refetch({ cancelRefetch: false }));

  const schedules = scheduleData ?? [];

  const handleStartBooking = () => {
    requireCompleteProfile(() => {
      router.push("/(app)/schedule/new" as any);
    });
  };

  const handleSchedulePress = (item: ScheduleItem) => {
    router.push(`/(app)/schedule/${item.id}` as any);
  };

  const renderScheduleItem = ({ item, index }: { item: ScheduleItem; index: number }) => {
    const hasProposal = isRescheduleProposalPending(item.status);
    const eventLabel = getScheduleEventLabel(item.eventType);
    const dateFormatted = formatScheduleDate(item.requestedDate, "short");
    const timeSlot = extractTimeSlotFromSchedule(item);
    const statusLabel = getScheduleStatusBadge(item.status).label;

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[styles.itemRow, hasProposal && styles.itemRowHighlight]}
          onPress={() => handleSchedulePress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${eventLabel} at ${item.parish?.parishName || "Parish"}, status: ${statusLabel}`}
        >
          {hasProposal && (
            <View style={styles.proposalBanner}>
              <Ionicons name="alert-circle" size={14} color={colors.primary} />
              <Text style={styles.proposalBannerText} allowFontScaling>
                Alternative Date Proposed by Parish Staff
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          )}

          <View style={styles.rowHeader}>
            <View style={styles.titleWrap}>
              <Text style={styles.eventTitle} numberOfLines={1} allowFontScaling>
                {getScheduleDisplayTitle(item)}
              </Text>
              {getScheduleDisplayTitle(item) !== eventLabel ? (
                <Text style={styles.eventSubtitle} numberOfLines={1} allowFontScaling>
                  {eventLabel}
                </Text>
              ) : null}
            </View>
            <StatusLabel status={item.status} />
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1} allowFontScaling>
              {item.parish?.parishName || "Parish"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText} allowFontScaling>
                {dateFormatted}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText} allowFontScaling>
                {timeSlot}
              </Text>
            </View>
          </View>

          {item.assignedPriest?.fullName ? (
            <View style={styles.priestRow}>
              <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.priestText} numberOfLines={1} allowFontScaling>
                Celebrant: {item.assignedPriest.fullName}
              </Text>
            </View>
          ) : item.layMinisterAssigned ? (
            <View style={styles.priestRow}>
              <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.priestText} allowFontScaling>Leader: Lay Minister</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {index < schedules.length - 1 ? <Divider /> : null}
      </View>
    );
  };

  const bottomInset = contentBottomInset("none");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule"
        subtitle="Sacraments, Masses & Blessings"
        rightAction={
          <Button
            title="Book Schedule"
            size="sm"
            variant="primary"
            icon="add"
            onPress={handleStartBooking}
            accessibilityLabel="New schedule request"
          />
        }
      />

      <ContentColumn style={styles.contentColumn}>
        {/* Scope Filter Segment */}
        <View style={styles.filterBar}>
          <SegmentedControl<ScopeTab>
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "history", label: "History" },
            ]}
            selectedValue={activeTab}
            onSelect={setActiveTab}
          />
        </View>

        {/* Content Body */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={90} borderRadius={radii.sm} />
            <Skeleton height={90} borderRadius={radii.sm} />
            <Skeleton height={90} borderRadius={radii.sm} />
          </View>
        ) : error && !scheduleData ? (
          <View style={styles.errorContainer}>
            <EmptyState
              icon="alert-circle-outline"
              title="Failed to Load Schedule"
              description="Unable to connect to the server. Please check your network and try again."
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          </View>
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduleItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + spacing.lg }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
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
      </ContentColumn>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentColumn: {
    flex: 1,
  },
  filterBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    flexGrow: 1,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  errorContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
  },
  itemRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  itemRowHighlight: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  proposalBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.sm,
    gap: 6,
    marginBottom: 2,
  },
  proposalBannerText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleWrap: {
    flex: 1,
  },
  eventTitle: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  eventSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  infoText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  priestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priestText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
});
