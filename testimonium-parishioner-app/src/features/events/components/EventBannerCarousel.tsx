import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ExpoRouter from "expo-router";
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
import {
  getBundledParishImage,
  resolveParishImageSource,
} from "@/features/parishes/parishImages";
import { colors, fontStyles, radii, shadows, spacing } from "@/theme/tokens";

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

interface EventCardItemProps {
  item: PublicEventDto;
  cardWidth: number;
  dayLabel: string;
  isToday: boolean;
  timeStr: string | null;
  onPress: () => void;
}

const EventCardItem: React.FC<EventCardItemProps> = ({
  item,
  cardWidth,
  dayLabel,
  isToday,
  timeStr,
  onPress,
}) => {
  const [imageError, setImageError] = useState(false);

  const coverImageUrl =
    (item as any).coverImage || (item.parish as any)?.coverImage;

  const imageSource = React.useMemo(() => {
    if (imageError) {
      return getBundledParishImage({
        id: item.parishId,
        name: item.parish?.parishName,
      });
    }
    return resolveParishImageSource({
      id: item.parishId,
      name: item.parish?.parishName,
      coverImage: coverImageUrl,
    });
  }, [item.parishId, item.parish?.parishName, coverImageUrl, imageError]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel}: ${item.title} at ${item.parish?.parishName || "Parish"}`}
      accessibilityHint="Navigates to event details"
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Top Parish Photograph Section */}
      <View style={styles.imageContainer}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons
              name="business-outline"
              size={32}
              color={colors.primary}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </View>
        )}

        <View style={styles.imageOverlay} />

        {/* Badges on top of image */}
        <View style={styles.badgeOverlayContainer}>
          <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
            <Text
              style={[styles.dayBadgeText, isToday && styles.dayBadgeTextToday]}
              allowFontScaling
            >
              {dayLabel}
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText} allowFontScaling>
              {formatEventDate(item.eventDate, "short")}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Content Details */}
      <View style={styles.cardBody}>
        <Text style={styles.eventTitle} numberOfLines={2} allowFontScaling>
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={colors.primary}
            style={styles.metaIcon}
          />
          <Text style={styles.metaText} numberOfLines={1} allowFontScaling>
            {item.parish?.parishName || "Diocese Parish"}
          </Text>
        </View>

        {timeStr && (
          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.metaIcon}
            />
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
      </View>
    </Pressable>
  );
};

const AUTOPLAY_INTERVAL_MS = 8000;
const VISIBLE_DOTS_LIMIT = 5;

export const EventBannerCarousel: React.FC<EventBannerCarouselProps> = ({
  onEventPress,
  onViewAllPress,
  now,
}) => {
  const router = ExpoRouter.useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<PublicEventDto>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);


  const isAppActiveState = (state?: any) => {
    const resolvedState = typeof state === "function" ? state() : state;
    if (!resolvedState || typeof resolvedState !== "string") {
      return true;
    }
    return resolvedState !== "background" && resolvedState !== "inactive";
  };

  const [isAppActive, setIsAppActive] = useState(() =>
    isAppActiveState(AppState.currentState)
  );


  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const isScreenFocused =
    typeof (ExpoRouter as any).useIsFocused === "function"
      ? (ExpoRouter as any).useIsFocused()
      : true;

  // Track app active/background state
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      setIsAppActive(isAppActiveState(nextState));
    });
    return () => sub.remove();
  }, []);

  // Track reduced-motion accessibility preference
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setIsReducedMotion(Boolean(enabled));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (mounted) setIsReducedMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const { data: rawEvents, isLoading, isError, refetch } = useThreeDayHomeEvents(now);

  const events = useMemo(() => {
    return sortEventsChronologically(rawEvents || []);
  }, [rawEvents]);

  // Card width is responsive to screen width with side padding
  const cardWidth = Math.min(windowWidth - spacing.lg * 2, 560);
  const itemLength = cardWidth + spacing.sm;

  // Smooth scroll helper
  const scrollToEventIndex = useCallback(
    (targetIndex: number, animated = true) => {
      if (flatListRef.current && events.length > 0) {
        const safeIndex = Math.max(0, Math.min(targetIndex, events.length - 1));
        flatListRef.current.scrollToOffset({
          offset: safeIndex * itemLength,
          animated,
        });
      }
    },
    [events.length, itemLength]
  );

  // Derive safeActiveIndex to guarantee valid bounds during renders even if events list shrinks
  const safeActiveIndex =
    events.length > 0 ? Math.max(0, Math.min(activeIndex, events.length - 1)) : 0;

  // Safely synchronize scroll position if events list shrinks or resets
  useEffect(() => {
    if (events.length > 0 && activeIndex >= events.length) {
      const timer = setTimeout(() => {
        setActiveIndex(0);
        scrollToEventIndex(0, false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [events.length, activeIndex, scrollToEventIndex]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / itemLength);
    const clampedIndex = Math.max(0, Math.min(index, events.length - 1));
    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
    }
  };

  // Autoplay management: advances every 8s when active and focused
  const canAutoplay =
    !isLoading &&
    !isError &&
    events.length > 1 &&
    isAppActive &&
    isScreenFocused &&
    !isReducedMotion &&
    !isInteracting;

  useEffect(() => {
    if (!canAutoplay) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % events.length;
        scrollToEventIndex(nextIndex, true);
        return nextIndex;
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [canAutoplay, events.length, scrollToEventIndex]);

  // 5-dot sliding window pagination calculation
  const visibleDots = useMemo(() => {
    const total = events.length;
    if (total <= VISIBLE_DOTS_LIMIT) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const maxStart = total - VISIBLE_DOTS_LIMIT;
    const idealStart = safeActiveIndex - 2; // centers active dot in 5-dot window
    const startIdx = Math.max(0, Math.min(idealStart, maxStart));
    return Array.from({ length: VISIBLE_DOTS_LIMIT }, (_, i) => startIdx + i);
  }, [events.length, safeActiveIndex]);


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
          <Skeleton width="100%" height={124} borderRadius={0} />
          <View style={styles.cardBody}>
            <Skeleton width="85%" height={22} borderRadius={radii.xs} style={{ marginBottom: spacing.xs }} />
            <Skeleton width="60%" height={16} borderRadius={radii.xs} style={{ marginBottom: spacing.xxs }} />
            <Skeleton width="40%" height={14} borderRadius={radii.xs} />
          </View>
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

      {/* Event Carousel List (Supports Automatic Cycling & Manual Swiping) */}
      {!isLoading && !isError && events.length > 0 && (
        <View>
          <FlatList
            ref={flatListRef}
            data={events}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled={false}
            snapToInterval={itemLength}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              length: itemLength,
              offset: itemLength * index,
              index,
            })}
            contentContainerStyle={styles.listContent}
            onScroll={handleScroll}
            onScrollBeginDrag={() => setIsInteracting(true)}
            onScrollEndDrag={(e) => {
              handleScroll(e);
              setIsInteracting(false);
            }}
            onMomentumScrollEnd={(e) => {
              handleScroll(e);
              setIsInteracting(false);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const dayLabel = getDayLabel(item.eventDate);
              const timeStr = formatEventTime(item.startTime, item.endTime);
              const isToday = dayLabel === "TODAY";

              return (
                <EventCardItem
                  item={item}
                  cardWidth={cardWidth}
                  dayLabel={dayLabel}
                  isToday={isToday}
                  timeStr={timeStr}
                  onPress={() => handlePressEvent(item)}
                />
              );
            }}
          />

          {/* Accessible Page Indicator Dots (Compact Sliding Window, Max 5) */}
          {events.length > 1 && (
            <View
              style={styles.indicatorContainer}
              accessibilityRole="text"
              accessibilityLabel={`Event ${safeActiveIndex + 1} of ${events.length}`}
            >
              {visibleDots.map((eventIdx) => (
                <View
                  key={eventIdx}
                  style={[
                    styles.indicatorDot,
                    eventIdx === safeActiveIndex && styles.indicatorDotActive,
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
    overflow: "hidden",
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.94,
  },
  imageContainer: {
    width: "100%",
    height: 124,
    backgroundColor: colors.surfaceMuted,
    position: "relative",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  badgeOverlayContainer: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  dayBadgeToday: {
    backgroundColor: colors.primary,
  },
  dayBadgeText: {
    ...fontStyles.meta,
    color: colors.neutral[950],
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dayBadgeTextToday: {
    color: "#FFFFFF",
  },
  dateBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  dateBadgeText: {
    ...fontStyles.caption,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xs,
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

