import React, { useState, useEffect, useMemo } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  Button,
  EmptyState,
  FilterSheet,
  FilterTrigger,
  IconButton,
  InlineError,
  ParishCardSkeleton,
  SectionHeader,
  SelectionRow,
  TextInput,
} from "@/components/ui";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { useInfiniteParishes } from "./api";
import { ParishCard } from "./ParishCard";
import {
  PARISH_TYPE_FILTERS,
  type ParishDto,
  type ParishTypeFilter,
} from "./types";

export const ParishDirectoryScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<ParishTypeFilter>("all");

  // Sheet filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftType, setDraftType] = useState<ParishTypeFilter>("all");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useInfiniteParishes({
    search: debouncedSearch || undefined,
    type: selectedType !== "all" ? selectedType : undefined,
  });

  const parishes = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const total = data?.pages?.[0]?.total ?? 0;
  const activeCount = selectedType !== "all" ? 1 : 0;

  const handleOpenFilter = () => {
    setDraftType(selectedType);
    setIsFilterOpen(true);
  };

  const handleApplyFilter = () => {
    setSelectedType(draftType);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftType("all");
  };

  const handleClearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedType("all");
  };

  const handleParishPress = (parish: ParishDto) => {
    router.push(`/parishes/${parish.id}` as any);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const isInitialLoading = isLoading && parishes.length === 0;
  const isInitialError = isError && parishes.length === 0;
  const isBackgroundError = isError && parishes.length > 0;

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Parish Directory"
        subtitle="Diocese of San Carlos"
      />

      <View style={styles.controlsSection}>
        {/* Search & Filter Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              placeholder="Search parish or patron saint..."
              value={searchInput}
              onChangeText={setSearchInput}
              leftIcon="search-outline"
              rightIcon={
                searchInput.length > 0 ? (
                  <IconButton
                    size={44}
                    onPress={() => setSearchInput("")}
                    accessibilityLabel="Clear search text"
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </IconButton>
                ) : undefined
              }
              containerStyle={styles.searchInput}
            />
          </View>
          <FilterTrigger
            activeCount={activeCount}
            onPress={handleOpenFilter}
            style={styles.filterTrigger}
          />
        </View>

        {/* Active Filters Summary */}
        {activeCount > 0 ? (
          <View style={styles.activeFiltersRow}>
            <Text style={styles.filterSummaryText} allowFontScaling>
              Type filter applied
            </Text>

            <Pressable
              onPress={handleClearAllFilters}
              style={styles.clearAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear parish filters"
            >
              <Text style={styles.clearAllText} allowFontScaling>
                Clear all
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Result count */}
        {!isInitialLoading && !isInitialError && parishes.length > 0 ? (
          <View style={styles.countRow}>
            <Text style={styles.countText} allowFontScaling>
              Showing {parishes.length} of {total}{" "}
              {total === 1 ? "parish" : "parishes"}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Background refresh error */}
      {isBackgroundError ? (
        <View style={styles.inlineBanner}>
          <InlineError
            message="Could not update directory. Showing cached results."
            onRetry={() => {
              void refetch();
            }}
            retrying={isFetching}
          />
        </View>
      ) : null}

      {/* Main Content Area */}
      {isInitialLoading ? (
        <View style={styles.listContainer}>
          <ParishCardSkeleton />
          <ParishCardSkeleton />
          <ParishCardSkeleton />
        </View>
      ) : isInitialError ? (
        <View style={styles.errorContainer}>
          <InlineError
            message="Unable to load parishes. Please check your connection and try again."
            onRetry={() => {
              void refetch();
            }}
            retrying={isFetching}
          />
        </View>
      ) : (
        <FlatList
          data={parishes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ParishCard parish={item} onPress={handleParishPress} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: contentBottomInset("tab") },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading && !isFetchingNextPage}
              onRefresh={() => {
                void refetch();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            debouncedSearch || activeCount > 0 ? (
              <EmptyState
                icon="search-outline"
                title="No parishes found"
                description={`No results matching your filters. Try adjusting your search query or filter.`}
                actionLabel="Clear Filters"
                onAction={handleClearAllFilters}
              />
            ) : (
              <EmptyState
                icon="business-outline"
                title="No parishes available"
                description="Parish information will appear here once published."
              />
            )
          }
          ListFooterComponent={
            hasNextPage ? (
              <View style={styles.paginationRow}>
                <Button
                  title={
                    isFetchingNextPage
                      ? "Loading more..."
                      : "Load more parishes"
                  }
                  variant="secondary"
                  size="sm"
                  onPress={handleLoadMore}
                  loading={isFetchingNextPage}
                  disabled={isFetchingNextPage}
                />
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Sheet Modal */}
      <FilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
        title="Filter Parishes"
      >
        <SectionHeader title="Jurisdiction / Type" />
        {PARISH_TYPE_FILTERS.map((item) => (
          <SelectionRow
            key={item.value}
            title={item.label}
            selected={draftType === item.value}
            onSelect={() => setDraftType(item.value)}
            mode="radio"
          />
        ))}
      </FilterSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  controlsSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterTrigger: {
    height: 44,
  },
  activeFiltersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  filterSummaryText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
    flex: 1,
  },
  clearAllBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: spacing.sm,
  },
  clearAllText: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
  countRow: {
    paddingTop: spacing.xs,
  },
  countText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  inlineBanner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  listContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  errorContainer: {
    padding: spacing.md,
  },
  paginationRow: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
