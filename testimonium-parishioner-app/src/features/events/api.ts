import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiClient, type ApiRequestOptions } from "@/services/api/client";
import { getCurrentLocalMonthParams } from "./presentation";
import type { PublicEventDto, MonthParams } from "./types";

export const eventKeys = {
  all: ["events"] as const,
  months: () => [...eventKeys.all, "month"] as const,
  month: (params: MonthParams) => [...eventKeys.months(), params] as const,
};

export const fetchPublicEvents = async (
  params: MonthParams,
  options?: Partial<ApiRequestOptions>
): Promise<PublicEventDto[]> => {
  return apiClient.request<PublicEventDto[]>({
    path: `/parish-events/all?year=${params.year}&month=${params.month}`,
    ...options,
  });
};

export const useCurrentMonthEvents = (
  customParams?: MonthParams,
  queryOptions?: Omit<UseQueryOptions<PublicEventDto[], Error>, "queryKey" | "queryFn">
) => {
  const params = customParams || getCurrentLocalMonthParams();

  return useQuery({
    queryKey: eventKeys.month(params),
    queryFn: ({ signal }) => fetchPublicEvents(params, { signal }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...queryOptions,
  });
};
