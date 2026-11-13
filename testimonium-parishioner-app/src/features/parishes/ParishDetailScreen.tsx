import React, { useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/Typography";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  Button,
  EmptyState,
  PageSection,
  ParishCardSkeleton,
  RecordSection,
  StatusLabel,
} from "@/components/ui";
import { UpcomingEventsSection } from "@/features/events/UpcomingEventsSection";
import { getEffectiveOfferedDocuments } from "@/features/requests/presentation";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
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
  const { contentBottomInset } = useAppLayoutMetrics();
  const { requireCompleteProfile } = useRequireCompleteProfile();
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
  const safeFacebookUrl =
    parish?.facebookPage && /^https?:\/\//i.test(parish.facebookPage.trim())
      ? parish.facebookPage.trim()
      : null;

  const officeHoursRows = formatOfficeHours(parish?.officeHours);

  const locationLabel = [parish?.municipalityCity, parish?.province]
    .filter(Boolean)
    .join(", ");

  const offeredDocuments = getEffectiveOfferedDocuments(parish?.availableDocuments);
  const assignedPriest = parish?.priest || parish?.priestName;
  const assistantPriestNames = Array.isArray(parish?.assistantPriests)
    ? parish.assistantPriests.map((a) => a.name).filter(Boolean).join(", ")
    : "";
  const assignedSecretary = parish?.secretary || parish?.secretaryName;
  const pastoralMembers = parish?.councils?.pastoral?.members ?? [];
  const financeMembers = parish?.councils?.finance?.members ?? [];

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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: contentBottomInset() },
          ]}
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
          {/* Cover Image Banner */}
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
                  <StatusLabel label={parish.type} status="default" showDot={false} />
                ) : null}
                {parish.feastDay ? (
                  <StatusLabel
                    label={`Feast: ${parish.feastDay}`}
                    status="neutral"
                    showDot={false}
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
                    size={15}
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
                    size={15}
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
            {phoneUrl || emailUrl || mapUrl || safeFacebookUrl ? (
              <View style={styles.actionsBlock}>
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

                  {safeFacebookUrl ? (
                    <Button
                      title="Facebook"
                      variant="secondary"
                      size="sm"
                      icon="logo-facebook"
                      onPress={() => {
                        void openExternalUrl(safeFacebookUrl);
                      }}
                      accessibilityLabel={`Open Facebook page for ${parish.name}`}
                      style={styles.actionBtn}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Request Document & Schedule Appointment CTAs */}
            <View style={styles.requestCtaContainer}>
              <View style={styles.requestCtaHeader}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: spacing.xs }}
                />
                <View style={styles.requestCtaTextGroup}>
                  <Text style={styles.requestCtaTitle} allowFontScaling>
                    Parish Services & Requests
                  </Text>
                  <Text style={styles.requestCtaSubtitle} allowFontScaling>
                    Apply online for certificates or request a sacramental or mass schedule.
                  </Text>
                </View>
              </View>
              <View style={styles.ctaButtonRow}>
                {offeredDocuments.length > 0 ? (
                  <Button
                    title="Request Document"
                    variant="primary"
                    size="md"
                    icon="arrow-forward"
                    onPress={() => {
                      requireCompleteProfile(() => {
                        router.push(`/(app)/requests/new?parishId=${parish.id}` as any);
                      });
                    }}
                    accessibilityLabel={`Request document from ${parish.name}`}
                    style={styles.ctaButtonHalf}
                  />
                ) : null}
                <Button
                  title="Book Schedule"
                  variant={offeredDocuments.length > 0 ? "outline" : "primary"}
                  size="md"
                  icon="calendar-outline"
                  onPress={() => {
                    requireCompleteProfile(() => {
                      router.push(`/(app)/schedule/new?parishId=${parish.id}` as any);
                    });
                  }}
                  accessibilityLabel={`Book schedule at ${parish.name}`}
                  style={styles.ctaButtonHalf}
                />
              </View>
            </View>

            {/* About Description */}
            {parish.directoryDescription ? (
              <PageSection title="About the Parish" style={styles.sectionSpacing}>
                <Text style={styles.descriptionText} allowFontScaling>
                  {parish.directoryDescription}
                </Text>
              </PageSection>
            ) : null}

            {/* Office Hours */}
            {officeHoursRows.length > 0 ? (
              <RecordSection
                title="Parish Office Hours"
                fields={officeHoursRows.map((row) => ({
                  label: row.day,
                  value: row.hours,
                }))}
                style={styles.sectionSpacing}
              />
            ) : null}

            {/* Parish Administration */}
            {assignedPriest || assistantPriestNames || assignedSecretary || parish.venueCapacity ? (
              <RecordSection
                title="Parish Administration"
                fields={[
                  ...(assignedPriest ? [{ label: "Parish Priest", value: assignedPriest }] : []),
                  ...(assistantPriestNames
                    ? [{ label: "Assistant Priests", value: assistantPriestNames }]
                    : []),
                  ...(assignedSecretary
                    ? [{ label: "Parish Secretary", value: assignedSecretary }]
                    : []),
                  ...(parish.venueCapacity
                    ? [{ label: "Seating Capacity", value: `${parish.venueCapacity} people` }]
                    : []),
                ]}
                style={styles.sectionSpacing}
              />
            ) : null}

            {/* Offered Certificates */}
            {offeredDocuments.length > 0 ? (
              <PageSection title="Offered Certificates" style={styles.sectionSpacing}>
                <View style={styles.chipsWrap}>
                  {offeredDocuments.map((doc) => (
                    <StatusLabel
                      key={doc}
                      label={doc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      status="neutral"
                      showDot={false}
                    />
                  ))}
                </View>
              </PageSection>
            ) : null}

            {/* Parish Councils Summary */}
            {(pastoralMembers.length > 0 || financeMembers.length > 0) ? (
              <RecordSection
                title="Parish Pastoral & Finance Councils"
                fields={[
                  ...(pastoralMembers.length > 0
                    ? [
                        {
                          label: "Pastoral Council",
                          value: pastoralMembers
                            .slice(0, 5)
                            .map((m) => `${m.memberName} (${m.positionTitle})`)
                            .join(", ") +
                            (pastoralMembers.length > 5
                              ? ` +${pastoralMembers.length - 5} more`
                              : ""),
                        },
                      ]
                    : []),
                  ...(financeMembers.length > 0
                    ? [
                        {
                          label: "Finance Council",
                          value: financeMembers
                            .slice(0, 5)
                            .map((m) => `${m.memberName} (${m.positionTitle})`)
                            .join(", ") +
                            (financeMembers.length > 5
                              ? ` +${financeMembers.length - 5} more`
                              : ""),
                        },
                      ]
                    : []),
                ]}
                style={styles.sectionSpacing}
              />
            ) : null}

            {/* Parish Public Events */}
            <UpcomingEventsSection
              parishId={parish.id}
              title="Events at this Parish"
              subtitle="Public events and masses scheduled this month"
              hideParishName={true}
              style={styles.sectionSpacing}
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
  },
  contentPadding: {
    padding: spacing.md,
  },
  imageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfaceVariant,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  headerBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  parishTitle: {
    ...fontStyles.heading,
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
    fontWeight: "600",
    flex: 1,
  },
  addressText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  actionsBlock: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  actionsTitle: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: "600",
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
  requestCtaContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  requestCtaHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  requestCtaTextGroup: {
    flex: 1,
  },
  requestCtaTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  requestCtaSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionSpacing: {
    marginBottom: spacing.md,
  },
  descriptionText: {
    ...fontStyles.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  ctaButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ctaButtonHalf: {
    flex: 1,
    minWidth: 140,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
