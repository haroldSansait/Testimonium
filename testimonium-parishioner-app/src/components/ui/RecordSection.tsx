import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { Divider } from "./Divider";

export interface RecordField {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

export interface RecordSectionProps {
  title?: string;
  fields?: RecordField[];
  children?: React.ReactNode;
  showDividers?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const RecordSection: React.FC<RecordSectionProps> = ({
  title,
  fields,
  children,
  showDividers = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header" allowFontScaling>
          {title}
        </Text>
      ) : null}

      <View style={styles.fieldsContainer}>
        {fields?.map((field, index) => (
          <View key={field.label + index} style={styles.rowWrapper}>
            <View style={styles.row}>
              <Text style={styles.label} allowFontScaling>
                {field.label}
              </Text>
              <View style={styles.valueContainer}>
                {typeof field.value === "string" || typeof field.value === "number" ? (
                  <Text style={styles.value} allowFontScaling>
                    {field.value}
                  </Text>
                ) : (
                  field.value
                )}
                {field.hint ? (
                  <Text style={styles.hint} allowFontScaling>
                    {field.hint}
                  </Text>
                ) : null}
              </View>
            </View>
            {showDividers && index < fields.length - 1 ? <Divider /> : null}
          </View>
        ))}
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: colors.neutral[950],
    marginBottom: spacing.xs,
  },
  fieldsContainer: {
    width: "100%",
  },
  rowWrapper: {
    width: "100%",
  },
  row: {
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  label: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    flexBasis: 120,
    flexGrow: 1,
    minWidth: 100,
  },
  valueContainer: {
    flexBasis: 180,
    flexGrow: 2,
    alignItems: "flex-end",
  },
  value: {
    ...fontStyles.body,
    fontWeight: "500",
    color: colors.neutral[950],
    textAlign: "right",
  },
  hint: {
    ...fontStyles.caption,
    color: colors.neutral[500],
    marginTop: 2,
    textAlign: "right",
  },
});
