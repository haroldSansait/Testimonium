import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { Divider } from "./Divider";
import { MotionPressable } from "./MotionPressable";

export interface ListRowProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  showDivider?: boolean;
  dividerInset?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  showChevron = false,
  showDivider = true,
  dividerInset = 0,
  onPress,
  disabled = false,
  style,
  titleStyle,
  subtitleStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const content = (
    <View style={[styles.container, style]}>
      {leading ? <View style={styles.leadingSlot}>{leading}</View> : null}

      <View style={styles.bodySlot}>
        {typeof title === "string" ? (
          <Text
            style={[styles.title, titleStyle]}
            numberOfLines={2}
            allowFontScaling
          >
            {title}
          </Text>
        ) : (
          title
        )}

        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text
              style={[styles.subtitle, subtitleStyle]}
              numberOfLines={2}
              allowFontScaling
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}

        {meta ? (
          <Text style={styles.meta} numberOfLines={1} allowFontScaling>
            {meta}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}

      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.neutral[500]}
          style={styles.chevron}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      )}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      {onPress ? (
        <MotionPressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ??
            (typeof title === "string" ? title : undefined)
          }
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled }}
        >
          {content}
        </MotionPressable>
      ) : (
        content
      )}
      {showDivider ? <Divider inset={dividerInset} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: colors.surface,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  leadingSlot: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.xs,
  },
  bodySlot: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  title: {
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.neutral[950],
  },
  subtitle: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    marginTop: 2,
  },
  meta: {
    ...fontStyles.meta,
    color: colors.neutral[500],
    marginTop: 4,
  },
  trailingSlot: {
    justifyContent: "center",
    alignItems: "flex-end",
    flexShrink: 0,
  },
  chevron: {
    marginLeft: spacing.xxs,
  },
});
