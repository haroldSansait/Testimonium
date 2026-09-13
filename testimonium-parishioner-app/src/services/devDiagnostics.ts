type DiagnosticDetails = Record<string, string | number | boolean | undefined>;

const diagnosticsEnabled =
  typeof __DEV__ !== "undefined" && __DEV__ && process.env.NODE_ENV !== "test";

export const devDiagnostic = (scope: string, message: string, details?: DiagnosticDetails) => {
  if (!diagnosticsEnabled) return;
  if (details) {
    console.info(`[${scope}][DEV] ${message}`, details);
    return;
  }
  console.info(`[${scope}][DEV] ${message}`);
};

export const safeErrorDetails = (error: unknown): DiagnosticDetails => {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: String(error) };
  }

  const appError = error as Error & {
    kind?: string;
    code?: string;
    status?: number;
    validationErrors?: { field?: string; message?: string }[];
  };

  const details: DiagnosticDetails = {
    name: appError.name,
    message: appError.message,
    kind: appError.kind,
    code: appError.code,
    status: appError.status,
  };

  if (appError.validationErrors && appError.validationErrors.length > 0) {
    details.validationDetails = appError.validationErrors
      .map((e) => `${e.field || "field"}: ${e.message || "invalid"}`)
      .join("; ");
  }

  return details;
};
