import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

export interface AnimatedTabBarButtonProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AnimatedTabBarButton: React.FC<AnimatedTabBarButtonProps> = ({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      reduceMotionRef.current = Boolean(enabled);
    });
  }, []);

  const handlePressIn = () => {
    if (reduceMotionRef.current) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      speed: 30,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotionRef.current) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 100,
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

const styles = StyleSheet.create({
  content: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
