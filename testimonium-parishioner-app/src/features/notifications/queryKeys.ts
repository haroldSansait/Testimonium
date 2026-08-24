export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId?: number | string | null) =>
    [...notificationKeys.all, "list", userId ?? "anon"] as const,
};
