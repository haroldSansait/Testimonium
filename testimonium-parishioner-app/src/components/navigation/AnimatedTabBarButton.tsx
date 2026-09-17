import React, { useState } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface TabBarButtonProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const TabBarButton: React.FC<TabBarButtonProps> = ({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const reduceMotion = useReducedMotion();

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        handlePressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        handlePressOut();
        onPressOut?.(e);
      }}
      style={style}
    >
      {(state) => (
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {typeof children === "function" ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
};

export const AnimatedTabBarButton = TabBarButton;

const styles = StyleSheet.create({
  content: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
