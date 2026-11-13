import { useQuery, useInfiniteQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiClient, type ApiRequestOptions } from "@/services/api/client";
import type {
  ParishDto,
  ParishListFilters,
  ParishListResponse,
} from "./types";

export const parishKeys = {
  all: ["parishes"] as const,
  lists: () => [...parishKeys.all, "list"] as const,
  list: (filters: ParishListFilters) =>
    [...parishKeys.lists(), filters] as const,
  details: () => [...parishKeys.all, "detail"] as const,
  detail: (id: string | number) =>
    [...parishKeys.details(), String(id)] as const,
};

export const fetchParishes = async (
  filters: ParishListFilters = {},
  options?: Partial<ApiRequestOptions>
): Promise<ParishListResponse> => {
  const queryParams = new URLSearchParams();

  if (filters.search && filters.search.trim()) {
    queryParams.append("search", filters.search.trim());
  }

  if (filters.type && filters.type !== "all") {
    queryParams.append("type", filters.type);
  }

  if (filters.page) {
    queryParams.append("page", String(filters.page));
  }

  if (filters.limit) {
    queryParams.append("limit", String(filters.limit));
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/parishes?${queryString}` : "/parishes";

  return apiClient.request<ParishListResponse>({
    path,
    ...options,
  });
};

export const fetchParishById = async (
  id: string | number,
  options?: Partial<ApiRequestOptions>
): Promise<ParishDto> => {
  return apiClient.request<ParishDto>({
    path: `/parishes/${id}`,
    ...options,
  });
};

export const useParishes = (
  filters: ParishListFilters = {},
  queryOptions?: Omit<UseQueryOptions<ParishListResponse, Error>, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: parishKeys.list(filters),
    queryFn: ({ signal }) => fetchParishes(filters, { signal }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...queryOptions,
  });
};

export const useInfiniteParishes = (
  filters: Omit<ParishListFilters, "page"> = {},
  limit = 25
) => {
  return useInfiniteQuery({
    queryKey: parishKeys.list({ ...filters, limit }),
    queryFn: ({ pageParam = 1, signal }) =>
      fetchParishes({ ...filters, page: pageParam as number, limit }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage && lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const fetchAllActiveParishes = async (
  filters: Omit<ParishListFilters, "page" | "limit"> = {},
  options?: Partial<ApiRequestOptions>
): Promise<ParishDto[]> => {
  const pageSize = 100;
  const maxPages = 100;
  const allParishes: ParishDto[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchParishes(
      { ...filters, page, limit: pageSize },
      options
    );
    const items = response?.items || [];
    for (const parish of items) {
      const idKey = String(parish.id);
      if (seenIds.has(idKey)) continue;
      seenIds.add(idKey);
      if (!parish.status || parish.status.toLowerCase() === "active") {
        allParishes.push(parish);
      }
    }

    const totalPages = Number(response?.totalPages || 0);
    if (items.length === 0 || totalPages <= 0 || page >= totalPages) {
      break;
    }
  }

  return allParishes;
};

export const useAllActiveParishes = (
  filters: Omit<ParishListFilters, "page" | "limit"> = {},
  queryOptions?: Omit<UseQueryOptions<ParishDto[], Error>, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: [...parishKeys.lists(), "all-active", filters] as const,
    queryFn: ({ signal }) => fetchAllActiveParishes(filters, { signal }),
    staleTime: 10 * 60 * 1000,
    ...queryOptions,
  });
};

export const useParishDetail = (
  id: string | number | undefined | null,
  queryOptions?: Omit<UseQueryOptions<ParishDto, Error>, "queryKey" | "queryFn">
) => {
  const parishId = id ? String(id).trim() : "";
  const isValidId = /^[1-9]\d*$/.test(parishId);

  return useQuery({
    queryKey: parishKeys.detail(parishId),
    queryFn: ({ signal }) => fetchParishById(parishId, { signal }),
    enabled: isValidId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...queryOptions,
  });
};
