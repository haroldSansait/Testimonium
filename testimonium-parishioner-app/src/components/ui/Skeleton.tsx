import React, { useEffect, useState } from "react";
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
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
  borderRadius = radii.sm,
  style,
}) => {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
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
  }, [opacity]);

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
    />
  );
};

export const ParishCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton} accessible={true} accessibilityLabel="Loading parish information">
      <View style={styles.cardHeaderRow}>
        <Skeleton width="60%" height={20} />
        <Skeleton width={70} height={20} borderRadius={radii.pill} />
      </View>
      <Skeleton width="40%" height={14} style={styles.mtSm} />
      <Skeleton width="80%" height={14} style={styles.mtXs} />
    </View>
  );
};

export const EventCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton} accessible={true} accessibilityLabel="Loading event information">
      <View style={styles.cardHeaderRow}>
        <Skeleton width="50%" height={18} />
        <Skeleton width={80} height={18} borderRadius={radii.pill} />
      </View>
      <Skeleton width="70%" height={14} style={styles.mtSm} />
      <Skeleton width="35%" height={14} style={styles.mtXs} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.placeholderBg,
  },
  cardSkeleton: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  mtXs: {
    marginTop: spacing.xs,
  },
});
