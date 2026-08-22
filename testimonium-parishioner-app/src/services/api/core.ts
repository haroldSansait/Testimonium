import type { User } from "@react-native-firebase/auth";
import { devDiagnostic, safeErrorDetails } from "@/services/devDiagnostics";
import { AppError, appErrorFromResponse } from "./errors";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
  isMultipart?: boolean;
  timeout?: number;
  headers?: HeadersInit;
}

type FetchImplementation = typeof fetch;

interface ApiClientDependencies {
  getCurrentUser: () => User | null;
  getBaseUrl: () => string;
  fetchImpl?: FetchImplementation;
  onSessionExpired?: () => void;
}

let tokenRefreshPromise: Promise<string> | null = null;

const refreshTokenSingleFlight = async (user: User): Promise<string> => {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = user.getIdToken(true).finally(() => {
      tokenRefreshPromise = null;
    });
  }
  return tokenRefreshPromise;
};

const combineSignals = (external: AbortSignal | undefined, timeout: number) => {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(external?.reason);
  if (external?.aborted) onAbort();
  else external?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
};

const responseData = async <T>(response: Response): Promise<T> => {
  if (
    response.status === 204 ||
    !(response.headers.get("content-type") ?? "").includes("application/json")
  ) {
    return undefined as T;
  }
  const payload = (await response.json()) as { data?: T };
  return (payload.data ?? payload) as T;
};

export const createApiClient = (dependencies: ApiClientDependencies) => ({
  async request<T>(options: ApiRequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const needsAuth = options.auth ?? true;
    const timeout = options.timeout ?? 30_000;
    const fetchImpl = dependencies.fetchImpl ?? fetch;
    const user = needsAuth ? dependencies.getCurrentUser() : null;

    if (needsAuth && !user) {
      throw new AppError({ kind: "AUTH", message: "Please sign in to continue." });
    }

    const path = options.path.startsWith("/") ? options.path : `/${options.path}`;

    const execute = async (forcedToken?: string) => {
      const combined = combineSignals(options.signal, timeout);
      const headers = new Headers(options.headers);
      if (!options.isMultipart && options.body !== undefined) {
        headers.set("Content-Type", "application/json");
      }

      if (needsAuth) {
        devDiagnostic("API", "Firebase ID token acquisition started", {
          forceRefresh: Boolean(forcedToken),
        });
        try {
          headers.set("Authorization", `Bearer ${forcedToken ?? (await user!.getIdToken(false))}`);
          devDiagnostic("API", "Firebase ID token acquisition succeeded", {
            forceRefresh: Boolean(forcedToken),
          });
        } catch (error) {
          devDiagnostic("API", "Firebase ID token acquisition failed", safeErrorDetails(error));
          throw error;
        }
      }

      const baseUrl = dependencies.getBaseUrl();
      const requestUrl = `${baseUrl}${path}`;
      devDiagnostic("API", "Resolved API base URL", { baseUrl });
      devDiagnostic("API", "HTTP request attempted", { method, path, requestUrl });
      try {
        const response = await fetchImpl(requestUrl, {
          method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : options.isMultipart
                ? (options.body as BodyInit)
                : JSON.stringify(options.body),
          signal: combined.signal,
        });
        devDiagnostic("API", "HTTP response received", {
          method,
          path,
          status: response.status,
        });
        return response;
      } catch (error) {
        devDiagnostic("API", "Raw fetch exception", {
          method,
          path,
          ...safeErrorDetails(error),
        });

        let normalized: AppError;
        if (combined.wasTimedOut()) {
          normalized = new AppError({
            kind: "TIMEOUT",
            code: "API_REQUEST_TIMEOUT",
            message: "The TESTIMONIUM backend did not respond in time. Please try again.",
            retryable: true,
          });
        } else if (options.signal?.aborted) {
          normalized = new AppError({
            kind: "CANCELLED",
            message: "Request cancelled.",
          });
        } else {
          normalized = new AppError({
            kind: "NETWORK",
            code: "BACKEND_UNREACHABLE",
            message:
              "The TESTIMONIUM backend could not be reached. Check the configured API URL or development tunnel and try again.",
            retryable: true,
          });
        }
        devDiagnostic("API", "Normalized API error", safeErrorDetails(normalized));
        throw normalized;
      } finally {
        combined.cleanup();
      }
    };

    let response = await execute();
    if (needsAuth && response.status === 401) {
      devDiagnostic("API", "HTTP 401 received; refreshing Firebase ID token once", {
        method,
        path,
      });
      response = await execute(await refreshTokenSingleFlight(user!));
      if (response.status === 401) dependencies.onSessionExpired?.();
    }
    if (!response.ok) {
      const normalized = await appErrorFromResponse(response);
      devDiagnostic("API", "Normalized HTTP API error", safeErrorDetails(normalized));
      throw normalized;
    }
    return responseData<T>(response);
  },
});

export const __resetTokenRefreshForTests = () => {
  tokenRefreshPromise = null;
};
