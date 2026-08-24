import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Badge } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { formatEventDate, formatEventTime } from "./presentation";
import type { PublicEventDto } from "./types";

export interface EventCardProps {
  event: PublicEventDto;
  onPress?: () => void;
  onParishPress?: (parishId: number) => void;
  style?: StyleProp<ViewStyle>;
  hideParishName?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  onParishPress,
  style,
  hideParishName = false,
}) => {
  const formattedDate = formatEventDate(event.eventDate);
  const formattedTime = formatEventTime(event.startTime, event.endTime);
  const parishName = event.parish?.parishName;

  const accessibilityLabel = `${event.title}. ${formattedDate}${
    formattedTime ? ` at ${formattedTime}` : ""
  }. ${event.location ? `Location: ${event.location}.` : ""}${
    parishName ? ` At ${parishName}.` : ""
  }`;

  const cardContent = (
    <Card
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, style]}
    >
      <View style={styles.topRow}>
        <View style={styles.dateBadge}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={colors.primary}
            style={styles.calendarIcon}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
          <Text style={styles.dateText} allowFontScaling>
            {formattedDate}
          </Text>
        </View>

        {event.eventType ? (
          <Badge
            label={event.eventType.replace(/_/g, " ")}
            variant="secondary"
          />
        ) : null}
      </View>

      <Text
        style={styles.title}
        accessibilityRole="header"
        allowFontScaling
      >
        {event.title}
      </Text>

      {formattedTime || event.location ? (
        <View style={styles.detailsContainer}>
          {formattedTime ? (
            <View style={styles.detailRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textSecondary}
                style={styles.detailIcon}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text style={styles.detailText} allowFontScaling>
                {formattedTime}
              </Text>
            </View>
          ) : null}

          {event.location ? (
            <View style={styles.detailRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.textSecondary}
                style={styles.detailIcon}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text
                style={styles.detailText}
                numberOfLines={1}
                allowFontScaling
              >
                {event.location}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!hideParishName && parishName && onParishPress ? (
        <View style={styles.parishFooter}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onParishPress(event.parishId);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`View ${parishName}`}
            accessibilityHint="Navigates to parish details"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.parishButton,
              pressed && styles.parishButtonPressed,
            ]}
          >
            <Ionicons
              name="business-outline"
              size={14}
              color={colors.primary}
              style={styles.parishIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.parishNameText} numberOfLines={1} allowFontScaling>
              {parishName}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.primary}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </Pressable>
        </View>
      ) : null}
    </Card>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  calendarIcon: {
    marginRight: spacing.xxs,
  },
  dateText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  title: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    marginVertical: spacing.xxs,
  },
  detailsContainer: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    marginRight: spacing.xs,
  },
  detailText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  parishFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  parishButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
  },
  parishButtonPressed: {
    opacity: 0.7,
  },
  parishIcon: {
    marginRight: spacing.xs,
  },
  parishNameText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    flex: 1,
    fontWeight: "600",
  },
});
