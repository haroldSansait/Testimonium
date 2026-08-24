import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api/client";
import { notificationKeys } from "./queryKeys";
import type { NotificationItem } from "./types";

export const fetchNotifications = async (
  signal?: AbortSignal
): Promise<NotificationItem[]> => {
  const res = await apiClient.request<NotificationItem[] | { data: NotificationItem[] }>({
    path: "/notifications",
    signal,
    auth: true,
  });

  if (Array.isArray(res)) {
    return res;
  }
  if (res && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
};

export const useNotifications = (
  options?: Partial<UseQueryOptions<NotificationItem[]>>
) => {
  const { user } = useAuth();
  return useQuery<NotificationItem[]>({
    queryKey: notificationKeys.list(user?.uid),
    queryFn: ({ signal }) => fetchNotifications(signal),
    enabled: Boolean(user?.uid),
    staleTime: 30 * 1000,
    ...options,
  });
};

export const useUnreadNotificationCount = (): number => {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter((n) => !n.isRead).length;
};

export const markNotificationRead = async (
  id: number | string
): Promise<NotificationItem> => {
  return apiClient.request<NotificationItem>({
    path: `/notifications/${id}/read`,
    method: "PATCH",
    auth: true,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listKey = notificationKeys.list(user?.uid);

  return useMutation({
    mutationFn: (id: number | string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(listKey);

      if (previous) {
        queryClient.setQueryData<NotificationItem[]>(
          listKey,
          previous.map((item) =>
            item.id === Number(id)
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item
          )
        );
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
};

export const markAllNotificationsRead = async (): Promise<{ count: number }> => {
  return apiClient.request<{ count: number }>({
    path: "/notifications/read-all",
    method: "PATCH",
    auth: true,
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listKey = notificationKeys.list(user?.uid);

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(listKey);

      if (previous) {
        queryClient.setQueryData<NotificationItem[]>(
          listKey,
          previous.map((item) => ({
            ...item,
            isRead: true,
            readAt: item.readAt || new Date().toISOString(),
          }))
        );
      }

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
};
