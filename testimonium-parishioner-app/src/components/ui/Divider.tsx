import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "@/theme/tokens";

export interface DividerProps {
  inset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const Divider: React.FC<DividerProps> = ({
  inset = 0,
  color = colors.divider,
  style,
}) => {
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: color,
          marginLeft: inset,
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
};

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth || 1,
    width: "100%",
  },
});
