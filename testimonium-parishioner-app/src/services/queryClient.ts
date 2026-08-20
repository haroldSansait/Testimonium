import { QueryClient } from "@tanstack/react-query";
import { isAppError } from "@/services/api/errors";

const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (isAppError(error)) {
    if (["AUTH", "FORBIDDEN", "VALIDATION", "NOT_FOUND", "CONFLICT", "RATE_LIMIT", "CANCELLED"].includes(error.kind)) return false;
    return error.retryable && failureCount < 2;
  }
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: shouldRetryQuery, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export const privateQueryKey = (firebaseUid: string, resource: string, ...parts: unknown[]) => [resource, firebaseUid, ...parts] as const;
export const isProtectedQueryKey = (queryKey: readonly unknown[]) => queryKey.includes("profile") || queryKey.some((value) => typeof value === "string" && value.length > 20);