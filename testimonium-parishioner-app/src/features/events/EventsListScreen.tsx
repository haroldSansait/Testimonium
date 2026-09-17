import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  EmptyState,
  FilterSheet,
  FilterTrigger,
  IconButton,
  SectionHeader,
  SelectionRow,
  Skeleton,
  TextInput,
} from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { EventCard } from "./EventCard";
import { useCurrentMonthEvents } from "./api";
import {
  filterEventsByParish,
  filterUpcomingEvents,
  getCurrentLocalMonthParams,
  sortEventsChronologically,
} from "./presentation";
import type { MonthParams, PublicEventDto } from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EVENT_TYPE_OPTIONS = [
  { label: "All Categories", value: "ALL" },
  { label: "Holy Mass", value: "HOLY_MASS" },
  { label: "Parish Event", value: "PARISH_EVENT" },
  { label: "Feast Day", value: "FEAST_DAY" },
  { label: "Sacrament", value: "SACRAMENT" },
  { label: "Diocesan Gathering", value: "DIOCESAN" },
];

export const EventsListScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();

  const [monthParams, setMonthParams] = useState<MonthParams>(() =>
    getCurrentLocalMonthParams()
  );

  const [searchInput, setSearchInput] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<"ALL_MONTH" | "UPCOMING">("ALL_MONTH");
  const [selectedParishId, setSelectedParishId] = useState<string>("ALL");

  // Sheet filter draft state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftType, setDraftType] = useState("ALL");
  const [draftPeriod, setDraftPeriod] = useState<"ALL_MONTH" | "UPCOMING">("ALL_MONTH");
  const [draftParishId, setDraftParishId] = useState<string>("ALL");

  const {
    data: rawEvents = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCurrentMonthEvents(monthParams);

  // Extract parishes from loaded month events
  const parishesInMonth = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of rawEvents) {
      if (e.parishId && e.parish?.parishName) {
        map.set(e.parishId, e.parish.parishName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id: String(id), name }));
  }, [rawEvents]);

  const activeFilterCount =
    (selectedType !== "ALL" ? 1 : 0) +
    (selectedPeriod !== "ALL_MONTH" ? 1 : 0) +
    (selectedParishId !== "ALL" ? 1 : 0);

  const handleOpenFilter = () => {
    setDraftType(selectedType);
    setDraftPeriod(selectedPeriod);
    setDraftParishId(selectedParishId);
    setIsFilterOpen(true);
  };

  const handleApplyFilter = () => {
    setSelectedType(draftType);
    setSelectedPeriod(draftPeriod);
    setSelectedParishId(draftParishId);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setDraftType("ALL");
    setDraftPeriod("ALL_MONTH");
    setDraftParishId("ALL");
  };

  const handleClearAllFilters = () => {
    setSearchInput("");
    setSelectedType("ALL");
    setSelectedPeriod("ALL_MONTH");
    setSelectedParishId("ALL");
  };

  // Filter and sort events
  const displayedEvents = useMemo(() => {
    let list = rawEvents;

    // Period filter
    if (selectedPeriod === "UPCOMING") {
      list = filterUpcomingEvents(list);
    }

    // Parish filter
    if (selectedParishId !== "ALL") {
      list = filterEventsByParish(list, selectedParishId);
    }

    // Type filter
    if (selectedType !== "ALL") {
      list = list.filter((e) => e.eventType === selectedType);
    }

    // Search query
    if (searchInput.trim().length > 0) {
      const q = searchInput.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.parish?.parishName?.toLowerCase().includes(q)
      );
    }

    return sortEventsChronologically(list);
  }, [rawEvents, selectedPeriod, selectedParishId, selectedType, searchInput]);

  const handlePrevMonth = () => {
    setMonthParams((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setMonthParams((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(home)" as any);
    }
  };

  const handleEventPress = (event: PublicEventDto) => {
    router.push({
      pathname: "/(app)/events/[id]" as any,
      params: {
        id: String(event.id),
        year: String(monthParams.year),
        month: String(monthParams.month),
      },
    });
  };

  const handleParishPress = (parishId: number) => {
    router.push(`/(app)/parishes/${parishId}` as any);
  };

  const currentMonthLabel = `${MONTH_NAMES[monthParams.month - 1]} ${monthParams.year}`;

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Parish Events"
        subtitle="Masses, Feasts & Gatherings"
        onBack={handleBack}
      />

      {/* Month Navigator */}
      <View style={styles.monthNavContainer}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthLabelBox}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={styles.monthLabelText} allowFontScaling>
            {currentMonthLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNextMonth}
          activeOpacity={0.7}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search & Filter Trigger */}
      <View style={styles.controlsSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              placeholder="Search event or venue..."
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
            activeCount={activeFilterCount}
            onPress={handleOpenFilter}
            style={styles.filterTrigger}
          />
        </View>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 ? (
          <View style={styles.activeFiltersRow}>
            <Text style={styles.filterSummaryText} allowFontScaling>
              {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} applied
            </Text>

            <Pressable
              onPress={handleClearAllFilters}
              style={styles.clearAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear event filters"
            >
              <Text style={styles.clearAllText} allowFontScaling>
                Clear all
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Content Body */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton height={72} borderRadius={radii.xs} style={styles.skeleton} />
          <Skeleton height={72} borderRadius={radii.xs} style={styles.skeleton} />
          <Skeleton height={72} borderRadius={radii.xs} style={styles.skeleton} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Failed to Load Events"
            description="Unable to load parish events. Please check your network connection."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={displayedEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => handleEventPress(item)}
              onParishPress={handleParishPress}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: contentBottomInset() },
          ]}
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
                title="No Events Found"
                description={
                  activeFilterCount > 0 || searchInput
                    ? "No events match your current filter settings or search query."
                    : `No scheduled parish events or special liturgical celebrations for ${currentMonthLabel}.`
                }
                actionLabel={
                  activeFilterCount > 0 || searchInput ? "Clear Filters" : undefined
                }
                onAction={
                  activeFilterCount > 0 || searchInput
                    ? handleClearAllFilters
                    : undefined
                }
              />
            </View>
          }
        />
      )}

      {/* Filter Sheet */}
      <FilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
        title="Filter Events"
      >
        <SectionHeader title="Period" />
        <SelectionRow
          title="All Month"
          description={`View all events in ${currentMonthLabel}`}
          selected={draftPeriod === "ALL_MONTH"}
          onSelect={() => setDraftPeriod("ALL_MONTH")}
          mode="radio"
        />
        <SelectionRow
          title="Upcoming Only"
          description="View events from today onward"
          selected={draftPeriod === "UPCOMING"}
          onSelect={() => setDraftPeriod("UPCOMING")}
          mode="radio"
        />

        <View style={styles.sheetSection}>
          <SectionHeader title="Event Category" />
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <SelectionRow
              key={opt.value}
              title={opt.label}
              selected={draftType === opt.value}
              onSelect={() => setDraftType(opt.value)}
              mode="radio"
            />
          ))}
        </View>

        {parishesInMonth.length > 0 ? (
          <View style={styles.sheetSection}>
            <SectionHeader title="Parish Church" />
            <SelectionRow
              title="All Parishes"
              selected={draftParishId === "ALL"}
              onSelect={() => setDraftParishId("ALL")}
              mode="radio"
            />
            {parishesInMonth.map((p) => (
              <SelectionRow
                key={p.id}
                title={p.name}
                selected={draftParishId === p.id}
                onSelect={() => setDraftParishId(p.id)}
                mode="radio"
              />
            ))}
          </View>
        ) : null}
      </FilterSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  monthNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: radii.xs,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  monthLabelText: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 15,
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
  sheetSection: {
    marginTop: spacing.md,
  },
});
