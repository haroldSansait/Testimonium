import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStatusConfig, type StatusIntent } from "@/theme/status";
import { fontStyles, spacing } from "@/theme/tokens";

export interface StatusLabelProps {
  status?: string;
  label?: string;
  intent?: StatusIntent;
  icon?: keyof typeof Ionicons.glyphMap;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({
  status,
  label: customLabel,
  icon,
  showDot = true,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const config = getStatusConfig(status);
  const resolvedLabel = customLabel ?? config.label;
  const resolvedColor = config.color;

  const spokenLabel = accessibilityLabel ?? config.accessibilityLabel;

  return (
    <View
      style={[styles.container, style]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={spokenLabel}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={resolvedColor}
          style={styles.icon}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      ) : showDot ? (
        <View
          style={[styles.dot, { backgroundColor: resolvedColor }]}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      ) : null}
      <Text
        style={[
          styles.label,
          { color: resolvedColor },
          textStyle,
        ]}
        numberOfLines={1}
        allowFontScaling
      >
        {resolvedLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    ...fontStyles.captionMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
