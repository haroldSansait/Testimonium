import { useScreenRefresh, useManualRefresh } from "@/hooks/useAutomaticRefresh";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/Typography";
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
import { isAppError } from "@/services/api/errors";
import {
  mergeSchedulePages,
  useDeleteScheduleDraft,
  useInfiniteScheduleList,
  useScheduleDrafts,
  useScheduleTrackingLookup,
} from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleConfirmationRef,
  formatScheduleDate,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
  isValidScheduleTrackingReference,
  getScheduleDisplayTitle,
  normalizeScheduleTrackingReference,
} from "./presentation";
import {
  getScheduleEventLabel,
  type ScheduleDraftItem,
  type ScheduleItem,
} from "./types";

type ScopeTab = "upcoming" | "history" | "drafts";

export const ScheduleListScreen: React.FC = () => {
  const router = useRouter();
  const refreshOptions = useScreenRefresh();
  const { requireCompleteProfile } = useRequireCompleteProfile();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [activeTab, setActiveTab] = useState<ScopeTab>("upcoming");
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackedSchedule, setTrackedSchedule] = useState<ScheduleItem | null>(null);
  const [deletedDraftIds, setDeletedDraftIds] = useState<Set<number>>(() => new Set());
  const deletingDraftRef = useRef(false);

  const trackingMutation = useScheduleTrackingLookup();
  const deleteDraftMutation =
    typeof useDeleteScheduleDraft === "function"
      ? useDeleteScheduleDraft()
      : { mutateAsync: async () => ({ deleted: true }), isPending: false };

  const draftsQuery =
    typeof useScheduleDrafts === "function"
      ? useScheduleDrafts({ refetchInterval: refreshOptions.refetchInterval })
      : {
          data: [] as ScheduleDraftItem[],
          isLoading: false,
          error: null,
          refetch: async () => ({ data: [] as ScheduleDraftItem[] }),
        };

  const listScope: "upcoming" | "history" = activeTab === "history" ? "history" : "upcoming";
  const {
    data: infiniteData,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteScheduleList(listScope, 20, {
    refetchInterval: refreshOptions.refetchInterval,
  });
  const { refreshing, onRefresh } = useManualRefresh(() =>
    activeTab === "drafts"
      ? draftsQuery.refetch({ cancelRefetch: false } as any)
      : refetch({ cancelRefetch: false })
  );

  const schedules = useMemo(
    () => mergeSchedulePages(infiniteData?.pages),
    [infiniteData?.pages]
  );

  const scheduleDrafts = useMemo(
    () =>
      (draftsQuery.data || []).filter((draft) => !deletedDraftIds.has(draft.id)),
    [draftsQuery.data, deletedDraftIds]
  );

  const handleTrackingSearch = async () => {
    const normalized = normalizeScheduleTrackingReference(trackingQuery);
    if (!normalized) {
      setTrackedSchedule(null);
      setTrackingError(null);
      return;
    }
    if (!isValidScheduleTrackingReference(normalized)) {
      setTrackedSchedule(null);
      setTrackingError(
        normalized.startsWith("SR-")
          ? "SR- references are for document requests. Enter a schedule confirmation (e.g. CONF-2026-0026) or numeric ID."
          : "Enter a confirmation reference (e.g. CONF-2026-0026) or numeric schedule ID."
      );
      return;
    }
    setTrackingError(null);
    try {
      const result = await trackingMutation.mutateAsync(normalized);
      setTrackedSchedule(result);
    } catch (err: unknown) {
      setTrackedSchedule(null);
      const appErr = isAppError(err) ? err : null;
      setTrackingError(
        appErr?.message ||
          "No schedule found for that confirmation number or ID. Verify the reference and try again."
      );
    }
  };

  const handleClearTracking = () => {
    setTrackingQuery("");
    setTrackingError(null);
    setTrackedSchedule(null);
  };

  const handleStartBooking = () => {
    requireCompleteProfile(() => {
      router.push("/(app)/schedule/new" as any);
    });
  };

  const handleSchedulePress = (item: ScheduleItem) => {
    router.push(`/(app)/schedule/${item.id}` as any);
  };

  const handleResumeDraft = (draft: ScheduleDraftItem) => {
    requireCompleteProfile(() => {
      router.push(`/(app)/schedule/new?draftId=${draft.id}` as any);
    });
  };

  const handleDiscardDraft = (draft: ScheduleDraftItem) => {
    if (deletingDraftRef.current) return;
    const eventLabel = getScheduleEventLabel(draft.eventType);
    const parishLabel = draft.parish?.parishName || draft.parishName || "Parish";
    Alert.alert(
      "Discard Saved Draft?",
      `Discard your ${eventLabel} draft for ${parishLabel}? Uploaded draft attachments will be permanently removed.`,
      [
        { text: "Keep Draft", style: "cancel" },
        {
          text: "Discard Draft",
          style: "destructive",
          onPress: async () => {
            if (deletingDraftRef.current) return;
            deletingDraftRef.current = true;
            try {
              await deleteDraftMutation.mutateAsync(draft.id);
              setDeletedDraftIds((prev) => {
                const next = new Set(prev);
                next.add(draft.id);
                return next;
              });
              Alert.alert("Draft Discarded", "Your saved schedule draft has been deleted.");
            } catch (err: any) {
              Alert.alert(
                "Discard Failed",
                err?.message || "Could not discard this schedule draft. Please try again."
              );
            } finally {
              deletingDraftRef.current = false;
            }
          },
        },
      ]
    );
  };

  const renderDraftItem = ({ item, index }: { item: ScheduleDraftItem; index: number }) => {
    const eventLabel = getScheduleEventLabel(item.eventType);
    const parishName = item.parish?.parishName || item.parishName || "Parish";
    const dateValue = item.date || item.preferredDate;
    const dateFormatted = dateValue ? formatScheduleDate(dateValue, "short") : "Date not selected";
    const timeSlot = item.timeSlot || "Time slot not selected";

    return (
      <View key={`draft-${item.id}`}>
        <View style={styles.itemRow}>
          <TouchableOpacity
            onPress={() => handleResumeDraft(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${eventLabel} draft at ${parishName}, status: Draft`}
          >
            <View style={styles.rowHeader}>
              <View style={styles.titleWrap}>
                <Text style={styles.confRefText} numberOfLines={1} allowFontScaling>
                  Draft Schedule
                </Text>
                <Text style={styles.eventTitle} numberOfLines={1} allowFontScaling>
                  {eventLabel}
                </Text>
              </View>
              <StatusLabel status="DRAFT" />
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1} allowFontScaling>
                {parishName}
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
          </TouchableOpacity>

          <View style={styles.draftActionsWrap}>
            <View style={styles.draftBtnRow}>
              <Pressable
                onPress={() => handleResumeDraft(item)}
                style={styles.draftPrimaryBtn}
                accessibilityRole="button"
                accessibilityLabel={`Resume draft for ${eventLabel}`}
              >
                <Ionicons name="play-outline" size={14} color={colors.primary} />
                <Text style={styles.draftPrimaryBtnText} allowFontScaling>
                  Resume Draft
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleDiscardDraft(item)}
                style={styles.draftDangerBtn}
                accessibilityRole="button"
                accessibilityLabel={`Discard draft for ${eventLabel}`}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.draftDangerBtnText} allowFontScaling>
                  Discard
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        {index < scheduleDrafts.length - 1 ? <Divider /> : null}
      </View>
    );
  };

  const renderScheduleItem = ({ item, index }: { item: ScheduleItem; index: number }) => {
    const hasProposal = isRescheduleProposalPending(item.status);
    const eventLabel = getScheduleEventLabel(item.eventType);
    const dateFormatted = formatScheduleDate(item.requestedDate, "short");
    const timeSlot = extractTimeSlotFromSchedule(item);
    const statusLabel = getScheduleStatusBadge(item.status).label;
    const confirmationRef = formatScheduleConfirmationRef(item.id, item.createdAt);

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[styles.itemRow, hasProposal && styles.itemRowHighlight]}
          onPress={() => handleSchedulePress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${eventLabel} ${confirmationRef} at ${item.parish?.parishName || "Parish"}, status: ${statusLabel}`}
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
              {confirmationRef ? (
                <Text style={styles.confRefText} numberOfLines={1} allowFontScaling>
                  {confirmationRef}
                </Text>
              ) : null}
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
        {/* Tracking Lookup */}
        <View style={styles.trackingContainer}>
          <View style={styles.trackingInputRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={trackingQuery}
              onChangeText={(text) => {
                setTrackingQuery(text);
                if (trackingError) setTrackingError(null);
              }}
              placeholder="Track schedule (e.g. CONF-2026-0026 or ID)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={() => void handleTrackingSearch()}
              style={styles.trackingInput}
              accessibilityLabel="Track schedule confirmation number"
            />
            {trackingQuery.length > 0 ? (
              <TouchableOpacity
                onPress={handleClearTracking}
                accessibilityRole="button"
                accessibilityLabel="Clear schedule search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            <Button
              title={trackingMutation.isPending ? "…" : "Track"}
              size="sm"
              variant="secondary"
              onPress={() => void handleTrackingSearch()}
              disabled={trackingMutation.isPending || !trackingQuery.trim()}
              accessibilityLabel="Look up schedule reference"
            />
          </View>

          {trackingError ? (
            <View style={styles.trackingErrorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.trackingErrorText} allowFontScaling>
                {trackingError}
              </Text>
            </View>
          ) : null}

          {trackedSchedule ? (
            <TouchableOpacity
              style={styles.trackedCard}
              onPress={() => handleSchedulePress(trackedSchedule)}
              accessibilityRole="button"
              accessibilityLabel={`Open tracked schedule ${formatScheduleConfirmationRef(trackedSchedule.id, trackedSchedule.createdAt)}`}
            >
              <View style={styles.trackedHeader}>
                <Text style={styles.trackedRef} allowFontScaling>
                  {formatScheduleConfirmationRef(trackedSchedule.id, trackedSchedule.createdAt)}
                </Text>
                <StatusLabel status={trackedSchedule.status} />
              </View>
              <Text style={styles.trackedTitle} numberOfLines={1} allowFontScaling>
                {getScheduleDisplayTitle(trackedSchedule)} • {trackedSchedule.parish?.parishName || "Parish"}
              </Text>
              <View style={styles.trackedFooter}>
                <Text style={styles.trackedDate} allowFontScaling>
                  {formatScheduleDate(trackedSchedule.requestedDate, "short")} • {extractTimeSlotFromSchedule(trackedSchedule)}
                </Text>
                <Text style={styles.trackedOpenLink} allowFontScaling>
                  View Details →
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Scope Filter Segment */}
        <View style={styles.filterBar}>
          <SegmentedControl<ScopeTab>
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "history", label: "History" },
              {
                value: "drafts",
                label:
                  scheduleDrafts.length > 0
                    ? `Drafts (${scheduleDrafts.length})`
                    : "Drafts",
              },
            ]}
            selectedValue={activeTab}
            onSelect={setActiveTab}
          />
        </View>

        {/* Content Body */}
        {activeTab === "drafts" ? (
          draftsQuery.isLoading && scheduleDrafts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Skeleton height={90} borderRadius={radii.sm} />
              <Skeleton height={90} borderRadius={radii.sm} />
            </View>
          ) : draftsQuery.error && scheduleDrafts.length === 0 ? (
            <View style={styles.errorContainer}>
              <EmptyState
                icon="alert-circle-outline"
                title="Failed to Load Drafts"
                description="Unable to load your saved schedule drafts. Please check your network and try again."
                actionLabel="Retry"
                onAction={() => void draftsQuery.refetch()}
              />
            </View>
          ) : (
            <FlatList
              data={scheduleDrafts}
              keyExtractor={(item) => `draft-${item.id}`}
              renderItem={renderDraftItem}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomInset + spacing.lg },
              ]}
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
                    icon="document-text-outline"
                    title="No Saved Drafts"
                    description="Saved schedule request drafts will appear here so you can resume or discard them."
                    actionLabel="New Schedule"
                    onAction={handleStartBooking}
                  />
                </View>
              }
            />
          )
        ) : isLoading && schedules.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={90} borderRadius={radii.sm} />
            <Skeleton height={90} borderRadius={radii.sm} />
            <Skeleton height={90} borderRadius={radii.sm} />
          </View>
        ) : error && schedules.length === 0 ? (
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
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                void fetchNextPage();
              }
            }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.footerText} allowFontScaling>
                    Loading more schedules…
                  </Text>
                </View>
              ) : hasNextPage ? (
                <View style={styles.footerLoading}>
                  <Button
                    title="Load More Schedules"
                    size="sm"
                    variant="outline"
                    onPress={() => void fetchNextPage()}
                  />
                </View>
              ) : null
            }
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
  trackingContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  trackingInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
    paddingVertical: 4,
  },
  trackingInput: {
    flex: 1,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    paddingVertical: 6,
  },
  trackingErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.xs,
  },
  trackingErrorText: {
    ...fontStyles.caption,
    color: colors.danger,
    flex: 1,
  },
  trackedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  trackedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  trackedRef: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  trackedTitle: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  trackedFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackedDate: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  trackedOpenLink: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  confRefText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 2,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  footerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  draftActionsWrap: {
    marginTop: spacing.xs,
  },
  draftBtnRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  draftPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  draftPrimaryBtnText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  draftDangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
  },
  draftDangerBtnText: {
    ...fontStyles.captionMedium,
    color: colors.danger,
    fontWeight: "600",
  },
});
