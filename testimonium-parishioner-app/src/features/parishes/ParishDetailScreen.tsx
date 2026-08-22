import React, { useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  ParishCardSkeleton,
  SectionHeader,
} from "@/components/ui";
import { UpcomingEventsSection } from "@/features/events/UpcomingEventsSection";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useParishDetail } from "./api";
import {
  buildEmailUrl,
  buildMapUrl,
  buildPhoneUrl,
  formatOfficeHours,
  openExternalUrl,
} from "./utils";

export interface ParishDetailScreenProps {
  parishId?: string | null;
}

export const ParishDetailScreen: React.FC<ParishDetailScreenProps> = ({
  parishId,
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const isValidId = Boolean(parishId && /^[1-9]\d*$/.test(parishId.trim()));

  const {
    data: parish,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useParishDetail(isValidId ? parishId : undefined);

  const handleBack = () => {
    navigateBackOrReplace(
      () => router.canGoBack(),
      () => router.back(),
      () => router.replace("/(app)/(tabs)/(parishes)" as any)
    );
  };

  const hasCoverImage = Boolean(
    !imageError && parish?.coverImage && parish.coverImage.startsWith("http")
  );

  const phoneUrl = buildPhoneUrl(parish?.contactNumber);
  const emailUrl = buildEmailUrl(parish?.email);
  const mapUrl = buildMapUrl({
    latitude: parish?.latitude,
    longitude: parish?.longitude,
    address: parish?.address,
    name: parish?.name,
  });

  const officeHoursRows = formatOfficeHours(parish?.officeHours);

  const locationLabel = [parish?.municipalityCity, parish?.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title={isValidId && parish ? parish.name : "Parish Details"}
        subtitle={isValidId && parish ? parish.type : "Parish"}
        onBack={handleBack}
        backAccessibilityLabel="Back to parish directory"
      />

      {!isValidId || (!isLoading && (error || !parish)) ? (
        <View style={styles.contentPadding}>
          <EmptyState
            icon="alert-circle-outline"
            title="Parish Unavailable"
            description="The requested parish could not be loaded or may no longer be active."
            actionLabel="Return to Parishes"
            onAction={handleBack}
          />
        </View>
      ) : isLoading ? (
        <View style={styles.contentPadding}>
          <ParishCardSkeleton />
        </View>
      ) : parish ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => {
                void refetch();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Cover Image */}
          {hasCoverImage ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: parish.coverImage }}
                style={styles.coverImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
            </View>
          ) : null}

          <View style={styles.contentPadding}>
            {/* Header info */}
            <View style={styles.headerBlock}>
              <View style={styles.badgeRow}>
                {parish.type ? (
                  <Badge label={parish.type} variant="primary" />
                ) : null}
                {parish.feastDay ? (
                  <Badge
                    label={`Feast: ${parish.feastDay}`}
                    variant="neutral"
                  />
                ) : null}
              </View>

              <Text
                style={styles.parishTitle}
                accessibilityRole="header"
                allowFontScaling
              >
                {parish.name}
              </Text>

              {parish.patronSaint ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="sparkles-outline"
                    size={16}
                    color={colors.primary}
                    style={styles.infoIcon}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.patronText} allowFontScaling>
                    Patron Saint: {parish.patronSaint}
                  </Text>
                </View>
              ) : null}

              {locationLabel || parish.address ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={colors.textSecondary}
                    style={styles.infoIcon}
                    accessibilityElementsHidden={true}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.addressText} allowFontScaling>
                    {parish.address || locationLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Quick Actions Bar */}
            {phoneUrl || emailUrl || mapUrl ? (
              <View style={styles.actionsCard}>
                <Text style={styles.actionsTitle} allowFontScaling>
                  Contact & Location
                </Text>
                <View style={styles.actionsRow}>
                  {phoneUrl ? (
                    <Button
                      title="Call"
                      variant="secondary"
                      size="sm"
                      icon="call-outline"
                      onPress={() => {
                        void openExternalUrl(phoneUrl);
                      }}
                      accessibilityLabel={`Call ${parish.name}`}
                      style={styles.actionBtn}
                    />
                  ) : null}

                  {emailUrl ? (
                    <Button
                      title="Email"
                      variant="secondary"
                      size="sm"
                      icon="mail-outline"
                      onPress={() => {
                        void openExternalUrl(emailUrl);
                      }}
                      accessibilityLabel={`Email ${parish.name}`}
                      style={styles.actionBtn}
                    />
                  ) : null}

                  {mapUrl ? (
                    <Button
                      title="Directions"
                      variant="secondary"
                      size="sm"
                      icon="navigate-outline"
                      onPress={() => {
                        void openExternalUrl(mapUrl);
                      }}
                      accessibilityLabel={`Get directions to ${parish.name}`}
                      style={styles.actionBtn}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Description */}
            {parish.directoryDescription ? (
              <Card style={styles.sectionCard}>
                <SectionHeader title="About the Parish" />
                <Text style={styles.descriptionText} allowFontScaling>
                  {parish.directoryDescription}
                </Text>
              </Card>
            ) : null}

            {/* Office Hours */}
            {officeHoursRows.length > 0 ? (
              <Card style={styles.sectionCard}>
                <SectionHeader title="Parish Office Hours" />
                <View style={styles.officeHoursContainer}>
                  {officeHoursRows.map((row) => (
                    <View key={row.day} style={styles.officeHourRow}>
                      <Text style={styles.dayText} allowFontScaling>
                        {row.day}
                      </Text>
                      <Text style={styles.hoursText} allowFontScaling>
                        {row.hours}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Parish Public Events */}
            <UpcomingEventsSection
              parishId={parish.id}
              title="Events at this Parish"
              subtitle="Public events and masses scheduled this month"
              hideParishName={true}
            />
          </View>
        </ScrollView>
      ) : null}
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
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  contentPadding: {
    padding: spacing.md,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    backgroundColor: colors.surfaceVariant,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  headerBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  parishTitle: {
    ...fontStyles.title,
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.xs,
  },
  infoIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
  },
  patronText: {
    ...fontStyles.bodyMedium,
    color: colors.primary,
    flex: 1,
  },
  addressText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  actionsTitle: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minWidth: 90,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  descriptionText: {
    ...fontStyles.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  officeHoursContainer: {
    gap: spacing.xs,
  },
  officeHourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xxs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dayText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  hoursText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
  },
});
