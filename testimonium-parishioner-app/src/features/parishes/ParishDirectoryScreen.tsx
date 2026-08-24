import React, { useState, useEffect, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  EmptyState,
  FilterChip,
  IconButton,
  InlineError,
  ParishCardSkeleton,
  TextInput,
  Button,
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

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<ParishTypeFilter>("all");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleTypeSelect = (type: ParishTypeFilter) => {
    setSelectedType(type);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedType("all");
  };

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

      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search parish or patron saint..."
            value={searchInput}
            onChangeText={setSearchInput}
            leftIcon="search-outline"
            rightIcon={
              searchInput.length > 0 ? (
                <IconButton
                  size={44}
                  onPress={handleClearSearch}
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

        {/* Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          {PARISH_TYPE_FILTERS.map((item) => (
            <FilterChip
              key={item.value}
              label={item.label}
              selected={selectedType === item.value}
              onPress={() => handleTypeSelect(item.value)}
            />
          ))}
        </ScrollView>

        {/* Result count / active filter indicator */}
        {!isInitialLoading && !isInitialError && parishes.length > 0 ? (
          <View style={styles.countRow}>
            <Text style={styles.countText} allowFontScaling>
              Showing {parishes.length} of {total}{" "}
              {total === 1 ? "parish" : "parishes"}
            </Text>
          </View>
        ) : null}
      </View>


      {/* Non-blocking background refresh error banner if cached data exists */}
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
          contentContainerStyle={styles.listContent}
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
            debouncedSearch || selectedType !== "all" ? (
              <EmptyState
                icon="search-outline"
                title="No parishes found"
                description={`No results matching "${
                  debouncedSearch || selectedType
                }". Try adjusting your search query or filter.`}
                actionLabel="Clear Filters"
                onAction={handleClearSearch}
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
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  filterSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchContainer: {
    marginTop: spacing.xs,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  filterChipsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.xs,
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
    paddingBottom: spacing.xxl,
  },
  errorContainer: {
    padding: spacing.md,
  },
  paginationRow: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
