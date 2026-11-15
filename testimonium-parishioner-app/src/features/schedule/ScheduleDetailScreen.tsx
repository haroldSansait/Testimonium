import { useScreenRefresh } from "@/hooks/useAutomaticRefresh";
import React, { useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/Typography";
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
import { SecureFileViewerModal } from "@/components/files/SecureFileViewerModal";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useAvailabilityDates,
  useAvailableSlots,
  useEligiblePriests,
  useProposeAlternativeDate,
  useRequestPriestChange,
  useRespondReschedule,
  useScheduleAttachments,
  useScheduleDetail,
  useWithdrawAlternativeDate,
} from "./api";
import { SchedulingCalendar } from "./components/SchedulingCalendar";
import {
  extractTimeSlotFromSchedule,
  formatManilaTimestamp,
  formatScheduleConfirmationRef,
  formatScheduleDate,
  getScheduleMilestones,
  getScheduleRejectionReasonLabel,
  getScheduleStatusBadge,
  isRescheduleProposalPending,
  getScheduleDisplayTitle,
} from "./presentation";
import { getScheduleEventLabel, type ScheduleAttachment } from "./types";

export const ScheduleDetailScreen: React.FC = () => {
  const router = useRouter();
  const refreshOptions = useScreenRefresh();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contentBottomInset } = useAppLayoutMetrics();
  const [actionError, setActionError] = useState<string | null>(null);
  const [alternativeDate, setAlternativeDate] = useState("");
  const [alternativeSlot, setAlternativeSlot] = useState("");
  const [alternativeNote, setAlternativeNote] = useState("");
  const [viewerAttachment, setViewerAttachment] = useState<ScheduleAttachment | null>(null);
  const [priestChangeFormScheduleId, setPriestChangeFormScheduleId] = useState<number | null>(null);
  const [replacementPriestId, setReplacementPriestId] = useState<number | null>(null);
  const [priestChangeNote, setPriestChangeNote] = useState("");
  const [priestChangeError, setPriestChangeError] = useState<string | null>(null);
  const [priestChangeSuccessScheduleId, setPriestChangeSuccessScheduleId] = useState<number | null>(null);
  const [priestChangeSuccess, setPriestChangeSuccess] = useState<string | null>(null);
  const priestChangeInFlightRef = useRef(false);

  const {
    data: schedule,
    isLoading,
    refetch,
  } = useScheduleDetail(id, { ...refreshOptions, enabled: refreshOptions.enabled && Boolean(id) });
  const activeScheduleIdRef = useRef(schedule?.id);
  useLayoutEffect(() => {
    activeScheduleIdRef.current = schedule?.id;
  }, [schedule?.id]);

  const attachmentsQuery = useScheduleAttachments(id, {
    enabled: Boolean(id && schedule),
  });

  const respondMutation = useRespondReschedule();
  const proposeAlternativeMutation = useProposeAlternativeDate();
  const withdrawAlternativeMutation = useWithdrawAlternativeDate();
  const requestPriestChangeMutation = useRequestPriestChange();

  const showPriestChangeForm = Boolean(
    schedule?.id && priestChangeFormScheduleId === schedule.id
  );
  const visiblePriestChangeSuccess =
    schedule?.id && priestChangeSuccessScheduleId === schedule.id ? priestChangeSuccess : null;

  const eligiblePriestsQuery = useEligiblePriests(schedule?.parishId, {
    enabled: Boolean(schedule?.parishId && showPriestChangeForm),
  });

  const datesQuery = useAvailabilityDates(
    schedule?.parishId,
    schedule?.eventType,
    { enabled: Boolean(schedule?.layMinisterAssigned && schedule?.canProposeAlternativeDate) }
  );
  const availableDates = datesQuery.data?.dates || [];

  const slotsQuery = useAvailableSlots(
    schedule?.parishId,
    alternativeDate || null,
    schedule?.eventType,
    { enabled: Boolean(schedule?.canProposeAlternativeDate && alternativeDate) }
  );
  const alternativeSlots = slotsQuery.data || [];

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

  const handleAlternativeWithdraw = () => {
    const proposal = schedule?.alternativeProposal;
    if (!schedule || !proposal) return;
    Alert.alert(
      "Withdraw Alternative Request",
      "Are you sure you want to withdraw this alternative date request? Your original appointment will remain unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw Request",
          style: "destructive",
          onPress: async () => {
            try {
              await withdrawAlternativeMutation.mutateAsync({
                scheduleId: schedule.id,
                proposalId: proposal.id,
                expectedRevision: proposal.nominationRevision,
              });
              Alert.alert("Request Withdrawn", "The original appointment remains unchanged.");
            } catch (err: any) {
              Alert.alert("Action Failed", err?.response?.data?.message || err?.message || "Unable to withdraw the request.");
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

  if (!schedule) {
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
  const confirmationRef = formatScheduleConfirmationRef(schedule.id, schedule.createdAt);
  const dateFormatted = formatScheduleDate(schedule.requestedDate, "full");
  const timeSlot = extractTimeSlotFromSchedule(schedule);
  const hasProposal = isRescheduleProposalPending(schedule.status);
  const hasPriestAssigned = Boolean(schedule.assignedPriestId);
  const isPriestAccepted = hasPriestAssigned && schedule.priestResponseStatus === "ACCEPTED";
  const canAcceptReschedule = hasProposal && isPriestAccepted;
  const milestones = getScheduleMilestones(schedule);
  const rescheduleHistory = schedule.rescheduleHistory ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const bottomInset = contentBottomInset("none");
  const candidateReplacementPriests = (eligiblePriestsQuery.data ?? []).filter(
    (p) => Number(p.id) !== Number(schedule.assignedPriestId || 0)
  );
  const canRequestPriestChange = Boolean(
    !schedule.layMinisterAssigned
      && schedule.assignedPriestId
      && ["PENDING", "REQUESTED", "CONFIRMED"].includes(schedule.status)
  );
  const requestedReplacementName =
    schedule.priestChangeRequestedPriest?.name
    || schedule.priestChangeRequestedPriest?.fullName
    || null;

  const handleOpenPriestChange = () => {
    if (!schedule?.id) return;
    setPriestChangeFormScheduleId(schedule.id);
    setReplacementPriestId(null);
    setPriestChangeNote("");
    setPriestChangeError(null);
    setPriestChangeSuccessScheduleId(null);
    setPriestChangeSuccess(null);
  };

  const handleSubmitPriestChange = async () => {
    if (!schedule || priestChangeInFlightRef.current || requestPriestChangeMutation.isPending) {
      return;
    }
    if (!replacementPriestId) {
      setPriestChangeError("Please select a preferred replacement priest.");
      return;
    }
    if (typeof schedule.version !== "number") {
      setPriestChangeError("The schedule version is unavailable. Refreshing the latest details.");
      void refetch();
      return;
    }
    priestChangeInFlightRef.current = true;
    setPriestChangeError(null);
    setPriestChangeSuccessScheduleId(null);
    setPriestChangeSuccess(null);
    try {
      await requestPriestChangeMutation.mutateAsync({
        scheduleId: schedule.id,
        replacementPriestId,
        note: priestChangeNote.trim() || null,
        expectedVersion: schedule.version,
      });
      if (activeScheduleIdRef.current !== schedule.id) return;
      setPriestChangeFormScheduleId(null);
      setReplacementPriestId(null);
      setPriestChangeNote("");
      setPriestChangeSuccessScheduleId(schedule.id);
      setPriestChangeSuccess(
        "Priest change requested. Your parish secretary will review and assign the appropriate priest."
      );
      void refetch();
    } catch (err: any) {
      if (activeScheduleIdRef.current !== schedule.id) return;
      const msg =
        err?.message ||
        "Unable to submit your priest change request right now.";
      setPriestChangeError(msg);
      void refetch();
    } finally {
      priestChangeInFlightRef.current = false;
    }
  };

  const handleCallSecretary = async (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/[^+\d]/g, "");
    if (!cleaned) return;
    const url = `tel:${cleaned}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Ignore dialer errors gracefully; number remains visible on screen.
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule Details"
        subtitle={confirmationRef || `Schedule #${schedule.id}`}
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
              {schedule.status === "REJECTED" ? (
                (() => {
                  const badge = getScheduleStatusBadge(schedule.status);
                  return (
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        borderColor: badge.border,
                        borderWidth: 1,
                        borderRadius: radii.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                      }}
                      accessibilityLabel={`Status: ${badge.label}`}
                    >
                      <Text
                        style={{
                          ...fontStyles.caption,
                          color: badge.text,
                          fontWeight: "600",
                        }}
                        allowFontScaling
                      >
                        {badge.label}
                      </Text>
                    </View>
                  );
                })()
              ) : (
                <StatusLabel status={schedule.status} />
              )}
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
              <View style={styles.layMinisterHeader}>
                <Ionicons name="information-circle" size={22} color={colors.warning} />
                <View style={styles.layMinisterHeaderText}>
                  <Text style={styles.layMinisterTitle} allowFontScaling>
                    Lay Minister Assigned
                  </Text>
                  <Text style={styles.layMinisterSubtitle} allowFontScaling>
                    Liturgy of the Word / Non-celebrant appointment
                  </Text>
                </View>
              </View>
              <Text style={styles.layMinisterDesc} allowFontScaling>
                No priest was available for the current appointment. This service remains scheduled and will be led by an authorized Lay Minister.
              </Text>

              {schedule.alternativeProposal && ["SUBMITTED", "PRIEST_PENDING"].includes(schedule.alternativeProposal.status) ? (
                <View style={styles.proposalStatusCard}>
                  <View style={styles.proposalStatusHeader}>
                    <Text style={styles.proposalStatusCardTitle} allowFontScaling>
                      Alternative Date Request
                    </Text>
                    <View style={[
                      styles.proposalBadge,
                      schedule.alternativeProposal.status === "PRIEST_PENDING"
                        ? styles.proposalBadgePriest
                        : styles.proposalBadgeParish
                    ]}>
                      <Text style={[
                        styles.proposalBadgeText,
                        schedule.alternativeProposal.status === "PRIEST_PENDING"
                          ? styles.proposalBadgeTextPriest
                          : styles.proposalBadgeTextParish
                      ]} allowFontScaling>
                        {schedule.alternativeProposal.status === "PRIEST_PENDING"
                          ? "Awaiting Priest Acceptance"
                          : "Awaiting Parish Review"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.proposalDetailList}>
                    <View style={styles.proposedRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text style={styles.proposalDetailValue} allowFontScaling>
                        {formatScheduleDate(schedule.alternativeProposal.proposedDate, "full")}
                      </Text>
                    </View>
                    {schedule.alternativeProposal.proposedStartDatetime ? (
                      <View style={styles.proposedRow}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.proposalDetailValue} allowFontScaling>
                          {new Date(schedule.alternativeProposal.proposedStartDatetime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.proposalNoticeText} allowFontScaling>
                    {schedule.alternativeProposal.status === "PRIEST_PENDING"
                      ? "Parish staff has nominated an available celebrant. Confirmation is pending priest acceptance."
                      : "Parish staff is reviewing priest availability for your requested date."}
                  </Text>

                  {schedule.alternativeProposal.note ? (
                    <View style={styles.proposalNoteCard}>
                      <Text style={styles.proposalNoteLabel} allowFontScaling>Your Note:</Text>
                      <Text style={styles.proposalNoteText} allowFontScaling>
                        {schedule.alternativeProposal.note}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.proposalDivider} />
                  <Text style={styles.proposalDisclaimerText} allowFontScaling>
                    Your original appointment remains active until this alternative is confirmed.
                  </Text>
                  <Button
                    title="Withdraw Alternative Request"
                    variant="outline"
                    size="md"
                    onPress={handleAlternativeWithdraw}
                    loading={withdrawAlternativeMutation.isPending}
                    disabled={withdrawAlternativeMutation.isPending}
                    style={styles.withdrawBtn}
                  />
                </View>
              ) : schedule.canProposeAlternativeDate ? (
                <View style={styles.alternativeCard}>
                  <View style={styles.alternativeHeader}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alternativeCardTitle} allowFontScaling>
                        Prefer a Priest-Led Service? (Optional)
                      </Text>
                      <Text style={styles.alternativeCardSubtitle} allowFontScaling>
                        If your service requires a priest, you may propose an alternative date and time below. Your original appointment remains scheduled unless the alternative is confirmed.
                      </Text>
                    </View>
                  </View>

                  {/* 1. Calendar Date Selection */}
                  <View style={styles.sectionBlock}>
                    <Text style={styles.inputStepLabel} allowFontScaling>
                      1. SELECT AN AVAILABLE DATE
                    </Text>

                    {datesQuery.isLoading ? (
                      <View style={styles.calendarLoadingContainer}>
                        <Skeleton height={260} borderRadius={radii.md} />
                        <Text style={styles.loadingCaption} allowFontScaling>
                          Loading available parish calendar dates…
                        </Text>
                      </View>
                    ) : datesQuery.isError ? (
                      <View style={styles.availabilityErrorBox}>
                        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                        <Text style={styles.availabilityErrorText} allowFontScaling>
                          Unable to load calendar availability.
                        </Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => void datesQuery.refetch()}
                          style={styles.retryChip}
                        >
                          <Text style={styles.retryChipText} allowFontScaling>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : availableDates.length === 0 ? (
                      <View style={styles.availabilityEmptyBox}>
                        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.availabilityEmptyText} allowFontScaling>
                          No alternative dates are currently open for this service. You may contact the parish office directly.
                        </Text>
                      </View>
                    ) : (
                      <SchedulingCalendar
                        selectedDate={alternativeDate}
                        onSelectDate={(date) => {
                          setAlternativeDate(date);
                          setAlternativeSlot("");
                        }}
                        availableDates={availableDates}
                        helperText="Tap an available date to view time slots."
                      />
                    )}
                  </View>

                  {/* 2. Time Slot Selection */}
                  {alternativeDate ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.inputStepLabel} allowFontScaling>
                        2. SELECT TIME SLOT ON {alternativeDate}
                      </Text>

                      {slotsQuery.isLoading ? (
                        <View style={styles.slotsLoadingContainer}>
                          <Skeleton height={44} borderRadius={radii.sm} />
                          <Text style={styles.loadingCaption} allowFontScaling>
                            Checking slot availability…
                          </Text>
                        </View>
                      ) : slotsQuery.isError ? (
                        <View style={styles.availabilityErrorBox}>
                          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                          <Text style={styles.availabilityErrorText} allowFontScaling>
                            Failed to load time slots for this date.
                          </Text>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => void slotsQuery.refetch()}
                            style={styles.retryChip}
                          >
                            <Text style={styles.retryChipText} allowFontScaling>Retry</Text>
                          </TouchableOpacity>
                        </View>
                      ) : alternativeSlots.length === 0 ? (
                        <View style={styles.availabilityEmptyBox}>
                          <Text style={styles.availabilityEmptyText} allowFontScaling>
                            No time slots available for the selected date. Please choose another date.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.slotWrap}>
                          {alternativeSlots.map((slot) => {
                            const isSelected = alternativeSlot === slot;
                            return (
                              <TouchableOpacity
                                key={slot}
                                onPress={() => setAlternativeSlot(slot)}
                                style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                                accessibilityRole="button"
                                accessibilityLabel={`Time slot ${slot}${isSelected ? ", selected" : ""}`}
                                accessibilityState={{ selected: isSelected }}
                              >
                                <Ionicons
                                  name={isSelected ? "time" : "time-outline"}
                                  size={14}
                                  color={isSelected ? colors.textInverse : colors.primary}
                                />
                                <Text style={[styles.slotChipText, isSelected && styles.slotChipTextSelected]} allowFontScaling>
                                  {slot}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* 3. Optional Note */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.noteLabelRow}>
                      <Text style={styles.inputStepLabel} allowFontScaling>
                        3. NOTE TO PARISH STAFF (OPTIONAL)
                      </Text>
                      <Text style={styles.charCountText} allowFontScaling>
                        {alternativeNote.length}/1000
                      </Text>
                    </View>
                    <TextInput
                      value={alternativeNote}
                      onChangeText={setAlternativeNote}
                      placeholder="e.g., Requesting Father's availability for a family anniversary blessing"
                      placeholderTextColor={colors.textMuted}
                      maxLength={1000}
                      multiline
                      style={[styles.alternativeInput, styles.alternativeNote]}
                      accessibilityLabel="Optional note for alternative date request"
                    />
                  </View>

                  <Button
                    title="Request Priest-Led Alternative"
                    size="md"
                    onPress={() => void handleAlternativeSubmit()}
                    disabled={!alternativeDate || !alternativeSlot || proposeAlternativeMutation.isPending}
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
              ...(confirmationRef
                ? [{ label: "Confirmation No.", value: confirmationRef }]
                : []),
              { label: "Service / Sacrament", value: getScheduleDisplayTitle(schedule) },
              { label: "Requested Date", value: dateFormatted },
              { label: "Time Slot", value: timeSlot },
              ...(schedule.location
                ? [{ label: "Venue / Location", value: schedule.location }]
                : []),
              ...(schedule.remarks
                ? [{ label: "Remarks & Notes", value: schedule.remarks }]
                : []),
            ]}
          />

          {schedule.status === "REJECTED" ? (
            <RecordSection
              title="Rejection Details"
              fields={[
                { label: "Status", value: "Rejected" },
                ...(getScheduleRejectionReasonLabel(schedule.rejectionReasonCode)
                  ? [{ label: "Rejection Reason", value: getScheduleRejectionReasonLabel(schedule.rejectionReasonCode)! }]
                  : []),
                ...(schedule.rejectionAffectedRequirements && schedule.rejectionAffectedRequirements.length > 0
                  ? [{
                      label: "Affected Requirements",
                      value: schedule.rejectionAffectedRequirements.map((r) => r.label).join(", "),
                    }]
                  : []),
                ...(schedule.rejectionNote
                  ? [{ label: "Additional Note", value: schedule.rejectionNote }]
                  : []),
              ]}
            />
          ) : null}

          <Divider />

          {/* Record Section: Progression & History */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionHeading} allowFontScaling>
              Schedule Progression
            </Text>
            <View style={styles.milestoneList}>
              {milestones.map((m, idx) => {
                const isDone = m.state === "completed";
                const isCurrent = m.state === "current";
                const isCancelled = m.state === "cancelled";
                return (
                  <View key={m.key} style={styles.milestoneRow}>
                    <View style={styles.milestoneRail}>
                      <View
                        style={[
                          styles.milestoneDot,
                          isDone && styles.milestoneDotDone,
                          isCurrent && styles.milestoneDotCurrent,
                          isCancelled && styles.milestoneDotCancelled,
                        ]}
                      >
                        {isDone ? (
                          <Ionicons name="checkmark" size={11} color={colors.textInverse} />
                        ) : isCancelled ? (
                          <Ionicons name="close" size={11} color={colors.textInverse} />
                        ) : null}
                      </View>
                      {idx < milestones.length - 1 ? (
                        <View
                          style={[
                            styles.milestoneLine,
                            isDone && styles.milestoneLineDone,
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.milestoneBody}>
                      <View style={styles.milestoneTitleRow}>
                        <Text
                          style={[
                            styles.milestoneTitle,
                            m.state === "upcoming" && styles.milestoneTitleMuted,
                          ]}
                          allowFontScaling
                        >
                          {m.label}
                        </Text>
                        <Text style={styles.milestoneStateTag} allowFontScaling>
                          {isDone
                            ? "Recorded"
                            : isCurrent
                              ? "In Progress"
                              : isCancelled
                                ? "Closed"
                                : "Upcoming"}
                        </Text>
                      </View>
                      <Text style={styles.milestoneDetail} allowFontScaling>
                        {m.detail}
                      </Text>
                      {m.timestamp ? (
                        <Text style={styles.milestoneTime} allowFontScaling>
                          {m.timestamp}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {rescheduleHistory.length > 0 ? (
            <>
              <Divider />
              <View style={styles.timelineSection}>
                <Text style={styles.sectionHeading} allowFontScaling>
                  Reschedule History
                </Text>
                {rescheduleHistory.map((entry, idx) => (
                  <View key={`${entry.changedAt}-${idx}`} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyBadge} allowFontScaling>
                        Schedule Updated
                      </Text>
                      {entry.changedAt ? (
                        <Text style={styles.historyTimestamp} allowFontScaling>
                          {formatManilaTimestamp(entry.changedAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.historyShift} allowFontScaling>
                      From: {formatScheduleDate(entry.previousDate, "short")}
                      {entry.previousStart ? ` • ${formatManilaTimestamp(entry.previousStart).split(" • ")[1] || ""}` : ""}
                    </Text>
                    <Text style={styles.historyShiftNew} allowFontScaling>
                      To: {formatScheduleDate(entry.newDate, "short")}
                      {entry.newStart ? ` • ${formatManilaTimestamp(entry.newStart).split(" • ")[1] || ""}` : ""}
                    </Text>
                    {entry.reason ? (
                      <Text style={styles.historyReason} allowFontScaling>
                        Reason: {entry.reason}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Divider />

          {/* Prerequisite Documents */}
          {(attachmentsQuery.isLoading || attachmentsQuery.isError || attachments.length > 0) ? (
            <>
              <View style={styles.timelineSection}>
                <Text style={styles.sectionHeading} allowFontScaling>
                  Submitted Prerequisite Documents
                </Text>
                {attachmentsQuery.isLoading ? (
                  <Skeleton height={56} borderRadius={radii.sm} />
                ) : attachmentsQuery.isError ? (
                  <View style={styles.availabilityErrorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.availabilityErrorText} allowFontScaling>
                      Unable to load prerequisite documents.
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => void attachmentsQuery.refetch()}
                      style={styles.retryChip}
                    >
                      <Text style={styles.retryChipText} allowFontScaling>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  attachments.map((att) => (
                    <View key={att.id} style={styles.attachmentRow}>
                      <View style={styles.attachmentMeta}>
                        <Text style={styles.attachmentLabel} allowFontScaling>
                          {att.requirementLabel}
                        </Text>
                        <Text style={styles.attachmentFile} numberOfLines={1} allowFontScaling>
                          {att.fileName}
                        </Text>
                      </View>
                      <Button
                        title="View"
                        size="sm"
                        variant="outline"
                        icon="document-text-outline"
                        onPress={() => setViewerAttachment(att)}
                        accessibilityLabel={`View ${att.requirementLabel}`}
                      />
                    </View>
                  ))
                )}
              </View>
              <Divider />
            </>
          ) : null}

          {/* Record Section 2: Celebrant Details */}
          <RecordSection
            title="Celebrant Information"
            fields={[
              ...(schedule.requestedPriest?.name
                ? [{ label: "Preferred Priest", value: `${schedule.requestedPriest.name} (Preference)` }]
                : []),
              {
                label: "Assigned Celebrant",
                value: schedule.layMinisterAssigned
                  ? "Lay Minister"
                  : (schedule.assignedPriest?.fullName || "To be assigned by parish"),
              },
            ]}
          >
            {schedule.priestChangeStatus === "PENDING" ? (
              <View style={styles.priestChangePendingCard}>
                <Text style={styles.priestChangePendingTitle} allowFontScaling>
                  Priest Change Requested
                </Text>
                {requestedReplacementName ? (
                  <Text style={styles.priestChangePendingText} allowFontScaling>
                    Requested replacement priest: Rev. Fr. {requestedReplacementName}
                  </Text>
                ) : null}
                <Text style={styles.priestChangePendingText} allowFontScaling>
                  Note: {schedule.priestChangeNote || "No additional note provided"}
                </Text>
                <Text style={styles.priestChangeStatusSubtext} allowFontScaling>
                  Status: Awaiting Secretary Reassignment
                </Text>
              </View>
            ) : null}

            {visiblePriestChangeSuccess ? (
              <View style={styles.priestChangeSuccessBanner} accessibilityRole="alert">
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.priestChangeSuccessText} allowFontScaling>
                  {visiblePriestChangeSuccess}
                </Text>
              </View>
            ) : null}

            {canRequestPriestChange ? (
              <View style={styles.priestChangeBox}>
                <Text style={styles.priestChangeHelper} allowFontScaling>
                  Wrong priest assigned? Prefer another priest? You can request a change below. Your parish secretary will review and assign the appropriate priest.
                </Text>

                {!showPriestChangeForm ? (
                  <Button
                    title="Request a Different Priest"
                    variant="outline"
                    onPress={handleOpenPriestChange}
                  />
                ) : (
                  <View style={styles.priestChangeForm}>
                    {eligiblePriestsQuery.isLoading ? (
                      <View style={styles.priestChangeLoadingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.priestChangeHelper} allowFontScaling>
                          Loading parish priests...
                        </Text>
                      </View>
                    ) : eligiblePriestsQuery.isError ? (
                      <View style={styles.priestChangeErrorBox}>
                        <Text style={styles.priestChangeErrorText} allowFontScaling>
                          Unable to load parish priests right now.
                        </Text>
                        <Button
                          title="Retry"
                          variant="outline"
                          onPress={() => {
                            void eligiblePriestsQuery.refetch();
                          }}
                        />
                      </View>
                    ) : candidateReplacementPriests.length === 0 ? (
                      <Text style={styles.priestChangeHelper} allowFontScaling>
                        No other active priests are currently available to request in this parish. Please contact the parish secretary below.
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.priestChangeFieldLabel} allowFontScaling>
                          Preferred Replacement Priest
                        </Text>
                        <View style={styles.priestOptionList}>
                          {candidateReplacementPriests.map((priest) => {
                            const selected = replacementPriestId === priest.id;
                            return (
                              <TouchableOpacity
                                key={priest.id}
                                style={[
                                  styles.priestOptionRow,
                                  selected ? styles.priestOptionRowSelected : null,
                                ]}
                                onPress={() => {
                                  setReplacementPriestId(priest.id);
                                  setPriestChangeError(null);
                                }}
                                disabled={requestPriestChangeMutation.isPending}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`Select Rev. Fr. ${priest.name}`}
                              >
                                <View style={styles.priestOptionTextWrap}>
                                  <Text style={styles.priestOptionName} allowFontScaling>
                                    Rev. Fr. {priest.name}
                                  </Text>
                                  <Text style={styles.priestOptionRole} allowFontScaling>
                                    {priest.isAssistant ? "Assistant Priest" : "Parish Priest"}
                                  </Text>
                                </View>
                                <Ionicons
                                  name={selected ? "radio-button-on" : "radio-button-off"}
                                  size={20}
                                  color={selected ? colors.primary : colors.textMuted}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={styles.priestChangeFieldLabel} allowFontScaling>
                          Optional Note
                        </Text>
                        <TextInput
                          style={styles.priestChangeInput}
                          value={priestChangeNote}
                          onChangeText={setPriestChangeNote}
                          placeholder='e.g. "I originally requested Rev. Fr. Julius Montaño, but another priest was assigned."'
                          placeholderTextColor={colors.textMuted}
                          multiline
                          maxLength={1000}
                          editable={!requestPriestChangeMutation.isPending}
                          allowFontScaling
                          accessibilityLabel="Optional note explaining priest change request"
                        />

                        {priestChangeError ? (
                          <View style={styles.priestChangeErrorBox} accessibilityRole="alert">
                            <Text style={styles.priestChangeErrorText} allowFontScaling>
                              {priestChangeError}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.priestChangeActions}>
                          <Button
                            title={
                              requestPriestChangeMutation.isPending
                                ? "Submitting..."
                                : "Confirm Priest Change"
                            }
                            loading={requestPriestChangeMutation.isPending}
                            onPress={() => {
                              void handleSubmitPriestChange();
                            }}
                            disabled={
                              requestPriestChangeMutation.isPending || !replacementPriestId
                            }
                          />
                          <Button
                            title="Cancel"
                            variant="outline"
                            onPress={() => {
                              setPriestChangeFormScheduleId(null);
                              setPriestChangeError(null);
                            }}
                            disabled={requestPriestChangeMutation.isPending}
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ) : null}
          </RecordSection>

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

          <Divider />

          {/* Record Section 4: Contact Parish Secretary */}
          <RecordSection
            title="Contact Parish Secretary"
            fields={
              schedule.parishSecretary
                ? [
                    {
                      label: "Parish Secretary",
                      value: schedule.parishSecretary.fullName || "Not available",
                    },
                    {
                      label: "Contact Number",
                      value: schedule.parishSecretary.contactNumber ? (
                        <TouchableOpacity
                          style={styles.secretaryPhoneTouch}
                          onPress={() => {
                            if (schedule.parishSecretary?.contactNumber) {
                              void handleCallSecretary(schedule.parishSecretary.contactNumber);
                            }
                          }}
                          accessibilityRole="link"
                          accessibilityLabel={`Call parish secretary ${schedule.parishSecretary.fullName || ""} at ${schedule.parishSecretary.contactNumber}`}
                        >
                          <Ionicons name="call-outline" size={16} color={colors.primary} />
                          <Text style={styles.secretaryPhoneText} allowFontScaling>
                            {schedule.parishSecretary.contactNumber}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        "Not available"
                      ),
                    },
                  ]
                : undefined
            }
          >
            {!schedule.parishSecretary ? (
              <Text style={styles.secretaryUnavailableText} allowFontScaling>
                Parish secretary contact information is currently unavailable.
              </Text>
            ) : null}
          </RecordSection>
        </ContentColumn>
      </ScrollView>

      <SecureFileViewerModal
        visible={Boolean(viewerAttachment)}
        endpointPath={
          viewerAttachment
            ? `/schedule-requests/${schedule.id}/attachments/${viewerAttachment.id}/file`
            : null
        }
        fileName={viewerAttachment?.fileName ?? ""}
        mimeType={viewerAttachment?.fileType}
        title={viewerAttachment?.requirementLabel || "Prerequisite Document"}
        onClose={() => setViewerAttachment(null)}
      />
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
    gap: spacing.md,
  },
  layMinisterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  layMinisterHeaderText: {
    flex: 1,
  },
  layMinisterTitle: {
    ...fontStyles.captionBold,
    color: "#92400E",
    fontSize: 16,
  },
  layMinisterSubtitle: {
    ...fontStyles.caption,
    color: "#B45309",
    marginTop: 1,
  },
  layMinisterDesc: {
    ...fontStyles.bodySmall,
    color: "#78350F",
    lineHeight: 19,
  },
  proposalStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.md,
    gap: spacing.sm,
  },
  proposalStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  proposalStatusCardTitle: {
    ...fontStyles.captionBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  proposalBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  proposalBadgePriest: {
    backgroundColor: "#EDE9FE",
    borderColor: "#DDD6FE",
  },
  proposalBadgeParish: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  proposalBadgeText: {
    ...fontStyles.caption,
    fontWeight: "700",
    fontSize: 11,
  },
  proposalBadgeTextPriest: {
    color: "#5B21B6",
  },
  proposalBadgeTextParish: {
    color: "#92400E",
  },
  proposalDetailList: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  proposalDetailValue: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  proposalNoticeText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  proposalNoteCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: 2,
  },
  proposalNoteLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  proposalNoteText: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    fontStyle: "italic",
  },
  proposalDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  proposalDisclaimerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  withdrawBtn: {
    marginTop: spacing.xs,
  },
  alternativeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.md,
    gap: spacing.md,
  },
  alternativeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  alternativeCardTitle: {
    ...fontStyles.captionBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  alternativeCardSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  inputStepLabel: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  calendarLoadingContainer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  slotsLoadingContainer: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  loadingCaption: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  availabilityErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FEE2E2",
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  availabilityErrorText: {
    ...fontStyles.caption,
    color: colors.danger,
    flex: 1,
  },
  retryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  retryChipText: {
    ...fontStyles.captionBold,
    color: colors.danger,
  },
  availabilityEmptyBox: {
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  availabilityEmptyText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
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
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    fontWeight: "700",
  },
  noteLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCountText: {
    ...fontStyles.caption,
    color: colors.textMuted,
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
  timelineSection: {
    gap: spacing.sm,
  },
  sectionHeading: {
    ...fontStyles.captionBold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  milestoneList: {
    gap: spacing.xs,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  milestoneRail: {
    alignItems: "center",
    width: 22,
  },
  milestoneDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  milestoneDotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceVariant,
  },
  milestoneDotCancelled: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  milestoneLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.borderLight,
    marginVertical: 2,
  },
  milestoneLineDone: {
    backgroundColor: colors.success,
  },
  milestoneBody: {
    flex: 1,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  milestoneTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  milestoneTitle: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
  },
  milestoneTitleMuted: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  milestoneStateTag: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  milestoneDetail: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  milestoneTime: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  historyCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  historyBadge: {
    ...fontStyles.caption,
    color: colors.warning,
    fontWeight: "700",
  },
  historyTimestamp: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  historyShift: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  historyShiftNew: {
    ...fontStyles.caption,
    color: colors.success,
    fontWeight: "700",
  },
  historyReason: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    marginTop: 2,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  attachmentMeta: {
    flex: 1,
    gap: 2,
  },
  attachmentLabel: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  attachmentFile: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  priestChangePendingCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: 4,
  },
  priestChangePendingTitle: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  priestChangePendingText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  priestChangeStatusSubtext: {
    ...fontStyles.caption,
    fontWeight: "600",
    color: colors.warning,
  },
  priestChangeSuccessBanner: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  priestChangeSuccessText: {
    ...fontStyles.caption,
    color: colors.success,
    flex: 1,
    fontWeight: "600",
  },
  priestChangeBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  priestChangeHelper: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  priestChangeForm: {
    gap: spacing.sm,
  },
  priestChangeLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  priestChangeFieldLabel: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  priestOptionList: {
    gap: spacing.xs,
  },
  priestOptionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  priestOptionRowSelected: {
    borderColor: colors.primary,
  },
  priestOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  priestOptionName: {
    ...fontStyles.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  priestOptionRole: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  priestChangeInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    textAlignVertical: "top",
    ...fontStyles.bodySmall,
  },
  priestChangeErrorBox: {
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  priestChangeErrorText: {
    ...fontStyles.caption,
    color: colors.danger,
    fontWeight: "600",
  },
  priestChangeActions: {
    gap: spacing.xs,
  },
  secretaryPhoneTouch: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
  },
  secretaryPhoneText: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.primary,
  },
  secretaryUnavailableText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
});
