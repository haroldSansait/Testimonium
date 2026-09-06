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
import { AppHeader, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRespondReschedule, useScheduleDetail } from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
} from "./presentation";
import { getScheduleEventLabel } from "./types";

export const ScheduleDetailScreen: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
              // Cleanly refetch schedule state on failure/race
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
        <View style={styles.content}>
          <Skeleton height={140} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={180} borderRadius={radii.md} style={styles.skeleton} />
          <Skeleton height={120} borderRadius={radii.md} style={styles.skeleton} />
        </View>
      </Screen>
    );
  }

  if (error || !schedule) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader title="Schedule Details" onBack={handleBack} />
        <View style={styles.errorContainer}>
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

  const badge = getScheduleStatusBadge(schedule.status);
  const eventLabel = getScheduleEventLabel(schedule.eventType);
  const dateFormatted = formatScheduleDate(schedule.requestedDate, "full");
  const timeSlot = extractTimeSlotFromSchedule(schedule);
  const hasProposal = isRescheduleProposalPending(schedule.status);
  const hasPriestAssigned = Boolean(schedule.assignedPriestId);
  const isPriestAccepted = hasPriestAssigned && schedule.priestResponseStatus === "ACCEPTED";
  const canAcceptReschedule = hasProposal && isPriestAccepted;

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule Details"
        subtitle={`#SCH-${schedule.id}`}
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Header Card */}
        <Card style={styles.mainCard}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: badge.bg, borderColor: badge.border },
              ]}
            >
              <Text style={[styles.statusText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          <Text style={styles.titleText}>
            {schedule.displayTitle || eventLabel}
          </Text>
          {schedule.displayTitle && schedule.displayTitle !== eventLabel && (
            <Text style={styles.subtitleText}>{eventLabel}</Text>
          )}
        </Card>

        {/* Action Required Reschedule Proposal Card */}
        {hasProposal && (
          <Card style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Ionicons name="notifications" size={20} color="#1E40AF" />
              <Text style={styles.proposalTitle}>
                Alternative Date Proposed
              </Text>
            </View>

            <Text style={styles.proposalDescription}>
              The parish staff has proposed an alternative schedule for your request:
            </Text>

            <View style={styles.proposedTimeBox}>
              <View style={styles.proposedRow}>
                <Ionicons name="calendar" size={16} color="#1E40AF" />
                <Text style={styles.proposedText}>
                  {formatScheduleDate(schedule.proposedDate, "full")}
                </Text>
              </View>
              {schedule.proposedStartDatetime && (
                <View style={styles.proposedRow}>
                  <Ionicons name="time" size={16} color="#1E40AF" />
                  <Text style={styles.proposedText}>
                    {new Date(schedule.proposedStartDatetime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
            </View>

            {schedule.rescheduleReason && (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Staff Note:</Text>
                <Text style={styles.reasonText}>{schedule.rescheduleReason}</Text>
              </View>
            )}

            {!isPriestAccepted && (
              <View style={styles.priestGateBox}>
                <Ionicons name="time-outline" size={16} color="#1E40AF" />
                <View style={styles.priestGateContent}>
                  <Text style={styles.priestGateTitle}>Waiting for Priest Acceptance</Text>
                  <Text style={styles.priestGateText}>
                    You can review the proposed date and time, but final acceptance will become available once the assigned priest accepts the schedule.
                  </Text>
                </View>
              </View>
            )}

            {actionError && (
              <Text style={styles.actionErrorText}>{actionError}</Text>
            )}

            <View style={styles.proposalActions}>
              <Button
                title="Decline"
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
                style={[styles.proposalBtn, !canAcceptReschedule && styles.disabledBtn]}
              />
            </View>
          </Card>
        )}

        {/* Schedule Timing & Location */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Schedule Information</Text>

          <View style={styles.detailRow}>
            <View style={styles.iconCol}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Requested Date</Text>
              <Text style={styles.detailValue}>{dateFormatted}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.iconCol}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Time Slot</Text>
              <Text style={styles.detailValue}>{timeSlot}</Text>
            </View>
          </View>

          {schedule.assignedPriest?.fullName && (
            <View style={styles.detailRow}>
              <View style={styles.iconCol}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Assigned Celebrant / Priest</Text>
                <Text style={styles.detailValue}>
                  {schedule.assignedPriest.fullName}
                </Text>
              </View>
            </View>
          )}

          {schedule.remarks && (
            <View style={styles.detailRow}>
              <View style={styles.iconCol}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Remarks & Notes</Text>
                <Text style={styles.detailValue}>{schedule.remarks}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Parish Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Parish Location</Text>

          <View style={styles.detailRow}>
            <View style={styles.iconCol}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Parish Name</Text>
              <Text style={styles.detailValue}>
                {schedule.parish?.parishName || "Parish"}
              </Text>
              {schedule.parish?.municipalityCity && (
                <Text style={styles.detailSubValue}>
                  {schedule.parish.municipalityCity}
                  {schedule.parish.province ? `, ${schedule.parish.province}` : ""}
                </Text>
              )}
            </View>
          </View>

          {schedule.parish?.contactNumber && (
            <View style={styles.detailRow}>
              <View style={styles.iconCol}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailTextCol}>
                <Text style={styles.detailLabel}>Parish Office Contact</Text>
                <Text style={styles.detailValue}>{schedule.parish.contactNumber}</Text>
              </View>
            </View>
          )}
        </Card>
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
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  skeleton: {
    marginBottom: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  mainCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderColor: colors.cardBorder,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusText: {
    ...fontStyles.caption,
    fontWeight: "700",
    fontSize: 12,
  },
  titleText: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  subtitleText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proposalCard: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    padding: spacing.md,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  proposalTitle: {
    ...fontStyles.subheading,
    color: "#1E40AF",
    fontWeight: "700",
  },
  proposalDescription: {
    ...fontStyles.bodySmall,
    color: "#1E3A8A",
    marginBottom: spacing.sm,
  },
  proposedTimeBox: {
    backgroundColor: "#DBEAFE",
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: 4,
    marginBottom: spacing.sm,
  },
  proposedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  proposedText: {
    ...fontStyles.body,
    fontWeight: "700",
    color: "#1E40AF",
  },
  reasonBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.xs,
    marginBottom: spacing.md,
  },
  reasonLabel: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textMuted,
  },
  reasonText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  actionErrorText: {
    ...fontStyles.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  priestGateBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.xs,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  priestGateContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  priestGateTitle: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  priestGateText: {
    ...fontStyles.caption,
    color: "#1E40AF",
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  proposalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  proposalBtn: {
    flex: 1,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderColor: colors.cardBorder,
  },
  sectionTitle: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  iconCol: {
    width: 28,
    alignItems: "center",
    marginTop: 2,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  detailValue: {
    ...fontStyles.body,
    color: colors.textPrimary,
    fontWeight: "600",
    marginTop: 1,
  },
  detailSubValue: {
    ...fontStyles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
