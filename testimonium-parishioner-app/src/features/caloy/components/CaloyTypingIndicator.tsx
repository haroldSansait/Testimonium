import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { CaloyAvatar } from "./CaloyAvatar";

export const CaloyTypingIndicator: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [dot1] = useState(() => new Animated.Value(0));
  const [dot2] = useState(() => new Animated.Value(0));
  const [dot3] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      dot1.setValue(0.6);
      dot2.setValue(0.6);
      dot3.setValue(0.6);
      return;
    }

    const createAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(700 - delay),
        ])
      );
    };

    const a1 = createAnimation(dot1, 0);
    const a2 = createAnimation(dot2, 200);
    const a3 = createAnimation(dot3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3, reduceMotion]);

  const interpolateTranslate = (animValue: Animated.Value) => {
    return animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -5],
    });
  };

  const interpolateOpacity = (animValue: Animated.Value) => {
    return animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    });
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel="Caloy is thinking"
    >
      <View style={styles.row}>
        <CaloyAvatar size={28} />
        <View style={styles.bubble}>
          <View style={styles.dotsRow}>
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: interpolateOpacity(dot1),
                  transform: [{ translateY: interpolateTranslate(dot1) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: interpolateOpacity(dot2),
                  transform: [{ translateY: interpolateTranslate(dot2) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: interpolateOpacity(dot3),
                  transform: [{ translateY: interpolateTranslate(dot3) }],
                },
              ]}
            />
          </View>
          <Text style={styles.thinkingText}>Caloy is thinking...</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  thinkingText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
});
