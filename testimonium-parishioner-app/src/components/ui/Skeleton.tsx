import React, { useEffect, useState } from "react";
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, radii, spacing } from "@/theme/tokens";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = radii.xs,
  style,
}) => {
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    opacity.setValue(reduceMotion ? 0.6 : 0.4);
  }, [opacity, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
    />
  );
};

export const RowSkeleton: React.FC = () => {
  return (
    <View style={styles.rowSkeleton} accessible={true} accessibilityLabel="Loading item">
      <Skeleton width={40} height={40} borderRadius={radii.control} />
      <View style={styles.rowContent}>
        <Skeleton width="65%" height={16} />
        <Skeleton width="40%" height={12} style={styles.mtXs} />
      </View>
    </View>
  );
};

export const ParishCardSkeleton: React.FC = () => {
  return (
    <View style={styles.rowSkeleton} accessible={true} accessibilityLabel="Loading parish information">
      <Skeleton width={88} height={72} borderRadius={radii.image} />
      <View style={styles.rowContent}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} style={styles.mtXs} />
        <Skeleton width="30%" height={12} style={styles.mtXs} />
      </View>
    </View>
  );
};

export const EventCardSkeleton: React.FC = () => {
  return (
    <View style={styles.rowSkeleton} accessible={true} accessibilityLabel="Loading event information">
      <Skeleton width={56} height={56} borderRadius={radii.control} />
      <View style={styles.rowContent}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={14} style={styles.mtXs} />
        <Skeleton width="35%" height={12} style={styles.mtXs} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  rowSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    backgroundColor: colors.surface,
  },
  rowContent: {
    flex: 1,
  },
  mtXs: {
    marginTop: spacing.xs,
  },
});
