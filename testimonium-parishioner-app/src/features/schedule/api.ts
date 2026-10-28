import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api/client";
import { AppError } from "@/services/api/errors";
import { normalizeSupportingFile } from "@/features/requests/supportingUpload";
import type { LocalSelectedFile } from "@/features/requests/types";
import { scheduleKeys } from "./queryKeys";
import type {
  AvailabilityDatesResponse,
  CreateSchedulePayload,
  EligiblePriest,
  RecommendationRequestPayload,
  ScheduleRecommendationsResponse,
  ScheduleServiceRequirement,
  SchedulingConfiguration,
  ScheduleItem,
  ScheduleListResponse,
} from "./types";

export interface ScheduleListParams {
  scope?: "upcoming" | "history";
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export const fetchScheduleList = async (
  params?: ScheduleListParams
): Promise<ScheduleItem[]> => {
  const queryParams = new URLSearchParams();
  if (params?.scope) queryParams.set("scope", params.scope);
  if (params?.page) queryParams.set("page", String(params.page));
  if (params?.limit) queryParams.set("limit", String(params.limit));

  const queryString = queryParams.toString();
  const path = `/schedule-requests${queryString ? `?${queryString}` : ""}`;

  const res = await apiClient.request<ScheduleListResponse | ScheduleItem[]>({
    path,
    signal: params?.signal,
    auth: true,
  });

  if (Array.isArray(res)) {
    return res;
  }
  if (res && Array.isArray((res as ScheduleListResponse).data)) {
    return (res as ScheduleListResponse).data;
  }
  return [];
};

export const useScheduleList = (
  scope?: "upcoming" | "history",
  options?: Partial<UseQueryOptions<ScheduleItem[]>>
) => {
  const { user } = useAuth();
  return useQuery<ScheduleItem[]>({
    queryKey: scheduleKeys.lists(user?.uid, scope),
    queryFn: ({ signal }) => fetchScheduleList({ scope, signal }),
    enabled: Boolean(user?.uid),
    staleTime: 30 * 1000,
    ...options,
  });
};

export const fetchScheduleDetail = async (
  id: number | string,
  signal?: AbortSignal
): Promise<ScheduleItem> => {
  return apiClient.request<ScheduleItem>({
    path: `/schedule-requests/${id}`,
    signal,
    auth: true,
  });
};

export const useScheduleDetail = (
  id?: number | string | null,
  options?: Partial<UseQueryOptions<ScheduleItem>>
) => {
  const { user } = useAuth();
  return useQuery<ScheduleItem>({
    queryKey: scheduleKeys.detail(user?.uid, id ?? undefined),
    queryFn: ({ signal }) => fetchScheduleDetail(id!, signal),
    enabled: Boolean(user?.uid && id),
    staleTime: 0,
    ...options,
  });
};

export const fetchSchedulingConfiguration = async (
  parishId: number | string,
  signal?: AbortSignal
): Promise<SchedulingConfiguration> => {
  const queryParams = new URLSearchParams({ parishId: String(parishId) });
  return apiClient.request<SchedulingConfiguration>({
    path: `/schedule-requests/configuration?${queryParams.toString()}`,
    signal,
    auth: true,
  });
};

export const useSchedulingConfiguration = (
  parishId?: number | string | null,
  options?: Partial<UseQueryOptions<SchedulingConfiguration>>
) => {
  return useQuery<SchedulingConfiguration>({
    queryKey: scheduleKeys.configuration(parishId),
    queryFn: ({ signal }) => fetchSchedulingConfiguration(parishId!, signal),
    enabled: Boolean(parishId),
    staleTime: 0,
    refetchOnMount: "always",
    ...options,
  });
};

export const fetchAvailabilityDates = async (
  parishId: number | string,
  eventType: string,
  signal?: AbortSignal
): Promise<AvailabilityDatesResponse> => {
  const queryParams = new URLSearchParams({
    parishId: String(parishId),
    eventType,
  });
  return apiClient.request<AvailabilityDatesResponse>({
    path: `/schedule-requests/availability-dates?${queryParams.toString()}`,
    signal,
    auth: true,
  });
};

export const useAvailabilityDates = (
  parishId?: number | string | null,
  eventType?: string | null,
  options?: Partial<UseQueryOptions<AvailabilityDatesResponse>>
) => {
  return useQuery<AvailabilityDatesResponse>({
    queryKey: scheduleKeys.availabilityDates(parishId, eventType),
    queryFn: ({ signal }) => fetchAvailabilityDates(parishId!, eventType!, signal),
    enabled: Boolean(parishId && eventType),
    staleTime: 0,
    ...options,
  });
};

export const fetchAvailableSlots = async (
  parishId: number | string,
  date: string,
  eventType: string,
  signal?: AbortSignal
): Promise<string[]> => {
  const queryParams = new URLSearchParams({
    parishId: String(parishId),
    date,
    eventType,
  });
  const res = await apiClient.request<string[]>({
    path: `/schedule-requests/available-slots?${queryParams.toString()}`,
    signal,
    auth: true,
  });
  return Array.isArray(res) ? res : [];
};

export const useAvailableSlots = (
  parishId?: number | string | null,
  date?: string | null,
  eventType?: string | null,
  options?: Partial<UseQueryOptions<string[]>>
) => {
  return useQuery<string[]>({
    queryKey: scheduleKeys.availableSlots(parishId, date, eventType),
    queryFn: ({ signal }) => fetchAvailableSlots(parishId!, date!, eventType!, signal),
    enabled: Boolean(parishId && date && eventType),
    staleTime: 0,
    ...options,
  });
};

export const fetchEligiblePriests = async (
  parishId: number | string,
  signal?: AbortSignal
): Promise<EligiblePriest[]> => {
  const queryParams = new URLSearchParams({ parishId: String(parishId) });
  const res = await apiClient.request<EligiblePriest[]>({
    path: `/schedule-requests/eligible-priests?${queryParams.toString()}`,
    signal,
    auth: true,
  });
  return Array.isArray(res) ? res : [];
};

export const useEligiblePriests = (
  parishId?: number | string | null,
  options?: Partial<UseQueryOptions<EligiblePriest[]>>
) => {
  return useQuery<EligiblePriest[]>({
    queryKey: scheduleKeys.eligiblePriests(parishId),
    queryFn: ({ signal }) => fetchEligiblePriests(parishId!, signal),
    enabled: Boolean(parishId),
    staleTime: 60 * 1000,
    ...options,
  });
};

export const fetchRecommendations = async (
  payload: RecommendationRequestPayload,
  signal?: AbortSignal
): Promise<ScheduleRecommendationsResponse> => {
  return apiClient.request<ScheduleRecommendationsResponse>({
    path: "/schedule-requests/recommendations",
    method: "POST",
    body: payload,
    signal,
    auth: true,
  });
};

export const useRecommendations = (
  payload?: RecommendationRequestPayload | null,
  options?: Partial<UseQueryOptions<ScheduleRecommendationsResponse>>
) => {
  const isEnabled = Boolean(
    payload?.parishId && payload?.eventType && payload?.preferredDate
  );
  return useQuery<ScheduleRecommendationsResponse>({
    queryKey: scheduleKeys.recommendations(
      payload?.parishId,
      payload?.eventType,
      payload?.preferredDate,
      payload?.dateFrom,
      payload?.dateTo,
      payload?.preferredTimeSlot,
      payload?.requestedPriestId
    ),
    queryFn: ({ signal }) => fetchRecommendations(payload!, signal),
    enabled: isEnabled,
    staleTime: 30 * 1000,
    ...options,
  });
};

export interface CreateScheduleInput {
  payload: CreateSchedulePayload;
  idempotencyKey?: string | null;
  requirements?: ScheduleServiceRequirement[];
  files?: Record<string, LocalSelectedFile>;
}

export const createScheduleRequest = async (
  input: CreateScheduleInput
): Promise<ScheduleItem> => {
  const headers: Record<string, string> = {};
  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }

  const orderedRequirements = [...(input.requirements ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const missing = orderedRequirements.filter(
    (req) => !input.files?.[req.id]
  );
  if (missing.length > 0) {
    throw new AppError({
      kind: "VALIDATION",
      code: "MISSING_SCHEDULE_ATTACHMENTS",
      message: `Missing required prerequisite documents: ${missing.map((r) => r.label).join(", ")}.`,
    });
  }

  if (orderedRequirements.length > 3) {
    throw new AppError({
      kind: "VALIDATION",
      code: "TOO_MANY_ATTACHMENTS",
      message: "A maximum of 3 prerequisite documents can be submitted.",
    });
  }

  const requirementIds = orderedRequirements.map((r) => r.id);
  const normalizedFiles = orderedRequirements.map((r) => {
    const raw = input.files![r.id];
    return normalizeSupportingFile(raw);
  });

  const bookingPayload: Record<string, unknown> = {
    parishId: input.payload.parishId,
    eventType: input.payload.eventType,
    date: input.payload.date,
    timeSlot: input.payload.timeSlot,
  };
  if (input.payload.remarks?.trim()) {
    bookingPayload.remarks = input.payload.remarks.trim();
  }
  if (input.payload.requestedPriestId !== undefined && input.payload.requestedPriestId !== null) {
    bookingPayload.requestedPriestId = input.payload.requestedPriestId;
  }

  const createBody = () => {
    const formData = new FormData();
    formData.append("booking", JSON.stringify(bookingPayload));
    formData.append("requirementIds", JSON.stringify(requirementIds));
    for (const file of normalizedFiles) {
      formData.append("files", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as unknown as Blob);
    }
    return formData;
  };

  return apiClient.request<ScheduleItem>({
    path: "/schedule-requests/web",
    method: "POST",
    createBody,
    headers,
    isMultipart: true,
    timeoutMs: 60_000,
    auth: true,
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: createScheduleRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      if (user?.uid) {
        queryClient.invalidateQueries({ queryKey: scheduleKeys.lists(user.uid) });
      }
    },
  });
};

export interface RespondRescheduleInput {
  scheduleId: number | string;
  accept: boolean;
  expectedVersion: number;
}

export const respondRescheduleRequest = async (
  input: RespondRescheduleInput
): Promise<ScheduleItem> => {
  const body = {
    accept: input.accept,
    expectedVersion: input.expectedVersion,
  };
  return apiClient.request<ScheduleItem>({
    path: `/schedule-requests/${input.scheduleId}/respond-reschedule`,
    method: "POST",
    body,
    auth: true,
  });
};

export const useRespondReschedule = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: respondRescheduleRequest,
    onSuccess: (updated) => {
      if (user?.uid) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.detail(user.uid, updated.id),
        });
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.lists(user.uid),
        });
      }
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

export interface ProposeAlternativeDateInput {
  scheduleId: number | string;
  proposedDate: string;
  timeSlot: string;
  note?: string | null;
}

export const proposeAlternativeDate = async (input: ProposeAlternativeDateInput) =>
  apiClient.request<NonNullable<ScheduleItem["alternativeProposal"]>>({
    path: `/schedule-requests/${input.scheduleId}/alternative-proposals`,
    method: "POST",
    body: {
      proposedDate: input.proposedDate,
      timeSlot: input.timeSlot,
      note: input.note?.trim() || null,
    },
    auth: true,
  });

export const useProposeAlternativeDate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: proposeAlternativeDate,
    onSuccess: (_proposal, input) => {
      if (user?.uid) {
        queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(user.uid, input.scheduleId) });
        queryClient.invalidateQueries({ queryKey: scheduleKeys.lists(user.uid) });
      }
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

export interface WithdrawAlternativeDateInput {
  scheduleId: number | string;
  proposalId: number;
  expectedRevision: number;
}

export const withdrawAlternativeDate = async (input: WithdrawAlternativeDateInput) =>
  apiClient.request<NonNullable<ScheduleItem["alternativeProposal"]>>({
    path: `/schedule-requests/${input.scheduleId}/alternative-proposals/${input.proposalId}/withdraw`,
    method: "POST",
    body: { expectedRevision: input.expectedRevision },
    auth: true,
  });

export const useWithdrawAlternativeDate = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: withdrawAlternativeDate,
    onSuccess: (_proposal, input) => {
      if (user?.uid) {
        queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(user.uid, input.scheduleId) });
        queryClient.invalidateQueries({ queryKey: scheduleKeys.lists(user.uid) });
      }
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};

