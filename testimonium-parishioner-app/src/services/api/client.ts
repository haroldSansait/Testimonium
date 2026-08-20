import { getApiBaseUrl } from "@/config/environment";
import { firebaseAuth } from "@/services/firebase";
import { emitSessionExpired } from "@/services/auth/sessionEvents";
import { createApiClient } from "./core";
export type { ApiRequestOptions } from "./core";
export { createApiClient, __resetTokenRefreshForTests } from "./core";
export const apiClient = createApiClient({ getCurrentUser: () => firebaseAuth.currentUser, getBaseUrl: getApiBaseUrl, onSessionExpired: emitSessionExpired });