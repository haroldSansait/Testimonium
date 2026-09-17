import React from "react";
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, fontStyles, spacing } from "@/theme/tokens";

export interface AuthBrandHeroProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AuthBrandHero: React.FC<AuthBrandHeroProps> = ({
  title,
  subtitle,
  compact = false,
  style,
}) => {
  return (
    <View style={[styles.container, compact ? styles.compactContainer : styles.fullContainer, style]}>
      {/* Background Mt. Kanlaon image */}
      <Image
        source={require("../../../assets/images/mt-kanlaon.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />

      {/* Brand Color Overlay matching web */}
      <View style={styles.brandOverlay} />

      {/* Brand & Editorial Heading */}
      <View style={[styles.brandContent, compact ? styles.compactBrandContent : styles.fullBrandContent]}>
        <Text style={styles.dioceseText} allowFontScaling>
          VICARIATE OF CANLAON
        </Text>
        <Text style={styles.wordmark} accessibilityRole="header" allowFontScaling>
          TESTIMONIUM
        </Text>
        {title ? (
          <Text style={styles.screenTitle} allowFontScaling>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.screenSubtitle} allowFontScaling>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: "#5C1520",
  },
  fullContainer: {
    minHeight: 220,
  },
  compactContainer: {
    minHeight: 130,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  brandOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(107, 15, 26, 0.85)",
  },
  brandContent: {
    zIndex: 2,
    width: "100%",
  },
  fullBrandContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  compactBrandContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  dioceseText: {
    ...fontStyles.captionBold,
    color: "rgba(255, 255, 255, 0.82)",
    letterSpacing: 1.2,
    fontSize: 12,
    marginBottom: spacing.xxs,
  },
  wordmark: {
    ...fontStyles.displaySerif,
    color: "#FFFFFF",
    letterSpacing: 2,
    fontSize: 26,
    lineHeight: 32,
  },
  screenTitle: {
    ...fontStyles.subheading,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  screenSubtitle: {
    ...fontStyles.caption,
    color: "rgba(255, 255, 255, 0.80)",
    marginTop: 2,
    maxWidth: 320,
  },
});
