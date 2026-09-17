import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "@/theme/tokens";

export interface FocusSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  borderRadius?: number;
}

export const FocusSurface: React.FC<FocusSurfaceProps> = ({
  children,
  style,
  padding = "lg",
  borderRadius = radii.elevated,
}) => {
  return (
    <View
      style={[
        styles.surface,
        {
          padding: spacing[padding],
          borderRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
});
