import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput as RNTextInput } from "@/components/Typography";
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
import { SecureFileViewerModal } from "@/components/files/SecureFileViewerModal";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { useAuth } from "@/providers/AuthProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { isAppError } from "@/services/api/errors";
import { useAllActiveParishes } from "@/features/parishes/api";
import type { ParishDto } from "@/features/parishes/types";
import {
  getScheduleDraftAttachmentDownloadPath,
  useAvailabilityDates,
  useAvailableSlots,
  useCreateSchedule,
  useCreateScheduleDraft,
  useEligiblePriests,
  useRecommendations,
  useScheduleDraftDetail,
  useSchedulingConfiguration,
  useSubmitScheduleDraft,
  useUpdateScheduleDraft,
  useUploadScheduleDraftAttachment,
} from "./api";
import { scheduleKeys } from "./queryKeys";
import { SupportingFilePicker } from "@/features/requests/components/SupportingFilePicker";
import type { LocalSelectedFile } from "@/features/requests/types";
import {
  formatScheduleConfirmationRef,
  formatScheduleDate,
  makeSchedulePayloadSignature,
} from "./presentation";
import { makePrerequisiteUploadSignature } from "./prerequisiteUploads";
import {
  PREFERRED_PRIEST_HELPER_COPY,
  SuggestedTimeCard,
} from "./components/SuggestedTimeCard";
import type {
  ScheduleDraftAttachment,
  ScheduleEventType,
  ScheduleServiceRequirement,
} from "./types";

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

const AUTOSAVE_DEBOUNCE_MS = 1500;
type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function buildScheduleDraftSnapshot(
  parishId: number | null,
  eventType: ScheduleEventType | null,
  preferredDateValue: string | null,
  selectedDateValue: string | null,
  selectedSlotValue: string | null,
  priestId: number | null,
  venueValue: string | null,
  remarksValue: string,
): string {
  return JSON.stringify({
    parishId: parishId ?? null,
    eventType: eventType ?? null,
    preferredDate: preferredDateValue || selectedDateValue || null,
    date: selectedDateValue || null,
    timeSlot: selectedSlotValue || null,
    requestedPriestId: priestId || null,
    location: venueValue,
    remarks: remarksValue.trim() || null,
  });
}

export interface ScheduleWizardScreenProps {
  initialParishId?: string;
  draftId?: string;
}

export const ScheduleWizardScreen: React.FC<ScheduleWizardScreenProps> = ({
  initialParishId,
  draftId: propDraftId,
}) => {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ parishId?: string; draftId?: string }>();
  const routeParishId = initialParishId ?? searchParams.parishId;
  const routeDraftId = propDraftId ?? searchParams.draftId;
  const { profile, user } = useAuth();
  const feedback = useFeedback();
  const reduceMotion = useReducedMotion();
  const { contentBottomInset, onBottomActionLayout } = useAppLayoutMetrics();
  const today = useMemo(() => getManilaDateParts(), []);

  const [createdDraftIdState, setCreatedDraftIdState] = useState<number | null>(() => {
    if (!routeDraftId) return null;
    const parsedId = Number(routeDraftId);
    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  });
  const createdDraftIdRef = useRef<number | null>(createdDraftIdState);
  const [hydratedDraftId, setHydratedDraftId] = useState<number | null>(null);
  const [prevRouteDraftId, setPrevRouteDraftId] = useState(routeDraftId);
  if (routeDraftId !== prevRouteDraftId) {
    setPrevRouteDraftId(routeDraftId);
    const parsedId = routeDraftId ? Number(routeDraftId) : null;
    if (parsedId && Number.isFinite(parsedId) && parsedId > 0) {
      setCreatedDraftIdState(parsedId);
      createdDraftIdRef.current = parsedId;
    }
  }

  useEffect(() => {
    createdDraftIdRef.current = createdDraftIdState;
  }, [createdDraftIdState]);

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
  const [parishSearch, setParishSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState({ year: today.year, month: today.month });

  const idempotencyKeysRef = useRef(new Map<string, string>());
  const draftIdempotencyKeyRef = useRef<string | null>(null);
  const lastRefreshAtRef = useRef(0);
  const inactiveAtRef = useRef<number | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const userEditSeqRef = useRef(0);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightAutosaveRef = useRef<Promise<void> | null>(null);
  const pendingResaveRef = useRef(false);
  const submittedOrDiscardedRef = useRef(false);
  const sessionUidRef = useRef<string | null>(null);
  const isUnmountedRef = useRef(false);
  const runAutosaveRef = useRef<() => Promise<void>>(async () => {});

  const clearAutosaveTimer = () => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  const markUserEdit = () => {
    if (submittedOrDiscardedRef.current) return;
    userEditSeqRef.current += 1;
  };

  useEffect(() => {
    const currentUid = user?.uid || null;
    if (sessionUidRef.current && currentUid !== sessionUidRef.current) {
      clearAutosaveTimer();
      pendingResaveRef.current = false;
      submittedOrDiscardedRef.current = !currentUid;
      userEditSeqRef.current = 0;
      lastSavedSnapshotRef.current = null;
      setAutosaveStatus("idle");
    } else if (!sessionUidRef.current && currentUid) {
      submittedOrDiscardedRef.current = false;
    }
    sessionUidRef.current = currentUid;
  }, [user?.uid]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      clearAutosaveTimer();
    };
  }, []);

  const existingDraftQuery =
    typeof useScheduleDraftDetail === "function"
      ? useScheduleDraftDetail(createdDraftIdState)
      : { data: undefined, isLoading: false, refetch: async () => ({ data: undefined }) };
  const existingDraft = existingDraftQuery?.data;
  const activeDraftId =
    createdDraftIdState ?? (existingDraft?.status === "DRAFT" ? existingDraft.id : null);

  if (existingDraft && existingDraft.status === "DRAFT" && hydratedDraftId !== existingDraft.id) {
    setHydratedDraftId(existingDraft.id);
    setCreatedDraftIdState(existingDraft.id);
    createdDraftIdRef.current = existingDraft.id;
    setSelectedParishId(existingDraft.parishId);
    setSelectedEventType(existingDraft.eventType);
    const restoredDate = existingDraft.date ?? null;
    const restoredPrefDate = existingDraft.preferredDate ?? restoredDate;
    setPreferredDate(restoredPrefDate);
    setSelectedDate(restoredDate);
    setSelectedSlot(existingDraft.timeSlot ?? null);
    setRequestedPriestId(existingDraft.requestedPriestId ?? null);
    setRemarks(existingDraft.remarks ?? "");
    lastSavedSnapshotRef.current = buildScheduleDraftSnapshot(
      existingDraft.parishId,
      existingDraft.eventType,
      restoredPrefDate,
      restoredDate,
      existingDraft.timeSlot ?? null,
      existingDraft.requestedPriestId ?? null,
      existingDraft.eventType === "WEDDING"
        ? (existingDraft.parishName || existingDraft.location || null)
        : null,
      existingDraft.remarks ?? "",
    );
    userEditSeqRef.current = 0;
    clearAutosaveTimer();
    pendingResaveRef.current = false;
    submittedOrDiscardedRef.current = false;
    setAutosaveStatus("saved");
    const calTarget = restoredDate || restoredPrefDate;
    if (calTarget && /^\d{4}-\d{2}-\d{2}$/.test(calTarget)) {
      const [yStr, mStr] = calTarget.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        setCalendarMonth({ year: y, month: m });
      }
    }
    if (currentStep < 3) {
      setCurrentStep(!restoredDate ? 3 : !existingDraft.timeSlot ? 4 : 5);
    }
  }

  const existingAttachmentsByReqId = useMemo(() => {
    const map: Record<string, ScheduleDraftAttachment> = {};
    if (existingDraft?.status === "DRAFT" && Array.isArray(existingDraft.attachments)) {
      for (const att of existingDraft.attachments) {
        if (att.requirementId && !map[att.requirementId]) {
          map[att.requirementId] = att;
        }
      }
    }
    return map;
  }, [existingDraft]);

  const { data: parishesData, isLoading: isLoadingParishes } = useAllActiveParishes();
  const parishes: ParishDto[] = useMemo(
    () => parishesData || [],
    [parishesData]
  );
  const filteredParishes = useMemo(() => {
    const q = parishSearch.trim().toLowerCase();
    if (!q) return parishes;
    return parishes.filter((parish) =>
      [parish.name, parish.municipalityCity, parish.address, parish.type]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [parishes, parishSearch]);
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
  const createDraftMutation =
    typeof useCreateScheduleDraft === "function"
      ? useCreateScheduleDraft()
      : { mutateAsync: async () => { throw new Error("Not supported"); }, isPending: false };
  const updateDraftMutation =
    typeof useUpdateScheduleDraft === "function"
      ? useUpdateScheduleDraft()
      : { mutateAsync: async () => { throw new Error("Not supported"); }, isPending: false };
  const uploadDraftAttachmentMutation =
    typeof useUploadScheduleDraftAttachment === "function"
      ? useUploadScheduleDraftAttachment()
      : { mutateAsync: async () => [], isPending: false };
  const submitDraftMutation =
    typeof useSubmitScheduleDraft === "function"
      ? useSubmitScheduleDraft()
      : { mutateAsync: async () => { throw new Error("Not supported"); }, isPending: false };

  const availableDateSet = useMemo(
    () => new Set(datesQuery.data?.dates || []),
    [datesQuery.data?.dates]
  );
  const firstAvailableDate = datesQuery.data?.dates?.[0] ?? null;
  const [prevAvailSyncKey, setPrevAvailSyncKey] = useState<string>("");
  const availSyncKey = `${selectedParishId ?? ""}|${selectedEventType ?? ""}|${firstAvailableDate ?? ""}`;
  if (availSyncKey !== prevAvailSyncKey) {
    setPrevAvailSyncKey(availSyncKey);
    if (firstAvailableDate && !selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(firstAvailableDate)) {
      const currentMonthPrefix = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}-`;
      const hasCurrentMonthAvailable = (datesQuery.data?.dates || []).some((d) =>
        d.startsWith(currentMonthPrefix)
      );
      if (!hasCurrentMonthAvailable) {
        const [yStr, mStr] = firstAvailableDate.split("-");
        const y = Number(yStr);
        const m = Number(mStr);
        if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
          setCalendarMonth({ year: y, month: m });
        }
      }
    }
  }
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
  const [replacingAttachmentIds, setReplacingAttachmentIds] = useState<Record<string, boolean>>({});
  const [removedRequirementIds, setRemovedRequirementIds] = useState<Record<string, boolean>>({});
  const [viewerFile, setViewerFile] = useState<{
    path: string;
    fileName: string;
    mimeType?: string;
    title?: string;
  } | null>(null);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");

  const requirementsComplete = useMemo(() => {
    if (!hasRequirements) return true;
    return requirements.every(
      (r) =>
        Boolean(requirementFiles[r.id]) ||
        (Boolean(existingAttachmentsByReqId[r.id]) && !removedRequirementIds[r.id])
    );
  }, [hasRequirements, requirements, requirementFiles, existingAttachmentsByReqId, removedRequirementIds]);

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
      markUserEdit();
      setSelectedParishId(parishId);
      setSelectedEventType(null);
      setPreferredDate(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setRequestedPriestId(null);
      setRequirementFiles({});
      setReplacingAttachmentIds({});
      setRemovedRequirementIds({});
      setErrorMessage(null);
    }
  };

  // When service changes, reset date & slot and files
  const handleSelectService = (eventType: ScheduleEventType) => {
    if (eventType !== selectedEventType) {
      markUserEdit();
      setSelectedEventType(eventType);
      setPreferredDate(null);
      setSelectedDate(null);
      setSelectedSlot(null);
      setRequirementFiles({});
      setReplacingAttachmentIds({});
      setRemovedRequirementIds({});
      setErrorMessage(null);
    }
  };

  const handleSelectDate = (date: string) => {
    markUserEdit();
    setPreferredDate(date);
    setSelectedDate(date);
    setSelectedSlot(null);
    setErrorMessage(null);
  };

  const getOrCreateDraftIdempotencyKey = () => {
    if (!draftIdempotencyKeyRef.current) {
      draftIdempotencyKeyRef.current = `sched-draft-${generateClientUuid()}`;
    }
    return draftIdempotencyKeyRef.current;
  };

  const hasDraftHooks =
    typeof useCreateScheduleDraft === "function" &&
    typeof useUpdateScheduleDraft === "function";

  const canAutosaveForm = Boolean(
    hasDraftHooks &&
      !submittedOrDiscardedRef.current &&
      !profile?.needsProfileCompletion &&
      !profile?.needsLegalNameConfirmation &&
      profile?.isGovernmentIdVerified &&
      !(createdDraftIdState && existingDraftQuery?.isLoading) &&
      selectedParishId &&
      selectedEventType
  );

  const resolvedVenueForSnapshot =
    selectedEventType === "WEDDING"
      ? (selectedParish?.name || existingDraft?.parishName || existingDraft?.location || null)
      : null;

  const currentFormSnapshot = buildScheduleDraftSnapshot(
    selectedParishId,
    selectedEventType,
    preferredDate,
    selectedDate,
    selectedSlot,
    requestedPriestId,
    resolvedVenueForSnapshot,
    remarks,
  );

  const persistFormDraftOnly = async (
    stageUpdater?: (msg: string) => void,
    includeRemovedAttachments = false
  ): Promise<number> => {
    let draftId =
      createdDraftIdRef.current ?? (existingDraft?.status === "DRAFT" ? existingDraft.id : null);
    const venueValue =
      selectedEventType === "WEDDING" && selectedParish?.name ? selectedParish.name : null;
    const removedIds = includeRemovedAttachments
      ? Object.keys(removedRequirementIds).filter(
          (id) => removedRequirementIds[id] && !requirementFiles[id]
        )
      : [];
    const inputSnapshot = buildScheduleDraftSnapshot(
      selectedParishId,
      selectedEventType,
      preferredDate,
      selectedDate,
      selectedSlot,
      requestedPriestId,
      selectedEventType === "WEDDING"
        ? (selectedParish?.name || existingDraft?.parishName || existingDraft?.location || null)
        : null,
      remarks,
    );

    if (!draftId) {
      stageUpdater?.("Saving schedule draft...");
      const createdDraft = await createDraftMutation.mutateAsync({
        payload: {
          parishId: selectedParishId!,
          eventType: selectedEventType!,
          preferredDate: preferredDate || selectedDate || null,
          date: selectedDate || null,
          timeSlot: selectedSlot || null,
          requestedPriestId: requestedPriestId || null,
          location: venueValue,
          remarks: remarks.trim() || null,
        },
        idempotencyKey: getOrCreateDraftIdempotencyKey(),
      });
      draftId = createdDraft.id;
      createdDraftIdRef.current = createdDraft.id;
      setCreatedDraftIdState(createdDraft.id);
      setHydratedDraftId(createdDraft.id);
    } else {
      stageUpdater?.("Updating schedule draft...");
      await updateDraftMutation.mutateAsync({
        draftId,
        payload: {
          parishId: selectedParishId!,
          eventType: selectedEventType!,
          preferredDate: preferredDate || selectedDate || null,
          date: selectedDate || null,
          timeSlot: selectedSlot || null,
          requestedPriestId: requestedPriestId || null,
          location: venueValue,
          remarks: remarks.trim() || null,
          ...(removedIds.length > 0 ? { removedRequirementIds: removedIds } : {}),
        },
      });
    }

    lastSavedSnapshotRef.current = inputSnapshot;
    return draftId;
  };

  const runAutosave = async () => {
    if (isUnmountedRef.current || submittedOrDiscardedRef.current || submittingRef.current) {
      return;
    }
    if (inFlightAutosaveRef.current) {
      pendingResaveRef.current = true;
      return;
    }
    if (!canAutosaveForm) return;
    if (currentFormSnapshot === lastSavedSnapshotRef.current) {
      setAutosaveStatus(activeDraftId ? "saved" : "idle");
      return;
    }
    let run: Promise<void> | null = null;
    run = (async () => {
      pendingResaveRef.current = false;
      const seqAtStart = userEditSeqRef.current;
      setAutosaveStatus("saving");
      try {
        await persistFormDraftOnly(undefined, false);
        if (isUnmountedRef.current || submittedOrDiscardedRef.current) return;
        if (userEditSeqRef.current !== seqAtStart || pendingResaveRef.current) {
          pendingResaveRef.current = true;
          setAutosaveStatus("pending");
        } else {
          setAutosaveStatus("saved");
        }
      } catch {
        if (isUnmountedRef.current || submittedOrDiscardedRef.current) return;
        setAutosaveStatus("error");
      } finally {
        if (inFlightAutosaveRef.current === run) {
          inFlightAutosaveRef.current = null;
        }
        if (
          pendingResaveRef.current &&
          !isUnmountedRef.current &&
          !submittedOrDiscardedRef.current &&
          !submittingRef.current
        ) {
          pendingResaveRef.current = false;
          clearAutosaveTimer();
          autosaveTimerRef.current = setTimeout(() => {
            autosaveTimerRef.current = null;
            void runAutosaveRef.current();
          }, AUTOSAVE_DEBOUNCE_MS);
        }
      }
    })();
    inFlightAutosaveRef.current = run;
    await run;
  };

  runAutosaveRef.current = runAutosave;

  useEffect(() => {
    if (
      isUnmountedRef.current ||
      submittedOrDiscardedRef.current ||
      userEditSeqRef.current === 0 ||
      (createdDraftIdState && existingDraftQuery?.isLoading)
    ) {
      return;
    }
    if (!canAutosaveForm) {
      clearAutosaveTimer();
      return;
    }
    if (currentFormSnapshot === lastSavedSnapshotRef.current) {
      clearAutosaveTimer();
      if (!inFlightAutosaveRef.current) {
        setAutosaveStatus(activeDraftId ? "saved" : "idle");
      }
      return;
    }
    if (inFlightAutosaveRef.current) {
      pendingResaveRef.current = true;
      setAutosaveStatus("pending");
      return;
    }
    setAutosaveStatus((prev) => (prev === "saving" ? prev : "pending"));
    clearAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void runAutosaveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [currentFormSnapshot, canAutosaveForm, createdDraftIdState, existingDraftQuery?.isLoading, activeDraftId]);

  const handleBack = useCallback(async () => {
    if (submittingRef.current || isSavingDraft) return;
    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
      setErrorMessage(null);
      return;
    }

    const hasPendingValidFormEdits = Boolean(
      canAutosaveForm &&
      userEditSeqRef.current > 0 &&
      currentFormSnapshot !== lastSavedSnapshotRef.current &&
      !submittedOrDiscardedRef.current
    );
    const hasLocalFiles = Object.keys(requirementFiles).length > 0;

    if (activeDraftId && hasPendingValidFormEdits) {
      clearAutosaveTimer();
      pendingResaveRef.current = false;
      if (inFlightAutosaveRef.current) {
        await inFlightAutosaveRef.current.catch(() => {});
      }
      try {
        await persistFormDraftOnly(undefined, false);
        setAutosaveStatus("saved");
      } catch {
        // Proceed with navigation even if an optional exit flush fails.
      }
      router.back();
      return;
    }

    if (!activeDraftId && hasPendingValidFormEdits && !hasLocalFiles) {
      clearAutosaveTimer();
      pendingResaveRef.current = false;
      if (inFlightAutosaveRef.current) {
        await inFlightAutosaveRef.current.catch(() => {});
      }
      try {
        await persistFormDraftOnly(undefined, false);
        setAutosaveStatus("saved");
        router.back();
        return;
      } catch {
        // Fall through to Discard confirmation if initial save failed.
      }
    }

    const hasProgress =
      !activeDraftId &&
      (Boolean(selectedEventType) ||
        Boolean(selectedDate) ||
        Boolean(remarks.trim()) ||
        (!routeParishId && Boolean(selectedParishId)));
    if (hasProgress) {
      Alert.alert(
        "Discard Schedule Request?",
        "Your current selections have not been submitted yet.",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              submittedOrDiscardedRef.current = true;
              clearAutosaveTimer();
              pendingResaveRef.current = false;
              router.back();
            },
          },
        ]
      );
      return;
    }
    clearAutosaveTimer();
    pendingResaveRef.current = false;
    if (inFlightAutosaveRef.current) {
      await inFlightAutosaveRef.current.catch(() => {});
    }
    router.back();
  }, [
    activeDraftId,
    canAutosaveForm,
    currentFormSnapshot,
    currentStep,
    isSavingDraft,
    persistFormDraftOnly,
    remarks,
    requirementFiles,
    routeParishId,
    router,
    selectedDate,
    selectedEventType,
    selectedParishId,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (viewerFile) {
        setViewerFile(null);
        return true;
      }
      if (submittingRef.current || isSavingDraft) return true;
      void handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack, isSavingDraft, viewerFile]);

  const persistDraftAndSelectedFiles = async (
    stageUpdater: (msg: string) => void
  ): Promise<number> => {
    const draftId = await persistFormDraftOnly(stageUpdater, true);

    const fileEntries = Object.entries(requirementFiles).filter(
      ([reqId]) => requirements.length === 0 || activeRequirementIds.has(reqId)
    );
    if (fileEntries.length > 0) {
      let count = 0;
      for (const [requirementId, file] of fileEntries) {
        count += 1;
        stageUpdater(`Uploading supporting document (${count} of ${fileEntries.length})...`);
        await uploadDraftAttachmentMutation.mutateAsync({
          draftId,
          requirementId,
          file,
        });
      }
    }

    setRequirementFiles({});
    setReplacingAttachmentIds({});
    setRemovedRequirementIds({});
    await existingDraftQuery.refetch?.();
    return draftId;
  };

  const handleSaveDraft = async () => {
    if (!selectedParishId || !selectedEventType || submittingRef.current || isSavingDraft) {
      if (!selectedParishId || !selectedEventType) {
        setErrorMessage("Please select a parish and service before saving a draft.");
      }
      return;
    }

    submittingRef.current = true;
    clearAutosaveTimer();
    pendingResaveRef.current = false;
    setIsSavingDraft(true);
    setErrorMessage(null);
    try {
      if (inFlightAutosaveRef.current) {
        await inFlightAutosaveRef.current.catch(() => {});
      }
      await persistDraftAndSelectedFiles((msg) => setSubmissionStage(msg));
      submittingRef.current = false;
      setIsSavingDraft(false);
      setSubmissionStage("");
      setAutosaveStatus("saved");

      if (typeof feedback.showConfirm === "function") {
        feedback.showConfirm(
          "Draft Saved",
          "Your schedule request draft has been saved. You can resume or submit it anytime from your Schedule tab.",
          () => {
            router.replace("/(app)/(tabs)/(schedule)" as any);
          },
          {
            confirmText: "View Drafts",
            cancelText: "Keep Editing",
          }
        );
      } else {
        feedback.showSuccess({
          title: "Draft Saved",
          message: "Your schedule request draft has been saved.",
        });
      }
    } catch (error: unknown) {
      submittingRef.current = false;
      setIsSavingDraft(false);
      setSubmissionStage("");
      const appError = isAppError(error) ? error : null;
      const msg =
        appError?.message ||
        (error instanceof Error ? error.message : null) ||
        "Failed to save your schedule draft. Please check your connection and try again.";
      setErrorMessage(msg);
      feedback.showError("Could Not Save Draft", msg);
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
    if (submittingRef.current || isSavingDraft || createMutation.isPending) return;

    if (profile?.needsProfileCompletion) {
      feedback.showWarning({
        title: "Profile Details Required",
        message: "Please complete your profile (full name and contact number) before scheduling an appointment.",
        confirmText: "Complete Profile",
        cancelText: "Cancel",
        onConfirm: () => {
          router.push("/(app)/profile/edit" as any);
        },
      });
      return;
    }

    if (profile?.needsLegalNameConfirmation) {
      feedback.showWarning({
        title: "Legal Name Confirmation Required",
        message: "Please confirm your official legal name in Edit Profile before verifying ID or scheduling.",
        confirmText: "Edit Profile",
        cancelText: "Cancel",
        onConfirm: () => {
          router.push("/(app)/profile/edit" as any);
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
    clearAutosaveTimer();
    pendingResaveRef.current = false;
    setIsSubmitting(true);
    try {
      if (inFlightAutosaveRef.current) {
        await inFlightAutosaveRef.current.catch(() => {});
      }
      const idempotencyKey = await getIdempotencyKey();
      const effectiveDraftId = createdDraftIdRef.current ?? activeDraftId;
      const created = effectiveDraftId
        ? await (async () => {
            const draftId = await persistDraftAndSelectedFiles((msg) => setSubmissionStage(msg));
            setSubmissionStage("Finalizing and submitting schedule request...");
            return submitDraftMutation.mutateAsync({
              draftId,
              payload: {
                parishId: selectedParishId,
                eventType: selectedEventType,
                preferredDate: preferredDate || selectedDate,
                date: selectedDate,
                timeSlot: selectedSlot,
                location:
                  selectedEventType === "WEDDING" && selectedParish?.name
                    ? selectedParish.name
                    : undefined,
                remarks: remarks.trim() || null,
                requestedPriestId: requestedPriestId || null,
              },
              idempotencyKey,
            });
          })()
        : await createMutation.mutateAsync({
            payload: {
              parishId: selectedParishId,
              eventType: selectedEventType,
              date: selectedDate,
              timeSlot: selectedSlot,
              location: selectedEventType === "WEDDING" && selectedParish?.name ? selectedParish.name : undefined,
              remarks: remarks.trim() || undefined,
              requestedPriestId: requestedPriestId || undefined,
            },
            requirements: hasRequirements ? requirements : undefined,
            files: hasRequirements ? requirementFiles : undefined,
            idempotencyKey,
          });
      submittedOrDiscardedRef.current = true;
      clearAutosaveTimer();
      pendingResaveRef.current = false;
      setAutosaveStatus("idle");
      setSubmissionStage("");
      feedback.showSuccess({
        title: "Schedule Request Submitted",
        message: `Your appointment request has been sent to ${selectedParish?.name || "the parish"} for review.`,
        referenceNumber: formatScheduleConfirmationRef(created.id, created.createdAt),
        confirmText: "View Details",
        onConfirm: () => {
          router.replace(`/(app)/schedule/${created.id}` as never);
        },
      });
    } catch (error: unknown) {
      setSubmissionStage("");
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
            router.push("/(app)/profile/edit" as any);
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
        setErrorMessage(
          activeDraftId
            ? "The selected time slot is no longer available. Your draft remains saved — please choose another valid slot."
            : "The selected time slot is no longer available. Please choose another slot."
        );
        setSelectedSlot(null);
        if (currentStep > 4) setCurrentStep(4);
        void refetchSlots();
        return;
      }

      if (code === "DATE_UNAVAILABLE") {
        setErrorMessage(
          activeDraftId
            ? "The selected date is no longer available. Your draft remains saved — please choose another valid date."
            : "The selected date is no longer available. Please choose another date."
        );
        setSelectedDate(null);
        setSelectedSlot(null);
        if (currentStep > 3) setCurrentStep(3);
        void refetchDates();
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
            onAction={() => router.push("/(app)/profile/edit" as any)}
          />
        </View>
      </Screen>
    );
  }

  if (profile?.needsLegalNameConfirmation) {
    return (
      <Screen safeArea style={styles.screen} testID="schedule-wizard-legal-name-blocked">
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
            title="Legal Name Confirmation Required"
            description="Confirm your official legal name in Edit Profile before verifying government ID or scheduling a parish appointment."
            icon="person-circle-outline"
            actionLabel="Edit Profile"
            onAction={() => router.push("/(app)/profile/edit" as any)}
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

  const renderAutosaveStatus = () =>
    autosaveStatus !== "idle" ? (
      <Text
        style={[
          styles.autosaveStatusText,
          autosaveStatus === "saved" && styles.autosaveStatusSaved,
          autosaveStatus === "error" && styles.autosaveStatusError,
        ]}
        accessibilityLiveRegion="polite"
        allowFontScaling
      >
        {autosaveStatus === "saving"
          ? "Saving..."
          : autosaveStatus === "saved"
            ? "All changes saved"
            : autosaveStatus === "error"
              ? "Unable to save changes"
              : "Unsaved changes"}
      </Text>
    ) : null;

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

              <RNTextInput
                value={parishSearch}
                onChangeText={setParishSearch}
                placeholder="Search parishes by name or municipality..."
                placeholderTextColor={colors.textMuted}
                style={styles.parishSearchInput}
                accessibilityLabel="Search parishes"
              />

              {isLoadingParishes ? (
                <>
                  <Skeleton height={60} borderRadius={radii.sm} />
                  <Skeleton height={60} borderRadius={radii.sm} />
                  <Skeleton height={60} borderRadius={radii.sm} />
                </>
              ) : filteredParishes.length === 0 ? (
                <EmptyState
                  icon="location-outline"
                  title={parishes.length === 0 ? "No parishes available" : "No matching parishes"}
                  description={
                    parishes.length === 0
                      ? "Please try again when parish directory information is available."
                      : "Try a different parish name or municipality."
                  }
                />
              ) : (
                <View style={styles.selectionList}>
                  {filteredParishes.map((parish) => (
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
                      onPress={() => {
                        if (requestedPriestId !== null) markUserEdit();
                        setRequestedPriestId(null);
                      }}
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
                          onPress={() => {
                            if (requestedPriestId !== priest.id) markUserEdit();
                            setRequestedPriestId(priest.id);
                          }}
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
                            markUserEdit();
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
                        markUserEdit();
                        setSelectedSlot(slot);
                        setErrorMessage(null);
                      }}
                      mode="radio"
                    />
                  ))}
                </View>
              )}

              {selectedEventType === "WEDDING" && selectedParish?.name ? (
                <View style={{ marginTop: spacing.md }}>
                  <RecordSection
                    title="Venue / Location"
                    fields={[
                      {
                        label: "Assigned Parish Venue",
                        value: selectedParish.name,
                      },
                    ]}
                  />
                  <Text style={styles.disclaimerText} allowFontScaling>
                    Automatically set to the selected parish for Marriage (Canonical Interview).
                  </Text>
                </View>
              ) : null}
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
                {requirements.map((req) => {
                  const savedAtt = !removedRequirementIds[req.id]
                    ? existingAttachmentsByReqId[req.id]
                    : undefined;
                  const isReplacing = Boolean(replacingAttachmentIds[req.id]);
                  if (savedAtt && activeDraftId && !requirementFiles[req.id] && !isReplacing) {
                    return (
                      <View
                        key={`${selectedParishId}-${selectedEventType}-${req.id}-saved`}
                        style={styles.savedAttachmentCard}
                      >
                        <View style={styles.savedAttachmentHeader}>
                          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                          <View style={styles.savedAttachmentInfo}>
                            <Text style={styles.savedAttachmentTitle} allowFontScaling>
                              {req.label}
                            </Text>
                            <Text style={styles.savedAttachmentName} numberOfLines={1} allowFontScaling>
                              Saved on draft: {savedAtt.fileName}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.savedAttachmentActions}>
                          <Pressable
                            onPress={() =>
                              setViewerFile({
                                path: getScheduleDraftAttachmentDownloadPath(
                                  activeDraftId,
                                  savedAtt.id
                                ),
                                fileName: savedAtt.fileName,
                                mimeType: savedAtt.fileType,
                                title: req.label,
                              })
                            }
                            style={styles.savedAttachmentBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`View saved ${req.label}`}
                          >
                            <Ionicons name="eye-outline" size={14} color={colors.primary} />
                            <Text style={styles.savedAttachmentBtnText} allowFontScaling>
                              View
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setReplacingAttachmentIds((prev) => ({ ...prev, [req.id]: true }))
                            }
                            style={styles.savedAttachmentBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Replace saved ${req.label}`}
                          >
                            <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                            <Text style={styles.savedAttachmentBtnText} allowFontScaling>
                              Replace
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  return (
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
                        setRemovedRequirementIds((prev) => ({ ...prev, [req.id]: false }));
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
                      disabled={createMutation.isPending || isSubmitting || isSavingDraft}
                    />
                  );
                })}
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
                    const savedAtt = !removedRequirementIds[req.id]
                      ? existingAttachmentsByReqId[req.id]
                      : undefined;
                    return {
                      label: req.label,
                      value: file
                        ? `${file.name} (${formatBytes(file.size)})`
                        : savedAtt
                          ? `${savedAtt.fileName} (Saved on draft)`
                          : "Missing",
                    };
                  })}
                />
              )}

              <View style={styles.notesContainer}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Venue, Location & Parish Notes (optional)
                </Text>
                <Text style={styles.disclaimerText} allowFontScaling>
                  For blessings, funerals, wake masses, or private ceremonies held outside the main parish church, include the exact chapel, home, funeral parlor, or cemetery address and any landmark. For parish church services, add intention names or special accessibility needs.
                </Text>
                <RNTextInput
                  value={remarks}
                  editable={!isSubmitting && !isSavingDraft}
                  onChangeText={(val) => {
                    markUserEdit();
                    setRemarks(val);
                  }}
                  placeholder="e.g., Main Parish Church, or Brgy. San Roque Chapel (near plaza), or Mass Intention names"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.notesInput}
                  maxLength={500}
                />
                <Text style={styles.disclaimerText} allowFontScaling>
                  Parish office staff will review and confirm your request and venue details.
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
          <View style={styles.actionStack}>
            <Button
              title="Continue to Date"
              accessibilityLabel="Continue to Date"
              variant="primary"
              size="lg"
              icon="arrow-forward"
              disabled={!selectedEventType || isSavingDraft}
              onPress={() => setCurrentStep(3)}
              style={styles.fullWidthAction}
            />
            <Button
              title={isSavingDraft ? submissionStage || "Saving Draft..." : "Save Draft"}
              accessibilityLabel="Save Draft"
              variant="outline"
              size="md"
              icon="bookmark-outline"
              loading={isSavingDraft}
              disabled={!selectedParishId || !selectedEventType || isSavingDraft || isSubmitting}
              onPress={() => {
                void handleSaveDraft();
              }}
              style={styles.fullWidthAction}
            />
            {renderAutosaveStatus()}
          </View>
        ) : currentStep === 3 ? (
          <View style={styles.actionStack}>
            <Button
              title="Continue to Time Slot"
              accessibilityLabel="Continue to Time Slot"
              variant="primary"
              size="lg"
              icon="arrow-forward"
              disabled={!selectedDate || isSavingDraft}
              onPress={() => setCurrentStep(4)}
              style={styles.fullWidthAction}
            />
            <Button
              title={isSavingDraft ? submissionStage || "Saving Draft..." : "Save Draft"}
              accessibilityLabel="Save Draft"
              variant="outline"
              size="md"
              icon="bookmark-outline"
              loading={isSavingDraft}
              disabled={!selectedParishId || !selectedEventType || isSavingDraft || isSubmitting}
              onPress={() => {
                void handleSaveDraft();
              }}
              style={styles.fullWidthAction}
            />
            {renderAutosaveStatus()}
          </View>
        ) : currentStep === 4 ? (
          <View style={styles.actionStack}>
            <Button
              title={hasRequirements ? "Continue to Upload Requirements" : "Continue to Confirmation"}
              accessibilityLabel={hasRequirements ? "Continue to Upload Requirements" : "Continue to Confirmation"}
              variant="primary"
              size="lg"
              icon="arrow-forward"
              disabled={!selectedSlot || isSavingDraft}
              onPress={() => setCurrentStep(5)}
              style={styles.fullWidthAction}
            />
            <Button
              title={isSavingDraft ? submissionStage || "Saving Draft..." : "Save Draft"}
              accessibilityLabel="Save Draft"
              variant="outline"
              size="md"
              icon="bookmark-outline"
              loading={isSavingDraft}
              disabled={!selectedParishId || !selectedEventType || isSavingDraft || isSubmitting}
              onPress={() => {
                void handleSaveDraft();
              }}
              style={styles.fullWidthAction}
            />
            {renderAutosaveStatus()}
          </View>
        ) : currentStep === 5 && hasRequirements ? (
          <View style={styles.actionStack}>
            <Button
              title="Continue to Confirmation"
              accessibilityLabel="Continue to Confirmation"
              variant="primary"
              size="lg"
              icon="arrow-forward"
              disabled={!requirementsComplete || isSavingDraft}
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
            <Button
              title={isSavingDraft ? submissionStage || "Saving Draft..." : "Save Draft"}
              accessibilityLabel="Save Draft"
              variant="outline"
              size="md"
              icon="bookmark-outline"
              loading={isSavingDraft}
              disabled={!selectedParishId || !selectedEventType || isSavingDraft || isSubmitting}
              onPress={() => {
                void handleSaveDraft();
              }}
              style={styles.fullWidthAction}
            />
            {renderAutosaveStatus()}
          </View>
        ) : currentStep === confirmationStep ? (
          <View style={styles.actionStack}>
            <Button
              title={isSubmitting && submissionStage ? submissionStage : "Submit Schedule Request"}
              accessibilityLabel="Submit Schedule Request"
              variant="primary"
              size="lg"
              icon="checkmark-circle-outline"
              loading={createMutation.isPending || isSubmitting}
              disabled={createMutation.isPending || isSubmitting || isSavingDraft || (hasRequirements && !requirementsComplete)}
              onPress={() => {
                void handleSubmit();
              }}
              style={styles.fullWidthAction}
            />
            <Button
              title={isSavingDraft ? submissionStage || "Saving Draft..." : "Save Draft"}
              accessibilityLabel="Save Draft"
              variant="outline"
              size="md"
              icon="bookmark-outline"
              loading={isSavingDraft}
              disabled={!selectedParishId || !selectedEventType || isSavingDraft || isSubmitting}
              onPress={() => {
                void handleSaveDraft();
              }}
              style={styles.fullWidthAction}
            />
            {renderAutosaveStatus()}
          </View>
        ) : null}
      </SafeBottomActionBar>

      {viewerFile ? (
        <SecureFileViewerModal
          visible={Boolean(viewerFile)}
          endpointPath={viewerFile?.path || null}
          fileName={viewerFile?.fileName || "attachment"}
          mimeType={viewerFile?.mimeType}
          title={viewerFile?.title}
          onClose={() => setViewerFile(null)}
        />
      ) : null}
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
  actionStack: {
    width: "100%",
    gap: spacing.xs,
  },
  savedAttachmentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  savedAttachmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  savedAttachmentInfo: {
    flex: 1,
  },
  savedAttachmentTitle: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  savedAttachmentName: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  savedAttachmentActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  savedAttachmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  savedAttachmentBtnText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  parishSearchInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  autosaveStatusText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  autosaveStatusSaved: {
    color: "#276749",
  },
  autosaveStatusError: {
    color: "#B42318",
  },
});
