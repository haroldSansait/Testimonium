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

      <View style={styles.optionsList}>
        {options.map((option, idx) => (
          <Pressable
            key={option.value}
            onPress={() => !disabled && onSelectOption(option)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.optionRow,
              idx === options.length - 1 && styles.optionRowLast,
              pressed && !disabled && styles.optionRowPressed,
              disabled && styles.optionRowDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select ${option.label}`}
            accessibilityState={{ disabled }}
          >
            <Text
              style={[styles.optionText, disabled && styles.optionTextDisabled]}
              allowFontScaling
            >
              {option.label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={disabled ? colors.textMuted : colors.primary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderColor: colors.borderLight,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceVariant,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
  },
  optionsList: {
    backgroundColor: colors.surface,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionRowPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  optionRowDisabled: {
    opacity: 0.6,
  },
  optionText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
    flex: 1,
    marginRight: spacing.xs,
  },
  optionTextDisabled: {
    color: colors.textSecondary,
  },
});
