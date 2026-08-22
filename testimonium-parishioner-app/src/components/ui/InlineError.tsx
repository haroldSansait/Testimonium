import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  onRetry,
  retrying = false,
  style,
  compact = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        style,
      ]}
      accessible={true}
      accessibilityRole="alert"
    >
      <View style={styles.contentRow}>
        <Ionicons
          name="alert-circle-outline"
          size={compact ? 20 : 24}
          color={colors.danger}
          style={styles.icon}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text
          style={[styles.message, compact && styles.messageCompact]}
          allowFontScaling
        >
          {message}
        </Text>
      </View>
      {onRetry ? (
        <Button
          title="Retry"
          onPress={onRetry}
          loading={retrying}
          variant="secondary"
          size="sm"
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  containerCompact: {
    padding: spacing.sm,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    ...fontStyles.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  messageCompact: {
    ...fontStyles.caption,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
});
