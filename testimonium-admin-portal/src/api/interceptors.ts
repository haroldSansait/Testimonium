import { AxiosError, CanceledError } from 'axios';
import { auth } from '@/config/firebase';
import api from '@/api/api';
import type { ApiError } from '@/types/api';
import { SessionService } from '@/services/SessionService';
import { mutationCache, getSessionSignal } from '@/services/queryClient';

const pendingMutations = new WeakMap<object, ReturnType<typeof mutationCache>>();

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
      const sessionSignal = getSessionSignal();
      config.signal = config.signal ? AbortSignal.any([sessionSignal, config.signal as AbortSignal]) : sessionSignal;
      if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
        const mutation = mutationCache(config.url || '');
        pendingMutations.set(config, mutation);
        await mutation.cancel();
      }
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch {
          // Token fetch error — SessionService handles cleanup on 401
        }
      }
      return config;
    },
    (error: unknown) => Promise.reject(error)
  );

  // ── Response: structured error handling ────────────────────────────────────
  api.interceptors.response.use(
    async (response) => {
      if (response.config.signal?.aborted) throw new CanceledError();
      await pendingMutations.get(response.config)?.invalidate();
      return response;
    },
    (error: unknown) => {
      if (error instanceof AxiosError && error.config?.signal?.aborted) {
        return Promise.reject(new CanceledError());
      }
      if (error instanceof AxiosError && error.response) {
        const { status, data } = error.response;

        const apiError: ApiError = {
          status,
          message:
            (data as { message?: string })?.message ??
            'Your session has expired for security reasons. Please sign in again.',
          code: (data as { code?: string })?.code,
        };

        if (status === 401) {
          // Perform one clean idempotent logout without cryptic errors or loops
          onUnauthorized?.();
          SessionService.logout('expired');
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
