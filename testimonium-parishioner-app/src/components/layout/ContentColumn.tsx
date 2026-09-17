import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { useAppLayoutMetrics } from "./useAppLayoutMetrics";

export interface ContentColumnProps extends ViewProps {
  maxWidth?: number;
  useGutter?: boolean;
}

export const ContentColumn: React.FC<ContentColumnProps> = ({
  children,
  style,
  maxWidth,
  useGutter = true,
  ...props
}) => {
  const { pageGutter, maxReadableWidth } = useAppLayoutMetrics();
  const resolvedMaxWidth = maxWidth ?? maxReadableWidth;

  return (
    <View
      style={[
        styles.column,
        {
          maxWidth: resolvedMaxWidth,
          paddingHorizontal: useGutter ? pageGutter : 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  column: {
    width: "100%",
    alignSelf: "center",
  },
});
