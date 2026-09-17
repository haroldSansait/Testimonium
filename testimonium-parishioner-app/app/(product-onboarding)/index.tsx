import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { ScreenScaffold } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useProductIntro } from "@/providers/ProductIntroProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

interface IntroPage {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const INTRO_PAGES: IntroPage[] = [
  {
    icon: "document-text-outline",
    title: "Sacramental Records",
    subtitle:
      "Request and track baptismal, confirmation, marriage, and death certificates with transparent requirements and real-time status updates.",
  },
  {
    icon: "calendar-outline",
    title: "Parish Life & Services",
    subtitle:
      "Schedule sacraments and blessings with verified parish availability, and discover nearby Catholic parishes, Mass schedules, and community events.",
  },
  {
    icon: "sparkles-outline",
    title: "Caloy Parish Guide",
    subtitle:
      "Ask Caloy for responsive assistance grounded in authoritative parish information, requirements, office hours, and diocesan guidelines.",
  },
];

export default function ProductOnboardingScreen({
  onCompleted,
}: {
  onCompleted?: () => void;
}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ preview?: string }>();
  const isPreview = params.preview === "true";
  const { completeIntro } = useProductIntro();
  const reduceMotion = useReducedMotion();
  const [currentPage, setCurrentPage] = useState(0);

  const isLastPage = currentPage === INTRO_PAGES.length - 1;
  const page = INTRO_PAGES[currentPage];

  const handleFinish = async () => {
    if (!isPreview) {
      await completeIntro();
    }
    if (onCompleted) {
      onCompleted();
    } else if (isPreview) {
      router.back();
    }
  };

  const handleNext = () => {
    if (isLastPage) {
      void handleFinish();
    } else {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    void handleFinish();
  };

  return (
    <ScreenScaffold variant="static" style={styles.scaffold}>
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={styles.brandSlot}>
          <Text style={styles.brandTitle} allowFontScaling>
            TESTIMONIUM
          </Text>
        </View>
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel={isPreview ? "Close intro" : "Skip intro"}
          hitSlop={8}
          style={styles.skipButton}
        >
          <Text style={styles.skipText} allowFontScaling>
            {isPreview ? "Close" : "Skip"}
          </Text>
        </Pressable>
      </View>

      {/* Main illustration & text */}
      <Animated.View
        key={currentPage}
        entering={reduceMotion ? undefined : FadeIn.duration(180)}
        style={styles.content}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={page.icon}
            size={56}
            color={colors.brand[700]}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </View>

        <Text style={styles.title} accessibilityRole="header" allowFontScaling>
          {page.title}
        </Text>

        <Text style={styles.subtitle} allowFontScaling>
          {page.subtitle}
        </Text>
      </Animated.View>

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Page dots indicator */}
        <View style={styles.dotsRow} accessibilityRole="tablist">
          {INTRO_PAGES.map((_, index) => {
            const isActive = index === currentPage;
            return (
              <View
                key={index}
                style={[styles.dot, isActive && styles.dotActive]}
                accessibilityRole="tab"
                accessibilityLabel={`Page ${index + 1} of ${INTRO_PAGES.length}`}
                accessibilityState={{ selected: isActive }}
              />
            );
          })}
        </View>

        <Button
          title={isLastPage ? "Get Started" : "Next"}
          onPress={handleNext}
          variant="primary"
          fullWidth
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scaffold: {
    backgroundColor: colors.canvas,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  brandSlot: {
    justifyContent: "center",
  },
  brandTitle: {
    ...fontStyles.titleSerif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.brand[700],
    letterSpacing: 1.5,
  },
  skipButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...fontStyles.button,
    color: colors.neutral[650],
    fontWeight: "500",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 104,
    height: 104,
    borderRadius: radii.image,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    ...fontStyles.displaySerif,
    fontSize: 26,
    lineHeight: 32,
    color: colors.neutral[950],
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    ...fontStyles.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.neutral[650],
    textAlign: "center",
    maxWidth: 340,
  },
  footer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[300],
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand[700],
  },
});
