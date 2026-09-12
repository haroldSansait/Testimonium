import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { CaloyClarificationData, CaloyClarificationOption } from "../types";

interface CaloyClarificationProps {
  clarification: CaloyClarificationData;
  onSelectOption: (option: CaloyClarificationOption) => void;
  disabled?: boolean;
}

export const CaloyClarification: React.FC<CaloyClarificationProps> = ({
  clarification,
  onSelectOption,
  disabled = false,
}) => {
  const options = clarification.clarificationOptions || [];

  if (options.length === 0) {
    return null;
  }

  const getClarificationIcon = () => {
    switch (clarification.clarificationType) {
      case "PARISH":
        return "business-outline";
      case "DOCUMENT_TYPE":
        return "document-text-outline";
      case "SCHEDULE_EVENT":
      case "DATE":
      case "TIME":
        return "calendar-outline";
      case "PRIEST":
        return "person-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getHeaderTitle = () => {
    switch (clarification.clarificationType) {
      case "PARISH":
        return "Select a parish:";
      case "DOCUMENT_TYPE":
        return "Select a document:";
      case "SCHEDULE_EVENT":
        return "Select an event or service:";
      case "DATE":
        return "Select a date:";
      case "TIME":
        return "Select a time:";
      case "PRIEST":
        return "Select a priest:";
      default:
        return "Please select an option:";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={getClarificationIcon()} size={14} color={colors.primary} />
        <Text style={styles.headerTitle} allowFontScaling>
          {getHeaderTitle()}
        </Text>
      </View>

      <View style={styles.optionsWrap}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => !disabled && onSelectOption(option)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              pressed && !disabled && styles.chipPressed,
              disabled && styles.chipDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select ${option.label}`}
            accessibilityState={{ disabled }}
          >
            <Text
              style={[styles.chipText, disabled && styles.chipTextDisabled]}
              allowFontScaling
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  chipPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.97 }],
  },
  chipDisabled: {
    opacity: 0.6,
    borderColor: colors.borderStrong,
  },
  chipText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
  },
  chipTextDisabled: {
    color: colors.textSecondary,
  },
});
