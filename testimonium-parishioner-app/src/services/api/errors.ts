export type AppErrorKind =
  | "CONFIGURATION"
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
  if (status === 409) return "An account with this information already exists.";
  if (status === 413) return "File is larger than the 5 MB limit.";
  if (status === 415) return "Unsupported file type.";
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

  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined;
  const backendMessage = typeof data?.message === "string" ? data.message : undefined;
  const code = typeof data?.code === "string" ? data.code : undefined;
  const errors =
    data?.errors && typeof data.errors === "object"
      ? (data.errors as Record<string, string[]>)
      : undefined;

  const kind: AppErrorKind =
    response.status === 401
      ? "AUTH"
      : response.status === 403
        ? "FORBIDDEN"
        : response.status === 400 || response.status === 413 || response.status === 415 || response.status === 422
          ? "VALIDATION"
          : response.status === 409
            ? "CONFLICT"
            : response.status === 404
              ? "NOT_FOUND"
              : response.status === 429
                ? "RATE_LIMIT"
                : response.status >= 500
                  ? "SERVER"
                  : "UNKNOWN";

  // Only backend-provided application messages are used; arbitrary HTML/text is never surfaced.
  return new AppError({
    kind,
    status: response.status,
    code,
    fieldErrors: errors,
    retryAfterMs,
    retryable: kind === "SERVER" || kind === "RATE_LIMIT",
    // Server-error payloads can contain infrastructure details when a backend
    // is misconfigured. Preserve actionable 4xx business messages only.
    message: response.status >= 500 ? safeStatusMessage(response.status) : backendMessage || safeStatusMessage(response.status),
  });
};

export const firebaseErrorToAppError = (error: unknown): AppError => {
  if (isAppError(error)) return error;
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;

  if (code === "auth/email-already-in-use") {
    return new AppError({
      kind: "CONFLICT",
      code,
      message: "An account with this email already exists. Please sign in instead.",
    });
  }

  if (code === "auth/invalid-email") {
    return new AppError({
      kind: "VALIDATION",
      code,
      message: "Please enter a valid email address.",
    });
  }

  if (code === "auth/weak-password") {
    return new AppError({
      kind: "VALIDATION",
      code,
      message: "Password must be at least 6 characters.",
    });
  }

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return new AppError({
      kind: "AUTH",
      code,
      message: "The email address or password is incorrect.",
    });
  }

  if (code === "auth/too-many-requests") {
    return new AppError({
      kind: "RATE_LIMIT",
      code,
      message: "Too many attempts. Please try again later.",
      retryable: true,
    });
  }

  if (code === "auth/network-request-failed") {
    return new AppError({
      kind: "NETWORK",
      code,
      message: "Firebase Authentication could not be reached. Check the device internet connection and try again.",
      retryable: true,
    });
  }

  if (code === "auth/user-disabled") {
    return new AppError({
      kind: "FORBIDDEN",
      code,
      message: "This account has been disabled. Please contact the parish administration.",
    });
  }

  if (code === "auth/account-exists-with-different-credential") {
    return new AppError({
      kind: "CONFLICT",
      code,
      message: "An account already exists with this email address. Please sign in using your existing method.",
    });
  }

  const rawMessage =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : undefined;

  return new AppError({
    kind: "AUTH",
    code,
    message: rawMessage && !rawMessage.includes("Firebase:") ? rawMessage : "We could not complete that action. Please try again.",
  });
};

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
