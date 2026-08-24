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
import { AppHeader, EmptyState, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { EventCard } from "./EventCard";
import { useCurrentMonthEvents } from "./api";
import {
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

export const EventsListScreen: React.FC = () => {
  const router = useRouter();
  const [monthParams, setMonthParams] = useState<MonthParams>(() =>
    getCurrentLocalMonthParams()
  );

  const {
    data: events = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCurrentMonthEvents(monthParams);

  const sortedEvents = sortEventsChronologically(events);

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

  const currentMonthLabel = `${MONTH_NAMES[monthParams.month - 1]} ${monthParams.year}`;

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Parish Events"
        subtitle="Masses, Feasts & Diocesan Gatherings"
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
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthLabelBox}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.monthLabelText}>{currentMonthLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNextMonth}
          activeOpacity={0.7}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
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
            title="Failed to Load Events"
            description="Unable to load parish events. Please check your network connection."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={sortedEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => handleEventPress(item)} />
          )}
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
                title="No Events Found"
                description={`No scheduled parish events or special liturgical celebrations for ${currentMonthLabel}.`}
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
  monthNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
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
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
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
});
