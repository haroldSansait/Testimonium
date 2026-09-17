import React, { useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useThreeDayHomeEvents } from "../api";
import {
  formatEventDate,
  formatEventTime,
  getManilaDateString,
  parseEventDateOnly,
  sortEventsChronologically,
} from "../presentation";
import type { PublicEventDto } from "../types";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface EventBannerCarouselProps {
  onEventPress?: (event: PublicEventDto) => void;
  onViewAllPress?: () => void;
  now?: Date;
}

export const getEventDetailRoute = (event: PublicEventDto) => {
  const { year, month } = parseEventDateOnly(event.eventDate);
  return {
    pathname: "/(app)/events/[id]" as const,
    params: {
      id: String(event.id),
      year: String(year),
      month: String(month),
    },
  };
};

export const EventBannerCarousel: React.FC<EventBannerCarouselProps> = ({
  onEventPress,
  onViewAllPress,
  now,
}) => {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: rawEvents, isLoading, isError, refetch } = useThreeDayHomeEvents(now);

  const events = React.useMemo(() => {
    return sortEventsChronologically(rawEvents || []);
  }, [rawEvents]);

  // Card width is responsive to screen width with side padding
  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 560);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / (cardWidth + spacing.sm));
    if (index >= 0 && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handlePressEvent = (event: PublicEventDto) => {
    if (onEventPress) {
      onEventPress(event);
    } else {
      router.push(getEventDetailRoute(event) as any);
    }
  };

  const handleViewMonth = () => {
    if (onViewAllPress) {
      onViewAllPress();
    } else {
      router.push("/(app)/events" as any);
    }
  };

  const todayStr = getManilaDateString(now);

  const getDayLabel = (eventDate?: string | null): string => {
    if (!eventDate) return "UPCOMING";
    const { dateKey } = parseEventDateOnly(eventDate);
    if (dateKey === todayStr) return "TODAY";
    
    // Check tomorrow
    const [y, m, d] = todayStr.split("-").map(Number);
    const tomDate = new Date(Date.UTC(y, m - 1, d + 1));
    const tomStr = `${tomDate.getUTCFullYear()}-${String(tomDate.getUTCMonth() + 1).padStart(2, "0")}-${String(tomDate.getUTCDate()).padStart(2, "0")}`;
    if (dateKey === tomStr) return "TOMORROW";

    return formatEventDate(eventDate, "short").toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.sectionTitle} allowFontScaling>
            Liturgical & Parish Events
          </Text>
          <Text style={styles.sectionSubtitle} allowFontScaling>
            Next 3 days across the diocese
          </Text>
        </View>
        <Pressable
          onPress={handleViewMonth}
          accessibilityRole="button"
          accessibilityLabel="View monthly calendar"
          hitSlop={8}
        >
          <Text style={styles.viewMonthLink} allowFontScaling>
            Monthly Calendar
          </Text>
        </Pressable>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.loadingHeader}>
            <Skeleton width={80} height={20} borderRadius={radii.xs} />
            <Skeleton width={120} height={16} borderRadius={radii.xs} />
          </View>
          <Skeleton width="85%" height={24} borderRadius={radii.xs} style={{ marginVertical: spacing.sm }} />
          <Skeleton width="60%" height={16} borderRadius={radii.xs} style={{ marginBottom: spacing.xs }} />
          <Skeleton width="40%" height={14} borderRadius={radii.xs} />
        </View>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <View style={[styles.stateContainer, { width: cardWidth }]}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.stateMessage} allowFontScaling>
            Could not load upcoming events.
          </Text>
          <Button
            title="Retry"
            size="sm"
            variant="outline"
            onPress={() => {
              void refetch();
            }}
          />
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !isError && events.length === 0 && (
        <View style={[styles.stateContainer, { width: cardWidth }]}>
          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
          <Text style={styles.stateMessage} allowFontScaling>
            No events scheduled for the next three days.
          </Text>
          <Button
            title="Browse Monthly Calendar"
            size="sm"
            variant="ghost"
            onPress={handleViewMonth}
          />
        </View>
      )}

      {/* Event Carousel List (Manual Swipe Only) */}
      {!isLoading && !isError && events.length > 0 && (
        <View>
          <FlatList
            data={events}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled={false}
            snapToInterval={cardWidth + spacing.sm}
            decelerationRate="fast"
            contentContainerStyle={styles.listContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const dayLabel = getDayLabel(item.eventDate);
              const timeStr = formatEventTime(item.startTime, item.endTime);
              const isToday = dayLabel === "TODAY";

              return (
                <Pressable
                  onPress={() => handlePressEvent(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayLabel}: ${item.title} at ${item.parish?.parishName || "Parish"}`}
                  accessibilityHint="Navigates to event details"
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth },
                    isToday && styles.cardToday,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                      <Text
                        style={[styles.dayBadgeText, isToday && styles.dayBadgeTextToday]}
                        allowFontScaling
                      >
                        {dayLabel}
                      </Text>
                    </View>
                    <Text style={styles.dateSubtext} allowFontScaling>
                      {formatEventDate(item.eventDate, "short")}
                    </Text>
                  </View>

                  <Text style={styles.eventTitle} numberOfLines={2} allowFontScaling>
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={colors.primary} style={styles.metaIcon} />
                    <Text style={styles.metaText} numberOfLines={1} allowFontScaling>
                      {item.parish?.parishName || "Diocese Parish"}
                    </Text>
                  </View>

                  {timeStr && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={styles.metaIcon} />
                      <Text style={styles.metaText} allowFontScaling>
                        {timeStr}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailText} allowFontScaling>
                      View Details
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </Pressable>
              );
            }}
          />

          {/* Accessible Page Indicator Dots */}
          {events.length > 1 && (
            <View
              style={styles.indicatorContainer}
              accessibilityRole="text"
              accessibilityLabel={`Event ${activeIndex + 1} of ${events.length}`}
            >
              {events.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.indicatorDot,
                    idx === activeIndex && styles.indicatorDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.xxs,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  sectionTitle: {
    ...fontStyles.heading,
    fontFamily: fontStyles.titleSerif.fontFamily,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  sectionSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  viewMonthLink: {
    ...fontStyles.captionBold,
    color: colors.primary,
  },
  listContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardToday: {
    borderColor: colors.primary + "40",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xxs,
  },
  dayBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  dayBadgeToday: {
    backgroundColor: colors.primarySoft,
  },
  dayBadgeText: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  dayBadgeTextToday: {
    color: colors.primary,
  },
  dateSubtext: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  eventTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  metaIcon: {
    marginTop: 1,
  },
  metaText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  viewDetailText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
  },
  indicatorDotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  loadingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  stateMessage: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
