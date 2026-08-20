import { apiClient } from "../client";
import type { BackendUserProfile } from "@/types/auth";

export const authApi = {
  login: () => apiClient.request<{ user: BackendUserProfile }>({ method: "POST", path: "/auth/login", body: {} }),
  profile: () => apiClient.request<BackendUserProfile>({ path: "/auth/profile" }),
};