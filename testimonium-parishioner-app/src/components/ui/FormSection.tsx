import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  style,
  titleStyle,
}) => {
  return (
    <View style={[styles.container, style]}>
      {title ? (
        <View style={styles.header}>
          <Text
            style={[styles.title, titleStyle]}
            accessibilityRole="header"
            allowFontScaling
          >
            {title}
          </Text>
          {description ? (
            <Text style={styles.description} allowFontScaling>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.fields}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    width: "100%",
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: colors.neutral[950],
  },
  description: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    marginTop: spacing.xxs,
  },
  fields: {
    gap: spacing.md,
    width: "100%",
  },
});
