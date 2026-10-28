import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeBottomActionBar } from "@/components/ui/SafeBottomActionBar";
import { SelectionRow } from "@/components/ui/SelectionRow";
import { RecordSection } from "@/components/ui/RecordSection";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { useAuth } from "@/providers/AuthProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { isAppError } from "@/services/api/errors";
import { useParishes } from "@/features/parishes/api";
import type { ParishDto } from "@/features/parishes/types";
import {
  useAvailabilityDates,
  useAvailableSlots,
  useCreateSchedule,
  useEligiblePriests,
  useRecommendations,
  useSchedulingConfiguration,
} from "./api";
import { SupportingFilePicker } from "@/features/requests/components/SupportingFilePicker";
import type { LocalSelectedFile } from "@/features/requests/types";
import {
  formatScheduleDate,
  makeSchedulePayloadSignature,
} from "./presentation";
import { makePrerequisiteUploadSignature } from "./prerequisiteUploads";
import {
  PREFERRED_PRIEST_HELPER_COPY,
  SuggestedTimeCard,
} from "./components/SuggestedTimeCard";
import type { ScheduleEventType, ScheduleServiceRequirement } from "./types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const generateClientUuid = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

const getManilaDateParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  return { year, month, day, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
};

const buildMonthCells = (year: number, month: number) => {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: number[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

const isoForDay = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const moveMonth = (month: { year: number; month: number }, delta: number) => {
  const value = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
};

export interface ScheduleWizardScreenProps {
  initialParishId?: string;
}

export const ScheduleWizardScreen: React.FC<ScheduleWizardScreenProps> = ({ initialParishId }) => {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ parishId?: string }>();
  const routeParishId = initialParishId ?? searchParams.parishId;
  const { profile } = useAuth();
  const feedback = useFeedback();
  const reduceMotion = useReducedMotion();
  const { contentBottomInset, onBottomActionLayout } = useAppLayoutMetrics();
  const today = useMemo(() => getManilaDateParts(), []);

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedParishId, setSelectedParishId] = useState<number | null>(() => {
    if (!routeParishId) return null;
    const parsedId = Number(routeParishId);
    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  });
  const [prevRouteParishId, setPrevRouteParishId] = useState(routeParishId);
  if (routeParishId !== prevRouteParishId) {
    setPrevRouteParishId(routeParishId);
    const parsedId = routeParishId ? Number(routeParishId) : null;
    if (parsedId && Number.isFinite(parsedId) && parsedId > 0) {
      setSelectedParishId(parsedId);
    }
  }

  const [selectedEventType, setSelectedEventType] = useState<ScheduleEventType | null>(null);
  const [preferredDate, setPreferredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [requestedPriestId, setRequestedPriestId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState({ year: today.year, month: today.month });

  const idempotencyKeysRef = useRef(new Map<string, string>());
  const lastRefreshAtRef = useRef(0);
  const inactiveAtRef = useRef<number | null>(null);

  const { data: parishesResponse, isLoading: isLoadingParishes } = useParishes({ limit: 50 });
  const parishes: ParishDto[] = useMemo(
    () => parishesResponse?.items || [],
    [parishesResponse?.items]
  );
  const selectedParish = parishes.find((parish) => Number(parish.id) === selectedParishId);

  const configurationQuery = useSchedulingConfiguration(selectedParishId);
  const configuration = configurationQuery.data;
  const datesQuery = useAvailabilityDates(selectedParishId, selectedEventType);
  const slotsQuery = useAvailableSlots(selectedParishId, selectedDate, selectedEventType);
  const eligiblePriestsQuery = useEligiblePriests(selectedParishId);
  const eligiblePriests = eligiblePriestsQuery.data || [];

  const recommendationPayload = useMemo(() => {
    if (!selectedParishId || !selectedEventType || !preferredDate) return null;
    return {
      parishId: selectedParishId,
      eventType: selectedEventType,
      preferredDate,
      requestedPriestId: requestedPriestId || null,
    };
  }, [selectedParishId, selectedEventType, preferredDate, requestedPriestId]);

  const recommendationsQuery = useRecommendations(recommendationPayload);
  const recommendations = recommendationsQuery.data?.recommendations || [];

  const { refetch: refetchConfiguration } = configurationQuery;
  const { refetch: refetchDates } = datesQuery;
  const { refetch: refetchSlots } = slotsQuery;
  const createMutation = useCreateSchedule();

  const availableDateSet = useMemo(
    () => new Set(datesQuery.data?.dates || []),
    [datesQuery.data?.dates]
  );
  const selectedService = configuration?.services.find(
    (service) => service.eventType === selectedEventType
  );
  const requirements: ScheduleServiceRequirement[] = useMemo(
    () => selectedService?.requirements || [],
    [selectedService?.requirements]
  );
  const hasRequirements = requirements.length > 0;
  const totalSteps = hasRequirements ? 6 : 5;
  const confirmationStep = totalSteps;
  const uploadRequirementsStep = hasRequirements ? 5 : null;

  const [requirementFiles, setRequirementFiles] = useState<Record<string, LocalSelectedFile>>({});
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requirementsComplete = useMemo(() => {
    if (!hasRequirements) return true;
    return requirements.every((r) => Boolean(requirementFiles[r.id]));
  }, [hasRequirements, requirements, requirementFiles]);

  const activeRequirementIds = useMemo(
    () => new Set(requirements.map((r) => r.id)),
    [requirements]
  );

  const [prevRequirements, setPrevRequirements] = useState(requirements);
  if (requirements !== prevRequirements) {
    setPrevRequirements(requirements);
    setRequirementFiles((prev) => {
      const next: Record<string, LocalSelectedFile> = {};
      let changed = false;
      for (const [id, file] of Object.entries(prev)) {
        if (activeRequirementIds.has(id)) {
          next[id] = file;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    if (!hasRequirements && currentStep > 5) {
      setCurrentStep(5);
    } else if (hasRequirements && currentStep === 6 && !requirementsComplete) {
      setCurrentStep(5);
      setErrorMessage("The parish updated its document requirements. Please upload every required document.");
    }
  }

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const refreshAuthoritativeAvailability = useCallback((force = false) => {
    if (!selectedParishId) return;
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < 1200) return;
    lastRefreshAtRef.current = now;
    void refetchConfiguration().then(() => {
      if (selectedEventType) void refetchDates();
      if (selectedDate && selectedEventType) void refetchSlots();
    });
  }, [refetchConfiguration, refetchDates, refetchSlots, selectedDate, selectedEventType, selectedParishId]);

  useEffect(() => {
    if (currentStep >= 2 && selectedParishId) refreshAuthoritativeAvailability();
  }, [currentStep, refreshAuthoritativeAvailability, selectedParishId]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "inactive" || nextState === "background") {
        inactiveAtRef.current = Date.now();
      }
      if (nextState === "active") {
        const inactiveTime = inactiveAtRef.current;
        inactiveAtRef.current = null;
        if (inactiveTime && Date.now() - inactiveTime > 30000) {
          refreshAuthoritativeAvailability(true);
        }
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [refreshAuthoritativeAvailability]);

  // When parish changes, reset subsequent selections
  const handleSelectParish = (parishId: number) => {
    if (parishId !== selectedParishId) {
      setSelectedParishId(parishId);
      setSelectedEventType(null);
      setPreferredDate(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setRequestedPriestId(null);
      setRequirementFiles({});
      setErrorMessage(null);
    }
  };

  // When service changes, reset date & slot and files
  const handleSelectService = (eventType: ScheduleEventType) => {
    if (eventType !== selectedEventType) {
      setSelectedEventType(eventType);
      setPreferredDate(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setRequirementFiles({});
      setErrorMessage(null);
    }
  };

  const handleSelectDate = (date: string) => {
    setPreferredDate(date);
    setSelectedDate(date);
    setSelectedSlot(null);
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (submittingRef.current) return;
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((step) => step - 1);
      setErrorMessage(null);
    }
  };

  const getIdempotencyKey = async () => {
    const activeFiles = Object.fromEntries(requirements.map((r) => [r.id, requirementFiles[r.id]]));
    const uploadSignature = await makePrerequisiteUploadSignature(activeFiles);
    const payloadSignature = makeSchedulePayloadSignature({
      parishId: selectedParishId!,
      eventType: selectedEventType!,
      date: selectedDate!,
      timeSlot: selectedSlot!,
      remarks,
      requestedPriestId: requestedPriestId || null,
      uploadSignature,
    });
    const existingKey = idempotencyKeysRef.current.get(payloadSignature);
    if (existingKey) return existingKey;
    const key = `mobile-sched-${generateClientUuid()}`;
    idempotencyKeysRef.current.set(payloadSignature, key);
    return key;
  };

  const handleSubmit = async () => {
    if (submittingRef.current || createMutation.isPending) return;

    if (profile?.needsProfileCompletion) {
      feedback.showWarning({
        title: "Profile Details Required",
        message: "Please complete your profile (full name and contact number) before scheduling an appointment.",
        confirmText: "Complete Profile",
        cancelText: "Cancel",
        onConfirm: () => {
          router.push("/(app)/(tabs)/profile" as any);
        },
      });
      return;
    }

    if (!profile?.isGovernmentIdVerified) {
      feedback.showWarning({
        title: "Government ID Required",
        message: "Please verify your Philippine government-issued ID before scheduling an appointment.",
        confirmText: "Verify ID",
        cancelText: "Cancel",
        onConfirm: () => {
          router.push("/(app)/profile/id-verification" as any);
        },
      });
      return;
    }

    if (!selectedParishId || !selectedEventType || !selectedDate || !selectedSlot || !selectedService) {
      setErrorMessage("Please complete each scheduling step before submitting.");
      return;
    }

    if (hasRequirements && !requirementsComplete) {
      setErrorMessage("Please upload every required prerequisite document before submitting.");
      if (uploadRequirementsStep) setCurrentStep(uploadRequirementsStep);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const created = await createMutation.mutateAsync({
        payload: {
          parishId: selectedParishId,
          eventType: selectedEventType,
          date: selectedDate,
          timeSlot: selectedSlot,
          remarks: remarks.trim() || undefined,
          requestedPriestId: requestedPriestId || undefined,
        },
        requirements: hasRequirements ? requirements : undefined,
        files: hasRequirements ? requirementFiles : undefined,
        idempotencyKey: await getIdempotencyKey(),
      });
      feedback.showSuccess({
        title: "Schedule Request Submitted",
        message: `Your appointment request has been sent to ${selectedParish?.name || "the parish"} for review.`,
        referenceNumber: `SR-${created.id}`,
        confirmText: "View Details",
        onConfirm: () => {
          router.replace(`/(app)/schedule/${created.id}` as never);
        },
      });
    } catch (error: unknown) {
      const appError = isAppError(error) ? error : null;
      const code = appError?.code ?? "";

      if (code === "SCHEDULE_REQUIREMENTS_CHANGED") {
        const msg =
          appError?.message ||
          "The parish updated its document requirements. Please review the updated requirements.";
        setErrorMessage(msg);
        feedback.showWarning({
          title: "Requirements Updated",
          message: msg,
          confirmText: "Review Requirements",
        });
        const refreshed = await refetchConfiguration();
        const nextService = refreshed.data?.services.find(
          (s) => s.eventType === selectedEventType
        );
        const nextRequirements = nextService?.requirements || [];
        const nextActiveIds = new Set(nextRequirements.map((r) => r.id));
        setRequirementFiles((prev) => {
          const next: Record<string, LocalSelectedFile> = {};
          for (const [id, file] of Object.entries(prev)) {
            if (nextActiveIds.has(id)) {
              next[id] = file;
            }
          }
          return next;
        });
        setCurrentStep(nextService ? 5 : 2);
        return;
      }

      if (
        code === "INVALID_SCHEDULE_ATTACHMENTS" ||
        code === "MISSING_SCHEDULE_ATTACHMENTS" ||
        (hasRequirements && appError?.kind === "VALIDATION")
      ) {
        setErrorMessage(
          appError?.message ||
            "Invalid prerequisite documents. Please check your files and try again."
        );
        if (hasRequirements && uploadRequirementsStep) {
          setCurrentStep(uploadRequirementsStep);
        }
        return;
      }

      if (code === "PROFILE_INCOMPLETE") {
        feedback.showWarning({
          title: "Profile Details Required",
          message: "Please complete your profile (full name and contact number) before scheduling.",
          confirmText: "Complete Profile",
          cancelText: "Cancel",
          onConfirm: () => {
            router.push("/(app)/(tabs)/profile" as any);
          },
        });
        return;
      }

      if (code === "IDENTITY_NOT_VERIFIED") {
        feedback.showWarning({
          title: "Government ID Verification Required",
          message: "Please verify your Philippine government-issued ID before scheduling.",
          confirmText: "Verify ID",
          cancelText: "Cancel",
          onConfirm: () => {
            router.push("/(app)/profile/id-verification" as any);
          },
        });
        return;
      }

      if (code === "SLOT_CONFLICT" || code === "SLOT_UNAVAILABLE") {
        setErrorMessage("The selected time slot is no longer available. Please choose another slot.");
        setSelectedSlot(null);
        void refetchSlots();
        return;
      }

      if (code === "VERSION_CONFLICT") {
        setErrorMessage("The parish updated its scheduling configuration. Availability has been refreshed.");
        refreshAuthoritativeAvailability(true);
        return;
      }

      setErrorMessage(
        appError?.message ||
          "Unable to submit your scheduling request. Please verify your connection and try again."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const renderCalendar = () => {
    const cells = buildMonthCells(calendarMonth.year, calendarMonth.month);
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => setCalendarMonth((month) => moveMonth(month, -1))}
            style={styles.monthButton}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle} allowFontScaling>
            {MONTH_NAMES[calendarMonth.month - 1]} {calendarMonth.year}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => setCalendarMonth((month) => moveMonth(month, 1))}
            style={styles.monthButton}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setCalendarMonth({ year: today.year, month: today.month })}
          style={styles.todayButton}
        >
          <Text style={styles.todayButtonText} allowFontScaling>
            Return to Current Month
          </Text>
        </TouchableOpacity>

        <View style={styles.weekRow}>
          {WEEKDAY_NAMES.map((name) => (
            <Text key={name} style={styles.weekday} allowFontScaling>
              {name}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {cells.map((day, index) => {
            if (day <= 0) return <View key={`blank-${index}`} style={styles.dayCellContainer} />;
            const iso = isoForDay(calendarMonth.year, calendarMonth.month, day);
            const available = availableDateSet.has(iso);
            const selected = selectedDate === iso;
            const isToday = today.iso === iso;
            return (
              <View key={iso} style={styles.dayCellContainer}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${iso}${available ? ", available" : ", unavailable"}`}
                  accessibilityState={{ disabled: !available, selected }}
                  disabled={!available}
                  onPress={() => handleSelectDate(iso)}
                  style={[
                    styles.dayBadge,
                    available && styles.dayAvailable,
                    selected && styles.daySelected,
                    isToday && !selected && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !available && styles.dayDisabledText,
                      selected && styles.daySelectedText,
                    ]}
                    allowFontScaling
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <Text style={styles.calendarHelp} allowFontScaling>
          Only dates confirmed by the parish are selectable.
        </Text>
      </View>
    );
  };

  if (profile?.needsProfileCompletion) {
    return (
      <Screen safeArea style={styles.screen} testID="schedule-wizard-blocked">
        <AppHeader
          title="New Schedule"
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(app)/(tabs)/(schedule)" as any);
            }
          }}
        />
        <View style={styles.centerContainer}>
          <EmptyState
            title="Profile Completion Required"
            description="Complete your profile to access document and schedule requests. Parish offices require your official contact details."
            icon="person-circle-outline"
            actionLabel="Complete Profile"
            onAction={() => router.push("/(app)/(tabs)/profile" as any)}
          />
        </View>
      </Screen>
    );
  }

  if (!profile?.isGovernmentIdVerified) {
    return (
      <Screen safeArea style={styles.screen} testID="schedule-wizard-id-blocked">
        <AppHeader
          title="New Schedule"
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(app)/(tabs)/(schedule)" as any);
            }
          }}
        />
        <View style={styles.centerContainer}>
          <EmptyState
            title="Government ID Verification Required"
            description="Please verify your Philippine government-issued ID before scheduling a parish appointment."
            icon="shield-checkmark-outline"
            actionLabel="Verify Government ID"
            onAction={() => router.push("/(app)/profile/id-verification" as any)}
          />
        </View>
      </Screen>
    );
  }

  const bottomInset = contentBottomInset("action");

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Schedule an Appointment"
        subtitle={`Step ${currentStep} of ${totalSteps}`}
        onBack={handleBack}
      />

      {/* Step Progress Bar */}
      <View style={styles.stepIndicator}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <View
            key={step}
            style={[styles.stepDot, step <= currentStep && styles.stepDotActive]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <ContentColumn>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText} allowFontScaling>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <Animated.View
            key={currentStep}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
          >
          {/* STEP 1: PARISH SELECTION */}
          {currentStep === 1 && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Choose Target Parish
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                Select the parish where you would like to request an appointment.
              </Text>

              {isLoadingParishes ? (
                <>
                  <Skeleton height={60} borderRadius={radii.sm} />
                  <Skeleton height={60} borderRadius={radii.sm} />
                  <Skeleton height={60} borderRadius={radii.sm} />
                </>
              ) : parishes.length === 0 ? (
                <EmptyState
                  icon="location-outline"
                  title="No parishes available"
                  description="Please try again when parish directory information is available."
                />
              ) : (
                <View style={styles.selectionList}>
                  {parishes.map((parish) => (
                    <SelectionRow
                      key={parish.id}
                      title={parish.name}
                      accessibilityLabel={parish.name}
                      subtitle={parish.municipalityCity || parish.address || parish.type}
                      selected={selectedParishId === Number(parish.id)}
                      onSelect={() => handleSelectParish(Number(parish.id))}
                      mode="radio"
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* STEP 2: SERVICE SELECTION */}
          {currentStep === 2 && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Choose a Service
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                {selectedParish?.name || "Selected parish"}
              </Text>

              {configuration?.venueCapacity ? (
                <Text style={styles.capacityNote} allowFontScaling>
                  Venue capacity: {configuration.venueCapacity} people (informational)
                </Text>
              ) : null}

              {configurationQuery.isLoading ? (
                <>
                  <Skeleton height={56} borderRadius={radii.sm} />
                  <Skeleton height={56} borderRadius={radii.sm} />
                </>
              ) : !configuration?.schedulingAvailable ? (
                <EmptyState
                  icon="calendar-outline"
                  title="Online scheduling unavailable"
                  description={
                    configuration?.configurationUnavailable
                      ? "This parish has not completed its scheduling configuration."
                      : "This parish is not accepting online scheduling requests right now."
                  }
                />
              ) : (
                <View style={styles.selectionList}>
                  {configuration?.services.map((service) => (
                    <SelectionRow
                      key={service.eventType}
                      title={service.label}
                      accessibilityLabel={service.label}
                      subtitle="Online appointment"
                      selected={selectedEventType === service.eventType}
                      onSelect={() => handleSelectService(service.eventType)}
                      mode="radio"
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* STEP 3: DATE SELECTION (CALENDAR) */}
          {currentStep === 3 && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Select Date
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                {selectedService?.label || "Selected service"} at {selectedParish?.name || "your parish"}
              </Text>

              {datesQuery.isLoading ? (
                <Skeleton height={300} borderRadius={radii.md} />
              ) : (
                renderCalendar()
              )}

              {datesQuery.data && !datesQuery.data.serviceAvailable ? (
                <EmptyState
                  icon="calendar-clear-outline"
                  title="No dates available"
                  description="This service is currently unavailable for online scheduling."
                />
              ) : null}
            </View>
          )}

          {/* STEP 4: TIME SLOT & PRIEST */}
          {currentStep === 4 && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Choose Time Slot
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                {selectedDate ? formatScheduleDate(selectedDate) : "Choose a date first"}
              </Text>

              {/* Preferred Priest Section */}
              <View style={styles.priestSection}>
                <Text style={styles.sectionHeading} allowFontScaling>
                  Preferred Priest (Optional)
                </Text>
                <Text style={styles.sectionSubtext} allowFontScaling>
                  Preference only. Final assignment is determined by the parish.
                </Text>

                {eligiblePriestsQuery.isError ? (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningBannerText} allowFontScaling>
                      Unable to load preferred priests. You can proceed without a preference.
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => void eligiblePriestsQuery.refetch()}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryButtonText} allowFontScaling>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : eligiblePriestsQuery.isLoading ? (
                  <Skeleton height={40} borderRadius={radii.sm} />
                ) : (
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="No preference"
                      accessibilityState={{ selected: requestedPriestId === null }}
                      onPress={() => setRequestedPriestId(null)}
                      style={[
                        styles.priestChip,
                        requestedPriestId === null && styles.priestChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priestChipText,
                          requestedPriestId === null && styles.priestChipTextSelected,
                        ]}
                        allowFontScaling
                      >
                        No preference
                      </Text>
                    </TouchableOpacity>

                    {eligiblePriests.map((priest) => {
                      const isSelected = requestedPriestId === priest.id;
                      const priestDisplayName = `${priest.name}${priest.isAssistant ? " (Assistant)" : ""}`;
                      return (
                        <TouchableOpacity
                          key={priest.id}
                          accessibilityRole="button"
                          accessibilityLabel={priestDisplayName}
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => setRequestedPriestId(priest.id)}
                          style={[
                            styles.priestChip,
                            isSelected && styles.priestChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.priestChipText,
                              isSelected && styles.priestChipTextSelected,
                            ]}
                            allowFontScaling
                          >
                            {priestDisplayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Alternative Recommendations */}
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionHeading} allowFontScaling>
                  Suggested Alternative Times
                </Text>
                {Boolean(requestedPriestId) && (
                  <Text style={styles.sectionSubtext} allowFontScaling>
                    {PREFERRED_PRIEST_HELPER_COPY}
                  </Text>
                )}

                {recommendationsQuery.isError ? (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningBannerText} allowFontScaling>
                      Unable to load suggestions. You can select an available time slot below.
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => void recommendationsQuery.refetch()}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryButtonText} allowFontScaling>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : recommendationsQuery.isLoading ? (
                  <Skeleton height={68} borderRadius={radii.sm} />
                ) : recommendations.length > 0 ? (
                  <View style={styles.suggestionList}>
                    {recommendations.slice(0, 6).map((rec) => {
                      const isSelected =
                        selectedDate === rec.date && selectedSlot === rec.timeSlot;
                      return (
                        <SuggestedTimeCard
                          key={`${rec.date}-${rec.timeSlot}`}
                          rec={rec}
                          isSelected={isSelected}
                          onSelect={() => {
                            setSelectedDate(rec.date);
                            setSelectedSlot(rec.timeSlot);
                            setErrorMessage(null);
                          }}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noSuggestionsText} allowFontScaling>
                    No suggestions available for this window.
                  </Text>
                )}
              </View>

              {/* Available Time Slots */}
              <Text style={styles.sectionHeading} allowFontScaling>
                Available Time Slots {selectedDate ? `(${formatScheduleDate(selectedDate)})` : ""}
              </Text>

              {slotsQuery.isLoading ? (
                <>
                  <Skeleton height={48} borderRadius={radii.sm} />
                  <Skeleton height={48} borderRadius={radii.sm} />
                </>
              ) : !slotsQuery.isLoading && (slotsQuery.data || []).length === 0 ? (
                <EmptyState
                  icon="time-outline"
                  title="No time slots available"
                  description="Choose another date to see current parish availability."
                />
              ) : (
                <View style={styles.slotList}>
                  {(slotsQuery.data || []).map((slot) => (
                    <SelectionRow
                      key={slot}
                      title={slot}
                      accessibilityLabel={slot}
                      subtitle="Available time slot"
                      selected={selectedSlot === slot}
                      onSelect={() => {
                        setSelectedSlot(slot);
                        setErrorMessage(null);
                      }}
                      mode="radio"
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* STEP 5: UPLOAD REQUIREMENTS (WHEN PREREQUISITES EXIST) */}
          {currentStep === 5 && hasRequirements && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Upload Requirements
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                Please provide the documents required by {selectedParish?.name || "the parish"} for {selectedService?.label || "your service"}.
              </Text>

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.infoBannerText} allowFontScaling>
                  Accepted file types: PDF, JPG, PNG, or WebP up to 5 MB per document. Documents are securely transmitted to the parish office.
                </Text>
              </View>

              <View style={styles.requirementsList}>
                {requirements.map((req) => (
                  <SupportingFilePicker
                    key={`${selectedParishId}-${selectedEventType}-${req.id}`}
                    requirement={{
                      id: req.id,
                      label: req.label,
                      category: "schedule_prerequisite",
                      required: true,
                      description: "Required prerequisite document for this service.",
                    }}
                    selectedFile={requirementFiles[req.id] || null}
                    onFileSelected={(file) => {
                      setRequirementFiles((prev) => ({ ...prev, [req.id]: file }));
                      setErrorMessage(null);
                    }}
                    onFileRemoved={(requirementId) => {
                      setRequirementFiles((prev) => {
                        const next = { ...prev };
                        delete next[requirementId];
                        return next;
                      });
                      setErrorMessage(null);
                    }}
                    disabled={createMutation.isPending || isSubmitting}
                  />
                ))}
              </View>
            </View>
          )}

          {/* CONFIRMATION & REVIEW (Step 5 without prerequisites, or Step 6 with prerequisites) */}
          {currentStep === confirmationStep && (
            <View style={styles.section}>
              <Text style={styles.title} allowFontScaling>
                Confirm Your Appointment Request
              </Text>
              <Text style={styles.subtitle} allowFontScaling>
                Please review your scheduling details before submitting.
              </Text>

              <RecordSection
                title="Appointment Details"
                fields={[
                  { label: "Target Parish", value: selectedParish?.name || "Parish" },
                  { label: "Sacrament / Service", value: selectedService?.label || "Service" },
                  { label: "Requested Date", value: selectedDate ? formatScheduleDate(selectedDate) : "" },
                  { label: "Time Slot", value: selectedSlot || "Not selected" },
                  {
                    label: "Preferred Priest",
                    value: requestedPriestId
                      ? `${eligiblePriests.find((p) => p.id === requestedPriestId)?.name || "Requested Priest"} (Preference)`
                      : "No preference",
                  },
                ]}
              />

              {hasRequirements && (
                <RecordSection
                  title="Uploaded Prerequisite Documents"
                  fields={requirements.map((req) => {
                    const file = requirementFiles[req.id];
                    return {
                      label: req.label,
                      value: file ? `${file.name} (${formatBytes(file.size)})` : "Missing",
                    };
                  })}
                />
              )}

              <View style={styles.notesContainer}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Notes for the parish (optional)
                </Text>
                <RNTextInput
                  value={remarks}
                  editable={!isSubmitting}
                  onChangeText={setRemarks}
                  placeholder="Add relevant details or special assistance needs"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.notesInput}
                  maxLength={500}
                />
                <Text style={styles.disclaimerText} allowFontScaling>
                  Parish office staff will review and confirm this request.
                </Text>
              </View>
            </View>
          )}
          </Animated.View>
        </ContentColumn>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <SafeBottomActionBar onLayout={onBottomActionLayout}>
        {currentStep === 1 ? (
          <Button
            title="Continue to Service"
            accessibilityLabel="Continue to Service"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            disabled={!selectedParishId}
            onPress={() => setCurrentStep(2)}
            style={styles.fullWidthAction}
          />
        ) : currentStep === 2 ? (
          <Button
            title="Continue to Date"
            accessibilityLabel="Continue to Date"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            disabled={!selectedEventType}
            onPress={() => setCurrentStep(3)}
            style={styles.fullWidthAction}
          />
        ) : currentStep === 3 ? (
          <Button
            title="Continue to Time Slot"
            accessibilityLabel="Continue to Time Slot"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            disabled={!selectedDate}
            onPress={() => setCurrentStep(4)}
            style={styles.fullWidthAction}
          />
        ) : currentStep === 4 ? (
          <Button
            title={hasRequirements ? "Continue to Upload Requirements" : "Continue to Confirmation"}
            accessibilityLabel={hasRequirements ? "Continue to Upload Requirements" : "Continue to Confirmation"}
            variant="primary"
            size="lg"
            icon="arrow-forward"
            disabled={!selectedSlot}
            onPress={() => setCurrentStep(5)}
            style={styles.fullWidthAction}
          />
        ) : currentStep === 5 && hasRequirements ? (
          <Button
            title="Continue to Confirmation"
            accessibilityLabel="Continue to Confirmation"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            disabled={!requirementsComplete}
            onPress={() => {
              if (!requirementsComplete) {
                setErrorMessage("Please upload every required document before proceeding.");
                return;
              }
              setErrorMessage(null);
              setCurrentStep(6);
            }}
            style={styles.fullWidthAction}
          />
        ) : currentStep === confirmationStep ? (
          <Button
            title="Submit Schedule Request"
            accessibilityLabel="Submit Schedule Request"
            variant="primary"
            size="lg"
            icon="checkmark-circle-outline"
            loading={createMutation.isPending || isSubmitting}
            disabled={createMutation.isPending || isSubmitting || (hasRequirements && !requirementsComplete)}
            onPress={() => {
              void handleSubmit();
            }}
            style={styles.fullWidthAction}
          />
        ) : null}
      </SafeBottomActionBar>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    padding: 0,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  stepDot: {
    flex: 1,
    maxWidth: 48,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.borderLight,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  title: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  subtitle: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  capacityNote: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...fontStyles.bodySmall,
    color: colors.danger,
  },
  selectionList: {
    gap: spacing.xs,
  },
  slotList: {
    gap: spacing.xs,
  },
  calendarContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  todayButton: {
    alignSelf: "center",
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  todayButtonText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  dayBadge: {
    width: "88%",
    height: "88%",
    borderRadius: radii.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  dayAvailable: {
    backgroundColor: colors.surfaceVariant,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  dayDisabledText: {
    color: colors.textMuted,
  },
  daySelectedText: {
    color: colors.surface,
    fontWeight: "700",
  },
  calendarHelp: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  priestSection: {
    gap: spacing.xs,
  },
  sectionHeading: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  sectionSubtext: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  priestChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
    maxWidth: "100%",
  },
  priestChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  priestChipText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  priestChipTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  suggestionsSection: {
    gap: spacing.xs,
  },
  suggestionList: {
    gap: spacing.xs,
  },
  noSuggestionsText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  notesContainer: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  inputLabel: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  disclaimerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  warningBanner: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  warningBannerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  retryButtonText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  infoBannerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  requirementsList: {
    gap: spacing.sm,
  },
  fullWidthAction: {
    width: "100%",
  },
});
