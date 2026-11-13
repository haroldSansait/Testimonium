import { useScreenRefresh, useManualRefresh } from "@/hooks/useAutomaticRefresh";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/Typography";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import {
  mergeRequestPages,
  useDeleteRequestDraft,
  useInfiniteRequestList,
  useRequestTrackingLookup,
} from "./api";
import { RequestCard } from "./components/RequestCard";
import type { DocumentRequestDetail } from "./types";

type FilterTab = "ALL" | "ACTIVE" | "PAST" | "DRAFTS";
const PAST_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);

export const RequestListScreen: React.FC = () => {
  const router = useRouter();
  const refreshOptions = useScreenRefresh();
  const { requireCompleteProfile } = useRequireCompleteProfile();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deletedDraftIds, setDeletedDraftIds] = useState<Set<number>>(() => new Set());
  const deletingDraftRef = useRef(false);
  const trackingLookup = useRequestTrackingLookup();
  const deleteDraftMutation = useDeleteRequestDraft();

  const {
    data: pagesData,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteRequestList({ limit: 20 }, refreshOptions);
  const { refreshing, onRefresh } = useManualRefresh(() => refetch({ cancelRefetch: false }));

  const requests = useMemo(
    () =>
      mergeRequestPages(pagesData?.pages).filter(
        (req) => !deletedDraftIds.has(req.id)
      ),
    [pagesData?.pages, deletedDraftIds]
  );

  const serverTotal = pagesData?.pages?.[0]?.pagination?.total;
  const totalCount =
    typeof serverTotal === "number"
      ? Math.max(requests.length, serverTotal - deletedDraftIds.size)
      : requests.length;

  const activeRequests = useMemo(
    () => requests.filter((req) => !req.isDraft && !PAST_STATUSES.has(req.status)),
    [requests]
  );

  const pastRequests = useMemo(
    () => requests.filter((req) => !req.isDraft && PAST_STATUSES.has(req.status)),
    [requests]
  );

  const draftRequests = useMemo(
    () => requests.filter((req) => Boolean(req.isDraft)),
    [requests]
  );

  const normalizedFilter = trackingNumber.trim().toLowerCase();

  const filteredRequests = useMemo(() => {
    const base =
      activeTab === "ACTIVE"
        ? activeRequests
        : activeTab === "PAST"
          ? pastRequests
          : activeTab === "DRAFTS"
            ? draftRequests
            : requests;

    if (!normalizedFilter) return base;
    return base.filter((req) => {
      const tracking = (req.trackingNumber || "").toLowerCase();
      const applicant = (req.applicantName || "").toLowerCase();
      const parish = (req.parish?.parishName || "").toLowerCase();
      const docType = (req.documentType || "").toLowerCase();
      return (
        tracking.includes(normalizedFilter) ||
        applicant.includes(normalizedFilter) ||
        parish.includes(normalizedFilter) ||
        docType.includes(normalizedFilter)
      );
    });
  }, [activeRequests, activeTab, draftRequests, normalizedFilter, pastRequests, requests]);

  useEffect(() => {
    if (
      activeTab !== "ALL" &&
      filteredRequests.length === 0 &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isLoading
    ) {
      void fetchNextPage();
    }
  }, [activeTab, fetchNextPage, filteredRequests.length, hasNextPage, isFetchingNextPage, isLoading]);

  const handleStartRequest = () => {
    requireCompleteProfile(() => {
      router.push("/(app)/requests/new" as any);
    });
  };

  const handleRequestPress = (request: DocumentRequestDetail) => {
    router.push(`/(app)/requests/${request.id}` as any);
  };

  const handleResumeDraft = (request: DocumentRequestDetail) => {
    requireCompleteProfile(() => {
      router.push(`/(app)/requests/new?draftId=${request.id}` as any);
    });
  };

  const handleDiscardDraft = (request: DocumentRequestDetail) => {
    if (!request.isDraft || deletingDraftRef.current) return;
    Alert.alert(
      "Discard Saved Draft?",
      `Discard your ${request.applicantName || "draft"} application? Uploaded draft attachments will be permanently removed.`,
      [
        { text: "Keep Draft", style: "cancel" },
        {
          text: "Discard Draft",
          style: "destructive",
          onPress: async () => {
            if (deletingDraftRef.current) return;
            deletingDraftRef.current = true;
            try {
              await deleteDraftMutation.mutateAsync(request.id);
              setDeletedDraftIds((prev) => {
                const next = new Set(prev);
                next.add(request.id);
                return next;
              });
              Alert.alert("Draft Discarded", "Your saved draft has been deleted.");
            } catch (err: any) {
              Alert.alert(
                "Discard Failed",
                err?.message || "Could not discard this draft. Please try again."
              );
            } finally {
              deletingDraftRef.current = false;
            }
          },
        },
      ]
    );
  };

  const handleTrackingLookup = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert("Tracking Number Required", "Enter a document tracking number (e.g. SR-2026-000452).");
      return;
    }
    try {
      const request = await trackingLookup.mutateAsync(trackingNumber);
      router.push(`/(app)/requests/${request.id}` as any);
    } catch (err: any) {
      Alert.alert("Request Not Found", err?.message || "We could not find one of your requests with that tracking number.");
    }
  };

  const loadedSuffix = hasNextPage ? "+" : "";
  const bottomPadding = contentBottomInset("tab");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Document Requests"
        subtitle="Certificates & Sacramental Records"
        rightAction={
          <Button
            title="New"
            size="sm"
            variant="primary"
            icon="add"
            onPress={handleStartRequest}
            accessibilityLabel="Start a new document request"
          />
        }
      />

      {/* Tracking Search Bar */}
      <View style={styles.trackingBar}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            placeholder="Search or track (e.g. SR-2026-000452)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={styles.trackingInput}
            accessibilityLabel="Request tracking number or filter search"
            returnKeyType="search"
            onSubmitEditing={() => void handleTrackingLookup()}
          />
          {trackingNumber.length > 0 ? (
            <Pressable
              onPress={() => setTrackingNumber("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search input"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Button
          title="Track"
          size="sm"
          variant="outline"
          loading={trackingLookup.isPending}
          disabled={!trackingNumber.trim()}
          onPress={() => void handleTrackingLookup()}
          accessibilityLabel="Find document request by tracking number"
        />
      </View>

      {/* Segmented Control Filter */}
      <View style={styles.filterSection}>
        <SegmentedControl<FilterTab>
          options={[
            { value: "ALL", label: `All (${totalCount})` },
            { value: "ACTIVE", label: `Active (${activeRequests.length}${loadedSuffix})` },
            { value: "PAST", label: `Past (${pastRequests.length}${loadedSuffix})` },
            { value: "DRAFTS", label: `Drafts (${draftRequests.length}${loadedSuffix})` },
          ]}
          selectedValue={activeTab}
          onSelect={(val: FilterTab) => setActiveTab(val)}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={100} style={styles.skeletonItem} />
            <Skeleton width="100%" height={100} style={styles.skeletonItem} />
            <Skeleton width="100%" height={100} style={styles.skeletonItem} />
          </View>
        ) : error && !pagesData ? (
          <View style={styles.centerContainer}>
            <EmptyState
              icon="alert-circle-outline"
              title="Unable to Load Requests"
              description="There was a problem loading your document requests. Please check your connection and try again."
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          </View>
        ) : filteredRequests.length === 0 && !isFetchingNextPage ? (
          <View style={styles.centerContainer}>
            <EmptyState
              icon="document-text-outline"
              title={
                normalizedFilter
                  ? "No Matching Requests"
                  : activeTab === "ACTIVE"
                    ? "No Active Requests"
                    : activeTab === "PAST"
                      ? "No Past Requests"
                      : activeTab === "DRAFTS"
                        ? "No Saved Drafts"
                        : "No Requests Yet"
              }
              description={
                normalizedFilter
                  ? "No loaded requests match your filter. Press Track above to look up any tracking reference directly on the server."
                  : activeTab === "ALL"
                    ? "Request official baptismal, confirmation, or marriage certificates from any parish in the Diocese of San Carlos."
                    : activeTab === "DRAFTS"
                      ? "Saved document request drafts will appear here so you can resume or discard them."
                      : "You do not have any requests matching this filter."
              }
              actionLabel={
                hasNextPage
                  ? "Load More History"
                  : activeTab === "ALL" && !normalizedFilter
                    ? "Start New Request"
                    : undefined
              }
              onAction={
                hasNextPage
                  ? () => {
                      void fetchNextPage();
                    }
                  : activeTab === "ALL" && !normalizedFilter
                    ? handleStartRequest
                    : undefined
              }
            />
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <RequestCard
                request={item}
                onPress={handleRequestPress}
                onResumeDraft={item.isDraft ? handleResumeDraft : undefined}
                onDiscardDraft={item.isDraft ? handleDiscardDraft : undefined}
              />
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                void fetchNextPage();
              }
            }}
            ListFooterComponent={
              hasNextPage ? (
                <View style={styles.footerLoadMore}>
                  {isFetchingNextPage ? (
                    <View style={styles.footerLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.footerLoadingText} allowFontScaling>
                        Loading more requests ({requests.length} of {totalCount})...
                      </Text>
                    </View>
                  ) : (
                    <Button
                      title={`Load More (${requests.length} of ${totalCount})`}
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        void fetchNextPage();
                      }}
                    />
                  )}
                </View>
              ) : requests.length > 0 ? (
                <Text style={styles.footerCompleteText} allowFontScaling>
                  Showing {filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"} ({requests.length} of {totalCount} loaded)
                </Text>
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
          />
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  trackingBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  trackingInput: {
    flex: 1,
    minHeight: 40,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  filterSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  skeletonContainer: {
    padding: spacing.md,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  footerLoadMore: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  footerLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  footerLoadingText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  footerCompleteText: {
    ...fontStyles.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
