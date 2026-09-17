import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  formatEventDate,
  formatEventTime,
  parseEventDateOnly,
} from "./presentation";
import type { PublicEventDto } from "./types";

const MONTH_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

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

  const { month, day } = parseEventDateOnly(event.eventDate);
  const monthLabel = month >= 1 && month <= 12 ? MONTH_SHORT[month - 1] : "";

  const accessibilityLabel = `${event.title}. ${formattedDate}${
    formattedTime ? ` at ${formattedTime}` : ""
  }. ${event.location ? `Location: ${event.location}.` : ""}${
    parishName ? ` At ${parishName}.` : ""
  }`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens event details"
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Date badge on left */}
      <View style={styles.dateCol}>
        <Text style={styles.dateDay} allowFontScaling>
          {day > 0 ? String(day) : "--"}
        </Text>
        <Text style={styles.dateMonth} allowFontScaling>
          {monthLabel}
        </Text>
      </View>

      {/* Main Details */}
      <View style={styles.contentCol}>
        <View style={styles.headerRow}>
          <Text
            style={styles.title}
            numberOfLines={2}
            accessibilityRole="header"
            allowFontScaling
          >
            {event.title}
          </Text>
        </View>

        {event.eventType ? (
          <Text style={styles.eventTypeLabel} allowFontScaling>
            {event.eventType.replace(/_/g, " ")}
          </Text>
        ) : null}

        {formattedTime ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={13}
              color={colors.textSecondary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.metaText} allowFontScaling>
              {formattedTime}
            </Text>
          </View>
        ) : null}

        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.textSecondary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.metaText} numberOfLines={1} allowFontScaling>
              {event.location}
            </Text>
          </View>
        ) : null}

        {!hideParishName && parishName ? (
          <Pressable
            onPress={(e) => {
              if (onParishPress) {
                e.stopPropagation();
                onParishPress(event.parishId);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${parishName}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.parishRow}
          >
            <Ionicons
              name="business-outline"
              size={13}
              color={colors.primary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.parishNameText} numberOfLines={1} allowFontScaling>
              {parishName}
            </Text>
            {onParishPress ? (
              <Ionicons
                name="chevron-forward"
                size={12}
                color={colors.primary}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chevronCol}>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textMuted}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pressed: {
    backgroundColor: colors.surfaceVariant,
  },
  dateCol: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    marginRight: spacing.sm,
  },
  dateDay: {
    ...fontStyles.titleMedium,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 22,
  },
  dateMonth: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    marginBottom: 2,
  },
  title: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },
  eventTypeLabel: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
    textTransform: "capitalize",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  parishRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  parishNameText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
    flex: 1,
  },
  chevronCol: {
    paddingLeft: spacing.xs,
    justifyContent: "center",
  },
});
