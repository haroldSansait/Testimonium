import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface GovernmentIdVerifyingAnimationProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const GovernmentIdVerifyingAnimation: React.FC<
  GovernmentIdVerifyingAnimationProps
> = ({ style, testID = "government-id-verifying-animation" }) => {
  const reduceMotion = useReducedMotion();
  const [scanProgress] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    if (reduceMotion) {
      scanProgress.stopAnimation();
      scanProgress.setValue(0.5);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }

    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    scanAnimation.start();
    pulseAnimation.start();

    return () => {
      scanAnimation.stop();
      pulseAnimation.stop();
    };
  }, [pulseAnim, reduceMotion, scanProgress]);

  const scanTranslateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  return (
    <View
      testID={testID}
      style={[styles.container, style]}
    >
      {/* Scanner Visual Frame with Corner Brackets */}
      <View style={styles.cardFrameWrapper}>
        {/* Animated Corner Brackets */}
        <Animated.View
          style={[styles.cornerBracketsContainer, { opacity: pulseAnim }]}
          pointerEvents="none"
        >
          <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
          <View style={[styles.cornerBracket, styles.bracketTopRight]} />
          <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
          <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
        </Animated.View>

        {/* Generic Stylized Government ID Card Graphic */}
        <View style={styles.cardGraphic}>
          {/* Subtle Watermark Shield */}
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Ionicons name="shield-checkmark" size={100} color="#F1F5F9" />
          </View>

          {/* Card Top Header */}
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark" size={13} color="#64748B" />
            <Text style={styles.cardHeaderText} numberOfLines={1}>
              PHILIPPINES IDENTIFICATION CARD
            </Text>
          </View>
          <View style={styles.cardHeaderDivider} />

          {/* Card Center Body */}
          <View style={styles.cardBodyRow}>
            {/* Photo Silhouette Area */}
            <View style={styles.cardPhotoBox}>
              <Ionicons name="person" size={26} color="#94A3B8" />
            </View>

            {/* Simulated Identity Lines */}
            <View style={styles.cardLinesBox}>
              {/* Microchip */}
              <View style={styles.cardChip}>
                <View style={styles.cardChipInner} />
              </View>

              {/* Data Rows */}
              <View style={styles.cardLinePrimary} />
              <View style={styles.cardLineSecondary} />
              <View style={styles.cardLineTertiary} />
              <View style={styles.cardLineQuaternary} />
            </View>
          </View>

          {/* Card Bottom / Barcode */}
          <View style={styles.cardFooterRow}>
            <View style={styles.barcodePattern}>
              <View style={[styles.barcodeBar, { width: 2 }]} />
              <View style={[styles.barcodeBar, { width: 3 }]} />
              <View style={[styles.barcodeBar, { width: 1.5 }]} />
              <View style={[styles.barcodeBar, { width: 4 }]} />
              <View style={[styles.barcodeBar, { width: 2 }]} />
              <View style={[styles.barcodeBar, { width: 3.5 }]} />
              <View style={[styles.barcodeBar, { width: 2 }]} />
            </View>

            <View style={styles.secureTag}>
              <Ionicons name="checkmark-circle" size={11} color="#059669" />
              <Text style={styles.secureTagText}>SECURE ID</Text>
            </View>
          </View>

          {/* Animated Sweeping Scanning Line & Radiant Beam Trail */}
          <View style={styles.scanBeamContainer} pointerEvents="none">
            <Animated.View
              style={[
                styles.scanBeamWrapper,
                { transform: [{ translateY: scanTranslateY }] },
              ]}
            >
              {/* Radiant Beam Trail */}
              <View style={styles.scanBeamGlow} />
              {/* Core Scan Line */}
              <View style={styles.scanBeamLine} />
              {/* Leading Soft Glow */}
              <View style={styles.scanBeamLeading} />
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Primary Status Typography */}
      <Text style={styles.primaryText}>Verifying your Government ID…</Text>

      {/* Secondary Instruction Typography */}
      <Text style={styles.secondaryText}>
        Please keep this screen open while we securely check your ID details.
      </Text>

      {/* Subtle Indeterminate Activity Badge */}
      <View style={styles.activityBadge}>
        <View style={styles.activityDot} />
        <Text style={styles.activityText}>
          Checking image quality and ID details.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: "#F8F8F7",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFrameWrapper: {
    position: "relative",
    padding: 3,
    marginBottom: spacing.md,
  },
  cornerBracketsContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  cornerBracket: {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "#059669",
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 8,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 8,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 8,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 8,
  },
  cardGraphic: {
    width: 250,
    height: 156,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  watermarkContainer: {
    position: "absolute",
    right: -10,
    bottom: -15,
    opacity: 0.6,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardHeaderText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  cardHeaderDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginTop: 4,
    marginBottom: 6,
  },
  cardBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardPhotoBox: {
    width: 52,
    height: 66,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLinesBox: {
    flex: 1,
    gap: 4,
  },
  cardChip: {
    width: 24,
    height: 16,
    borderRadius: 3,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginBottom: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardChipInner: {
    width: 14,
    height: 1,
    backgroundColor: "#D97706",
  },
  cardLinePrimary: {
    height: 6,
    width: "88%",
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  cardLineSecondary: {
    height: 5,
    width: "68%",
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
  },
  cardLineTertiary: {
    height: 5,
    width: "50%",
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
  },
  cardLineQuaternary: {
    height: 5,
    width: "78%",
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 6,
  },
  barcodePattern: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  barcodeBar: {
    height: 9,
    backgroundColor: "#CBD5E1",
    borderRadius: 1,
  },
  secureTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  secureTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.3,
  },
  scanBeamContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  scanBeamWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  scanBeamGlow: {
    height: 20,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  scanBeamLine: {
    height: 2.5,
    backgroundColor: "#10B981",
    shadowColor: "#059669",
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  scanBeamLeading: {
    height: 4,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  secondaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: "#ECFDF5",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  activityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
});
