import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import {
  EmptyState,
  EventCardSkeleton,
  InlineError,
  SectionHeader,
} from "@/components/ui";
import { spacing } from "@/theme/tokens";
import { useCurrentMonthEvents } from "./api";
import { EventCard } from "./EventCard";
import {
  filterEventsByParish,
  filterUpcomingEvents,
  sortEventsChronologically,
} from "./presentation";
import type { PublicEventDto } from "./types";

export interface UpcomingEventsSectionProps {
  parishId?: string | number;
  limit?: number;
  title?: string;
  subtitle?: string;
  onParishPress?: (parishId: number) => void;
  onSeeAll?: () => void;
  hideParishName?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const UpcomingEventsSection: React.FC<UpcomingEventsSectionProps> = ({
  parishId,
  limit = 3,
  title = "Upcoming This Month",
  subtitle,
  onParishPress,
  onSeeAll,
  hideParishName = false,
  style,
}) => {
  const router = useRouter();
  const { data: rawEvents, isLoading, isFetching, error, refetch } =
    useCurrentMonthEvents();

  const processedEvents = React.useMemo(() => {
    if (!rawEvents || !Array.isArray(rawEvents)) return [];

    let filtered = rawEvents;
    if (parishId !== undefined && parishId !== null && parishId !== "") {
      filtered = filterEventsByParish(filtered, parishId);
    }

    const upcoming = filterUpcomingEvents(filtered);
    const sorted = sortEventsChronologically(upcoming);
    return sorted.slice(0, limit);
  }, [rawEvents, parishId, limit]);

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      router.push("/(app)/events" as any);
    }
  };

  const handleEventPress = (event: PublicEventDto) => {
    router.push({
      pathname: "/(app)/events/[id]" as any,
      params: {
        id: String(event.id),
      },
    });
  };

  return (
    <View style={[styles.container, style]}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actionLabel="See All"
        onAction={handleSeeAll}
      />

      {isLoading ? (
        <View>
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
      ) : error ? (
        <InlineError
          message="Unable to load upcoming events right now."
          onRetry={() => {
            void refetch();
          }}
          retrying={isFetching}
          compact
        />
      ) : processedEvents.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming events"
          description={
            parishId
              ? "No upcoming public events scheduled for this parish this month."
              : "No upcoming public events scheduled in the diocese this month."
          }
          compact
        />
      ) : (
        processedEvents.map((event: PublicEventDto) => (
          <EventCard
            key={String(event.id)}
            event={event}
            onPress={() => handleEventPress(event)}
            onParishPress={onParishPress}
            hideParishName={hideParishName}
          />
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
});
