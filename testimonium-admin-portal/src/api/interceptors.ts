import { AxiosError } from 'axios';
import { auth } from '@/config/firebase';
import api from '@/api/api';
import type { ApiError } from '@/types/api';

/**
 * Call this once at application startup (in main.tsx).
 *
 * Request interceptor  — attaches the Firebase ID Token as Bearer.
 * Response interceptor — surfaces 401/403 errors cleanly without swallowing.
 */
export function setupInterceptors(onUnauthorized?: () => void): void {
  // ── Request: attach Firebase ID Token ──────────────────────────────────────
  api.interceptors.request.use(
    async (config) => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: unknown) => Promise.reject(error)
  );

  // ── Response: structured error handling ────────────────────────────────────
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (error instanceof AxiosError && error.response) {
        const { status, data } = error.response;

        const apiError: ApiError = {
          status,
          message:
            (data as { message?: string })?.message ??
            error.message ??
            'An unexpected error occurred.',
          code: (data as { code?: string })?.code,
        };

        if (status === 401) {
          // Notify the AuthContext to clear session
          onUnauthorized?.();
          return Promise.reject(apiError);
        }

        if (status === 403) {
          return Promise.reject({
            ...apiError,
            message: apiError.message || 'You do not have permission to perform this action.',
          } satisfies ApiError);
        }

        return Promise.reject(apiError);
      }

      // Network errors, timeouts, etc.
      const networkError: ApiError = {
        status: 0,
        message:
          error instanceof Error ? error.message : 'Network error. Please check your connection.',
      };
      return Promise.reject(networkError);
    }
  );
}
