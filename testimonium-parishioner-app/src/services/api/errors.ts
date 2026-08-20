export type AppErrorKind =
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "AUTH"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "SERVER"
  | "UNKNOWN";

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(options: {
    kind: AppErrorKind;
    message: string;
    status?: number;
    code?: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
    retryAfterMs?: number;
  }) {
    super(options.message);
    this.name = "AppError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

const safeStatusMessage = (status: number) => {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have access to this action.";
  if (status === 404) return "The requested item is no longer available.";
  if (status === 413) return "The selected file is too large.";
  if (status === 429) return "Too many requests. Please try again later.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again.";
  return "We could not complete that request.";
};

export const appErrorFromResponse = async (response: Response): Promise<AppError> => {
  const retryAfterSeconds = Number(response.headers.get("Retry-After"));
  const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined;
  let payload: unknown;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      await response.text();
    }
  } catch {
    // The status still provides a safe, useful error classification.
  }

  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : undefined;
  const backendMessage = typeof data?.message === "string" ? data.message : undefined;
  const code = typeof data?.code === "string" ? data.code : undefined;
  const errors = data?.errors && typeof data.errors === "object" ? data.errors as Record<string, string[]> : undefined;
  const kind: AppErrorKind = response.status === 401 ? "AUTH"
    : response.status === 403 ? "FORBIDDEN"
    : response.status === 400 || response.status === 422 ? "VALIDATION"
    : response.status === 409 ? "CONFLICT"
    : response.status === 404 ? "NOT_FOUND"
    : response.status === 429 ? "RATE_LIMIT"
    : response.status >= 500 ? "SERVER"
    : "UNKNOWN";

  // Only backend-provided application messages are used; arbitrary HTML/text is never surfaced.
  return new AppError({
    kind,
    status: response.status,
    code,
    fieldErrors: errors,
    retryAfterMs,
    retryable: kind === "SERVER" || kind === "RATE_LIMIT",
    message: backendMessage || safeStatusMessage(response.status),
  });
};

export const firebaseErrorToAppError = (error: unknown): AppError => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
  const message = code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
    ? "The email address or password is incorrect."
    : code === "auth/too-many-requests"
      ? "Too many sign-in attempts. Please try again later."
      : code === "auth/network-request-failed"
        ? "A network connection is required to sign in."
        : "We could not complete sign-in. Please try again.";
  return new AppError({ kind: code === "auth/network-request-failed" ? "NETWORK" : "AUTH", code, message, retryable: code === "auth/network-request-failed" });
};

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;