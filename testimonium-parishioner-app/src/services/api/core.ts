import type { User } from "@react-native-firebase/auth";
import { fetch as reactNativeFetch } from "whatwg-fetch";
import { devDiagnostic, safeErrorDetails } from "@/services/devDiagnostics";
import { AppError, appErrorFromResponse } from "./errors";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  createBody?: () => unknown;
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
  const payload = (await response.json()) as Record<string, unknown>;

  // Paginated endpoints return metadata beside `data`, so unwrapping only
  // `data` would discard pagination and change the response into a bare array.
  if (Object.prototype.hasOwnProperty.call(payload, "pagination")) {
    return payload as T;
  }

  return (payload.data ?? payload) as T;
};

const transportError = (error: unknown): AppError => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unsupported formdatapart implementation") ||
    normalized.includes("unsupported formdata implementation") ||
    normalized.includes("could not retrieve file for uri")
  ) {
    return new AppError({
      kind: "VALIDATION",
      code: "UPLOAD_BODY_UNREADABLE",
      message:
        "The selected file could not be uploaded. Choose a PDF, JPEG, PNG, or WebP file under 5 MB.",
    });
  }

  if (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.startsWith("fetch failed") ||
    normalized.includes("connection refused") ||
    normalized.includes("unable to resolve host")
  ) {
    return new AppError({
      kind: "NETWORK",
      code: "API_CONNECTION_FAILED",
      message: "Unable to connect to TESTIMONIUM.",
      retryable: true,
    });
  }

  return new AppError({
    kind: "UNKNOWN",
    code: "REQUEST_TRANSPORT_FAILED",
    message: "We could not complete that request. Please try again.",
    retryable: true,
  });
};

export const createApiClient = (dependencies: ApiClientDependencies) => ({
  async request<T>(options: ApiRequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const needsAuth = options.auth ?? true;
    const timeout = options.timeout ?? 30_000;
    // Expo SDK 57 installs expo/fetch globally. expo/fetch cannot serialize React Native's
    // proprietary { uri, name, type } FormData file parts, while RN's fetch polyfill can.
    const fetchImpl =
      dependencies.fetchImpl ?? (options.isMultipart ? reactNativeFetch : fetch);
    const user = needsAuth ? dependencies.getCurrentUser() : null;

    if (needsAuth && !user) {
      throw new AppError({ kind: "AUTH", message: "Please sign in to continue." });
    }

    if (options.body !== undefined && options.createBody) {
      throw new AppError({
        kind: "CONFIGURATION",
        code: "AMBIGUOUS_REQUEST_BODY",
        message: "A request cannot define both body and createBody.",
      });
    }

    const path = options.path.startsWith("/") ? options.path : `/${options.path}`;

    const execute = async (forcedToken?: string) => {
      const combined = combineSignals(options.signal, timeout);
      try {
        const requestBody = options.createBody ? options.createBody() : options.body;
        const requestHeaders: Record<string, string> = {};
        if (options.headers) {
          if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => {
              requestHeaders[key] = value;
            });
          } else if (Array.isArray(options.headers)) {
            options.headers.forEach(([key, value]) => {
              requestHeaders[key] = value;
            });
          } else {
            Object.assign(requestHeaders, options.headers);
          }
        }

        if (!options.isMultipart && requestBody !== undefined) {
          requestHeaders["Content-Type"] = "application/json";
        } else if (options.isMultipart) {
          delete requestHeaders["Content-Type"];
          delete requestHeaders["content-type"];
        }

        if (needsAuth) {
          devDiagnostic("API", "Firebase ID token acquisition started", {
            forceRefresh: Boolean(forcedToken),
          });
          try {
            requestHeaders["Authorization"] = `Bearer ${forcedToken ?? (await user!.getIdToken(false))}`;
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
        const response = await fetchImpl(requestUrl, {
          method,
          headers: requestHeaders,
          body:
            requestBody === undefined
              ? undefined
              : options.isMultipart
                ? (requestBody as BodyInit)
                : JSON.stringify(requestBody),
          signal: combined.signal,
        });
        devDiagnostic("API", "HTTP response received", {
          method,
          path,
          status: response.status,
        });
        return response;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

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
        } else normalized = transportError(error);
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
