import React from "react";
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontStyles, spacing } from "@/theme/tokens";

export interface AuthBrandHeroProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  heroMinHeight?: number;
  style?: StyleProp<ViewStyle>;
  onBack?: () => void;
  showBack?: boolean;
}

export const AuthBrandHero: React.FC<AuthBrandHeroProps> = ({
  title,
  subtitle,
  compact = false,
  heroMinHeight,
  style,
  onBack,
  showBack = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        compact ? styles.compactContainer : styles.fullContainer,
        heroMinHeight ? { minHeight: heroMinHeight } : null,
        style,
      ]}
    >
      {/* Background Mt. Kanlaon image */}
      <Image
        source={require("../../../assets/images/mt-kanlaon.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />

      {/* Brand Color Overlay matching TESTIMONIUM deep maroon identity */}
      <View style={styles.brandOverlay} />

      {/* Optional Top Back Button */}
      {showBack && onBack ? (
        <SafeAreaView edges={["top"]} style={styles.backSafeArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
      ) : null}

      {/* Brand & Editorial Heading */}
      <View
        style={[
          styles.brandContent,
          compact ? styles.compactBrandContent : styles.fullBrandContent,
          heroMinHeight ? styles.authFormBrandContent : null,
          showBack ? styles.contentWithBack : null,
        ]}
      >
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
    minHeight: 140,
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
  backSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.20)",
  },
  brandContent: {
    zIndex: 2,
    width: "100%",
  },
  contentWithBack: {
    paddingTop: spacing.xs,
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
  authFormBrandContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
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
