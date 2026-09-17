import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiClient, type ApiRequestOptions } from "@/services/api/client";
import {
  getCurrentLocalMonthParams,
  getManilaThreeDayRange,
  parseEventDateOnly,
  sortEventsChronologically,
} from "./presentation";
import type { PublicEventDto, MonthParams } from "./types";

export const eventKeys = {
  all: ["events"] as const,
  months: () => [...eventKeys.all, "month"] as const,
  month: (params: MonthParams) => [...eventKeys.months(), params] as const,
  homeWindows: () => [...eventKeys.all, "home-window"] as const,
  homeWindow: (dates: string[]) => [...eventKeys.homeWindows(), ...dates] as const,
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

export const getMonthParamsForDateWindow = (dates: string[]): MonthParams[] =>
  Array.from(
    new Map(
      dates.map((date) => {
        const parsed = parseEventDateOnly(date);
        const params = { year: parsed.year, month: parsed.month };
        return [`${params.year}-${params.month}`, params] as const;
      })
    ).values()
  );

export const mergeEventsForDateWindow = (
  monthlyFeeds: PublicEventDto[][],
  dates: string[]
): PublicEventDto[] => {
  const allowedDates = new Set(dates);
  const deduplicated = new Map<string, PublicEventDto>();

  for (const event of monthlyFeeds.flat()) {
    const dateKey = parseEventDateOnly(event.eventDate).dateKey;
    if (!allowedDates.has(dateKey)) continue;
    deduplicated.set(`${typeof event.id}:${String(event.id)}`, event);
  }

  return sortEventsChronologically(Array.from(deduplicated.values()));
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

export const useThreeDayHomeEvents = (
  now = new Date(),
  queryOptions?: Omit<UseQueryOptions<PublicEventDto[], Error>, "queryKey" | "queryFn">
) => {
  const range = getManilaThreeDayRange(now);
  const monthParams = getMonthParamsForDateWindow(range.dates);

  return useQuery({
    queryKey: eventKeys.homeWindow(range.dates),
    queryFn: async ({ signal }) => {
      const monthlyFeeds = await Promise.all(
        monthParams.map((params) => fetchPublicEvents(params, { signal }))
      );
      return mergeEventsForDateWindow(monthlyFeeds, range.dates);
    },
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  });
};
