import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { RecordSection } from "@/components/ui/RecordSection";
import { Divider } from "@/components/ui/Divider";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRespondReschedule, useScheduleDetail } from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  isRescheduleProposalPending,
} from "./presentation";
import { getScheduleEventLabel } from "./types";

export const ScheduleDetailScreen: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: schedule,
    isLoading,
    error,
    refetch,
  } = useScheduleDetail(id);

  const respondMutation = useRespondReschedule();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(schedule)" as any);
    }
  };

  const handleRespond = (accept: boolean) => {
    if (!id) return;
    setActionError(null);
    if (typeof schedule?.version !== "number") {
      const message = "The schedule version is unavailable. Refreshing the latest details.";
      setActionError(message);
      void refetch();
      Alert.alert("Refresh Required", message);
      return;
    }

    const expectedVersion = schedule.version;
    const actionText = accept ? "Accept" : "Decline";

    Alert.alert(
      `${actionText} Proposed Reschedule`,
      accept
        ? "Are you sure you want to accept this alternative schedule date?"
        : "Are you sure you want to decline this proposal? This will cancel the schedule request.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: actionText,
          style: accept ? "default" : "destructive",
          onPress: async () => {
            try {
              await respondMutation.mutateAsync({
                scheduleId: id,
                accept,
                expectedVersion,
              });
              Alert.alert(
                accept ? "Reschedule Accepted" : "Proposal Declined",
                accept
                  ? "Your schedule has been confirmed for the proposed time."
                  : "The reschedule proposal has been declined and the schedule request cancelled."
              );
            } catch (err: any) {
              const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to respond to reschedule proposal. Please try again.";
              setActionError(msg);
              Alert.alert("Action Failed", msg);
              void refetch();
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader title="Schedule Details" onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <Skeleton height={100} borderRadius={radii.md} />
          <Skeleton height={140} borderRadius={radii.md} />
          <Skeleton height={120} borderRadius={radii.md} />
        </View>
      </Screen>
    );
  }

  if (error || !schedule) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader title="Schedule Details" onBack={handleBack} />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Schedule Not Found"
            description="The requested schedule could not be loaded or you do not have permission to view it."
            actionLabel="Go Back"
            onAction={handleBack}
          />
        </View>
      </Screen>
    );
  }

  const eventLabel = getScheduleEventLabel(schedule.eventType);
  const dateFormatted = formatScheduleDate(schedule.requestedDate, "full");
  const timeSlot = extractTimeSlotFromSchedule(schedule);
  const hasProposal = isRescheduleProposalPending(schedule.status);
  const hasPriestAssigned = Boolean(schedule.assignedPriestId);
  const isPriestAccepted = hasPriestAssigned && schedule.priestResponseStatus === "ACCEPTED";
  const canAcceptReschedule = hasProposal && isPriestAccepted;
  const bottomInset = contentBottomInset("none");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule Details"
        subtitle={`#SCH-${schedule.id}`}
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.lg }]}
      >
        <ContentColumn style={styles.column}>
          {/* Identity Header */}
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.titleWrap}>
                <Text style={styles.titleText} allowFontScaling>
                  {schedule.displayTitle || eventLabel}
                </Text>
                {schedule.displayTitle && schedule.displayTitle !== eventLabel ? (
                  <Text style={styles.subtitleText} allowFontScaling>
                    {eventLabel}
                  </Text>
                ) : null}
              </View>
              <StatusLabel status={schedule.status} />
            </View>
          </View>

          {/* Action Required: Reschedule Proposal Block */}
          {hasProposal && (
            <View style={styles.proposalBox}>
              <View style={styles.proposalHeader}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.proposalTitle} allowFontScaling>
                  Alternative Schedule Proposed
                </Text>
              </View>

              <Text style={styles.proposalDesc} allowFontScaling>
                Parish staff has proposed an alternative date and time for your schedule:
              </Text>

              <View style={styles.proposedDetailBox}>
                <View style={styles.proposedRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.proposedText} allowFontScaling>
                    {formatScheduleDate(schedule.proposedDate, "full")}
                  </Text>
                </View>
                {schedule.proposedStartDatetime ? (
                  <View style={styles.proposedRow}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.proposedText} allowFontScaling>
                      {new Date(schedule.proposedStartDatetime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>

              {schedule.rescheduleReason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel} allowFontScaling>
                    Staff Note:
                  </Text>
                  <Text style={styles.reasonText} allowFontScaling>
                    {schedule.rescheduleReason}
                  </Text>
                </View>
              ) : null}

              {!isPriestAccepted ? (
                <View style={styles.priestGateNotice}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
                  <View style={styles.priestGateContent}>
                    <Text style={styles.priestGateTitle} allowFontScaling>
                      Waiting for Celebrant Confirmation
                    </Text>
                    <Text style={styles.priestGateText} allowFontScaling>
                      You can review this proposal now. Final acceptance will become available as soon as the assigned celebrant confirms availability.
                    </Text>
                  </View>
                </View>
              ) : null}

              {actionError ? (
                <Text style={styles.actionErrorText} allowFontScaling>
                  {actionError}
                </Text>
              ) : null}

              <View style={styles.proposalActions}>
                <Button
                  title="Decline Proposal"
                  variant="outline"
                  size="md"
                  onPress={() => handleRespond(false)}
                  loading={respondMutation.isPending}
                  style={styles.proposalBtn}
                />
                <Button
                  title="Accept Alternative"
                  variant="primary"
                  size="md"
                  onPress={() => handleRespond(true)}
                  disabled={!canAcceptReschedule || respondMutation.isPending}
                  loading={respondMutation.isPending}
                  style={styles.proposalBtn}
                />
              </View>
            </View>
          )}

          <Divider />

          {/* Record Section 1: Appointment Details */}
          <RecordSection
            title="Appointment Details"
            fields={[
              { label: "Service / Sacrament", value: eventLabel },
              { label: "Requested Date", value: dateFormatted },
              { label: "Time Slot", value: timeSlot },
              ...(schedule.remarks
                ? [{ label: "Remarks & Notes", value: schedule.remarks }]
                : []),
            ]}
          />

          <Divider />

          {/* Record Section 2: Celebrant Details */}
          <RecordSection
            title="Celebrant Information"
            fields={[
              ...(schedule.requestedPriest?.name
                ? [{ label: "Preferred Celebrant", value: `${schedule.requestedPriest.name} (Preference)` }]
                : []),
              {
                label: "Assigned Celebrant",
                value: schedule.assignedPriest?.fullName || "To be assigned by parish",
              },
            ]}
          />

          <Divider />

          {/* Record Section 3: Parish Location */}
          <RecordSection
            title="Parish Information"
            fields={[
              { label: "Parish Name", value: schedule.parish?.parishName || "Parish" },
              ...(schedule.parish?.municipalityCity
                ? [
                    {
                      label: "Location",
                      value: `${schedule.parish.municipalityCity}${
                        schedule.parish.province ? `, ${schedule.parish.province}` : ""
                      }`,
                    },
                  ]
                : []),
              ...(schedule.parish?.contactNumber
                ? [{ label: "Office Contact", value: schedule.parish.contactNumber }]
                : []),
            ]}
          />
        </ContentColumn>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  column: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  headerBlock: {
    paddingHorizontal: spacing.xxs,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleWrap: {
    flex: 1,
  },
  titleText: {
    ...fontStyles.titleSerif,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
  },
  subtitleText: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proposalBox: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  proposalTitle: {
    ...fontStyles.captionBold,
    color: colors.primary,
    fontSize: 15,
  },
  proposalDesc: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  proposedDetailBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  proposedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  proposedText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  reasonBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: 2,
  },
  reasonLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  reasonText: {
    ...fontStyles.caption,
    color: colors.textPrimary,
  },
  priestGateNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  priestGateContent: {
    flex: 1,
    gap: 2,
  },
  priestGateTitle: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  priestGateText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  actionErrorText: {
    ...fontStyles.caption,
    color: colors.danger,
  },
  proposalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  proposalBtn: {
    flex: 1,
  },
});
