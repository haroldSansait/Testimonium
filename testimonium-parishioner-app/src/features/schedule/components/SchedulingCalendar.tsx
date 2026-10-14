import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getManilaDateParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  return { year, month, day, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
};

export const buildMonthCells = (year: number, month: number) => {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: number[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

export const isoForDay = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const moveMonth = (month: { year: number; month: number }, delta: number) => {
  const value = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
};

export interface SchedulingCalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  availableDates: string[];
  helperText?: string;
  initialMonth?: { year: number; month: number };
}

export const SchedulingCalendar: React.FC<SchedulingCalendarProps> = ({
  selectedDate,
  onSelectDate,
  availableDates,
  helperText = "Only dates confirmed by the parish are selectable.",
  initialMonth,
}) => {
  const today = useMemo(() => getManilaDateParts(), []);
  const [calendarMonth, setCalendarMonth] = useState(
    initialMonth || { year: today.year, month: today.month }
  );

  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  const cells = buildMonthCells(calendarMonth.year, calendarMonth.month);

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.monthHeader}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setCalendarMonth((m) => moveMonth(m, -1))}
          style={styles.monthButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle} allowFontScaling>
          {MONTH_NAMES[calendarMonth.month - 1]} {calendarMonth.year}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setCalendarMonth((m) => moveMonth(m, 1))}
          style={styles.monthButton}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Return to current month"
        onPress={() => setCalendarMonth({ year: today.year, month: today.month })}
        style={styles.todayButton}
      >
        <Text style={styles.todayButtonText} allowFontScaling>
          Return to Current Month
        </Text>
      </TouchableOpacity>

      <View style={styles.weekRow}>
        {WEEKDAY_NAMES.map((name) => (
          <Text key={name} style={styles.weekday} allowFontScaling>
            {name}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (day <= 0) return <View key={`blank-${index}`} style={styles.dayCellContainer} />;
          const iso = isoForDay(calendarMonth.year, calendarMonth.month, day);
          const available = availableDateSet.has(iso);
          const selected = selectedDate === iso;
          const isToday = today.iso === iso;
          return (
            <View key={iso} style={styles.dayCellContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${iso}${available ? ", available" : ", unavailable"}`}
                accessibilityState={{ disabled: !available, selected }}
                disabled={!available}
                onPress={() => onSelectDate(iso)}
                style={[
                  styles.dayBadge,
                  available && styles.dayAvailable,
                  selected && styles.daySelected,
                  isToday && !selected && styles.dayToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !available && styles.dayDisabledText,
                    selected && styles.daySelectedText,
                  ]}
                  allowFontScaling
                >
                  {day}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {helperText ? (
        <Text style={styles.calendarHelp} allowFontScaling>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  calendarContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  todayButton: {
    alignSelf: "center",
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  todayButtonText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  dayBadge: {
    width: "88%",
    height: "88%",
    borderRadius: radii.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  dayAvailable: {
    backgroundColor: colors.surfaceVariant,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  dayDisabledText: {
    color: colors.textMuted,
  },
  daySelectedText: {
    color: colors.surface,
    fontWeight: "700",
  },
  calendarHelp: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
