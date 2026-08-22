import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, Card, IconButton } from "@/components/ui";
import { UpcomingEventsSection } from "@/features/events/UpcomingEventsSection";
import { useCurrentMonthEvents } from "@/features/events/api";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { profile } = useAuth();

  const { isFetching, refetch } = useCurrentMonthEvents();

  const displayName = profile?.fullName
    ? profile.fullName.split(" ")[0]
    : profile?.email?.split("@")[0] || "Parishioner";

  const handleExploreParishes = () => {
    router.push("/(app)/(tabs)/(parishes)" as any);
  };

  const handleNotificationPress = () => {
    router.push("/notifications" as any);
  };

  const handleParishPress = (parishId: number) => {
    router.push(`/parishes/${parishId}` as any);
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="TESTIMONIUM"
        subtitle="Diocese of San Carlos"
        rightAction={
          <IconButton
            onPress={handleNotificationPress}
            accessibilityLabel="Notifications"
            accessibilityHint="Opens notifications"
            size={44}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.primary}
            />
          </IconButton>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void refetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Welcome Greeting */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.greetingPre} allowFontScaling>
            Peace be with you,
          </Text>
          <Text
            style={styles.greetingName}
            accessibilityRole="header"
            allowFontScaling
          >
            {displayName}
          </Text>
        </View>

        {/* Explore Parishes Hero Card */}
        <Card
          onPress={handleExploreParishes}
          variant="highlight"
          accessibilityRole="button"
          accessibilityLabel="Explore Parishes. Browse parishes across the Diocese of San Carlos"
          accessibilityHint="Navigates to the Parish Directory tab"
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconCircle}>
              <Ionicons
                name="business-outline"
                size={26}
                color={colors.primary}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle} allowFontScaling>
                Parish Directory
              </Text>
              <Text style={styles.heroSubtitle} allowFontScaling>
                Browse parishes, patron saints, office hours, and contact details across the diocese.
              </Text>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroActionText} allowFontScaling>
              Explore Parishes
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.primary}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </View>
        </Card>

        {/* Upcoming Events Preview */}
        <UpcomingEventsSection
          limit={3}
          title="Upcoming This Month"
          subtitle="Public masses and community events"
          onParishPress={handleParishPress}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  welcomeContainer: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  greetingPre: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
  },
  greetingName: {
    ...fontStyles.title,
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  heroSubtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  heroActionText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    marginRight: spacing.xxs,
  },
});
