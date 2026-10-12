import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { useAvailableSlots, useProposeAlternativeDate, useRespondReschedule, useScheduleDetail, useWithdrawAlternativeDate } from "./api";
import {
  extractTimeSlotFromSchedule,
  formatScheduleDate,
  isRescheduleProposalPending,
  getScheduleDisplayTitle,
} from "./presentation";
import { getScheduleEventLabel } from "./types";

export const ScheduleDetailScreen: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [actionError, setActionError] = useState<string | null>(null);
  const [alternativeDate, setAlternativeDate] = useState("");
  const [alternativeSlot, setAlternativeSlot] = useState("");
  const [alternativeNote, setAlternativeNote] = useState("");

  const {
    data: schedule,
    isLoading,
    error,
    refetch,
  } = useScheduleDetail(id);

  const respondMutation = useRespondReschedule();
  const proposeAlternativeMutation = useProposeAlternativeDate();
  const withdrawAlternativeMutation = useWithdrawAlternativeDate();
  const { data: alternativeSlots = [] } = useAvailableSlots(
    schedule?.parishId,
    alternativeDate || null,
    schedule?.eventType,
    { enabled: Boolean(schedule?.canProposeAlternativeDate && alternativeDate) }
  );

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

  const handleAlternativeSubmit = async () => {
    if (!schedule || !alternativeDate || !alternativeSlot) return;
    setActionError(null);
    try {
      await proposeAlternativeMutation.mutateAsync({
        scheduleId: schedule.id,
        proposedDate: alternativeDate,
        timeSlot: alternativeSlot,
        note: alternativeNote,
      });
      setAlternativeDate("");
      setAlternativeSlot("");
      setAlternativeNote("");
      Alert.alert("Request Submitted", "The original appointment remains unchanged while parish staff reviews your alternative date.");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Unable to submit the alternative date.";
      setActionError(message);
      Alert.alert("Request Failed", message);
    }
  };

  const handleAlternativeWithdraw = async () => {
    if (!schedule?.alternativeProposal) return;
    try {
      await withdrawAlternativeMutation.mutateAsync({
        scheduleId: schedule.id,
        proposalId: schedule.alternativeProposal.id,
        expectedRevision: schedule.alternativeProposal.nominationRevision,
      });
      Alert.alert("Request Withdrawn", "The original appointment remains unchanged.");
    } catch (err: any) {
      Alert.alert("Action Failed", err?.response?.data?.message || err?.message || "Unable to withdraw the request.");
    }
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
                  {getScheduleDisplayTitle(schedule)}
                </Text>
                {getScheduleDisplayTitle(schedule) !== eventLabel ? (
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

          {schedule.layMinisterAssigned ? (
            <View style={styles.layMinisterBox}>
              <View style={styles.proposalHeader}>
                <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
                <Text style={styles.layMinisterTitle} allowFontScaling>Lay Minister Assigned</Text>
              </View>
              <Text style={styles.proposalDesc} allowFontScaling>
                No priest was available for the current appointment. This service remains scheduled and will be led by a Lay Minister.
              </Text>
              {schedule.alternativeProposal && ["SUBMITTED", "PRIEST_PENDING"].includes(schedule.alternativeProposal.status) ? (
                <View style={styles.alternativeForm}>
                  <Text style={styles.proposedText} allowFontScaling>
                    Alternative date status: {schedule.alternativeProposal.status === "PRIEST_PENDING" ? "Awaiting nominated priest" : "Awaiting parish review"}
                  </Text>
                  <Button
                    title="Withdraw Alternative Request"
                    variant="outline"
                    size="md"
                    onPress={() => void handleAlternativeWithdraw()}
                    loading={withdrawAlternativeMutation.isPending}
                  />
                </View>
              ) : schedule.canProposeAlternativeDate ? (
                <View style={styles.alternativeForm}>
                  <TextInput
                    value={alternativeDate}
                    onChangeText={(value) => {
                      setAlternativeDate(value);
                      setAlternativeSlot("");
                    }}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    style={styles.alternativeInput}
                    accessibilityLabel="Alternative date"
                  />
                  <View style={styles.slotWrap}>
                    {alternativeSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => setAlternativeSlot(slot)}
                        style={[styles.slotChip, alternativeSlot === slot && styles.slotChipSelected]}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.slotChipText, alternativeSlot === slot && styles.slotChipTextSelected]}>{slot}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={alternativeNote}
                    onChangeText={setAlternativeNote}
                    placeholder="Optional note to parish staff"
                    maxLength={1000}
                    multiline
                    style={[styles.alternativeInput, styles.alternativeNote]}
                    accessibilityLabel="Alternative date note"
                  />
                  <Button
                    title="Request Priest-Led Alternative"
                    size="md"
                    onPress={() => void handleAlternativeSubmit()}
                    disabled={!alternativeDate || !alternativeSlot}
                    loading={proposeAlternativeMutation.isPending}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <Divider />

          {/* Record Section 1: Appointment Details */}
          <RecordSection
            title="Appointment Details"
            fields={[
              { label: "Service / Sacrament", value: getScheduleDisplayTitle(schedule) },
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
                value: schedule.layMinisterAssigned
                  ? "Lay Minister"
                  : (schedule.assignedPriest?.fullName || "To be assigned by parish"),
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
  layMinisterBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.md,
    gap: spacing.sm,
  },
  layMinisterTitle: {
    ...fontStyles.captionBold,
    color: "#92400E",
    fontSize: 15,
  },
  alternativeForm: {
    gap: spacing.sm,
  },
  alternativeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...fontStyles.bodySmall,
  },
  alternativeNote: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  slotWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  slotChip: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  slotChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotChipText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  slotChipTextSelected: {
    color: colors.textInverse,
  },
});
