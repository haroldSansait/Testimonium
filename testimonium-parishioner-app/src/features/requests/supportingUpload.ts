import { AppError, isAppError } from "@/services/api/errors";
import type { LocalSelectedFile } from "./types";

export const MAX_SUPPORTING_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type SupportedExtension = keyof typeof MIME_BY_EXTENSION;
export type SupportedSupportingMime = (typeof MIME_BY_EXTENSION)[SupportedExtension];
export type NormalizedSupportingFile = Omit<LocalSelectedFile, "mimeType"> & {
  mimeType: SupportedSupportingMime;
};

const EXTENSION_BY_MIME: Record<SupportedSupportingMime, SupportedExtension> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const invalidFileError = (code: string) =>
  new AppError({
    kind: "VALIDATION",
    code,
    message:
      "The selected file could not be uploaded. Choose a PDF, JPEG, PNG, or WebP file under 5 MB.",
  });

const normalizedMime = (value?: string | null): SupportedSupportingMime | undefined => {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") return undefined;
  if (mime === "image/jpg") return "image/jpeg";
  if (Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, mime)) {
    return mime as SupportedSupportingMime;
  }
  throw invalidFileError("UNSUPPORTED_FILE_TYPE");
};

const extensionFromName = (name: string): SupportedExtension | undefined => {
  const match = name.match(/\.([a-z0-9]+)$/i);
  if (!match) return undefined;
  const extension = match[1].toLowerCase();
  if (Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, extension)) {
    return extension as SupportedExtension;
  }
  throw invalidFileError("UNSUPPORTED_FILE_EXTENSION");
};

const safeName = (value?: string) =>
  value
    ?.replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .trim();

export const normalizeSupportingFile = (
  file: LocalSelectedFile
): NormalizedSupportingFile => {
  const uri = file.uri?.trim();
  if (!uri || !/^(file|content):\/\//i.test(uri)) {
    throw invalidFileError("UNREADABLE_FILE_URI");
  }

  if (
    file.size !== undefined &&
    (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_SUPPORTING_FILE_SIZE_BYTES)
  ) {
    throw invalidFileError(
      file.size > MAX_SUPPORTING_FILE_SIZE_BYTES ? "FILE_TOO_LARGE" : "EMPTY_FILE"
    );
  }

  let name = safeName(file.name) || "";
  const mimeFromAsset = normalizedMime(file.mimeType);
  let extension = extensionFromName(name);

  if (!extension && !mimeFromAsset) {
    throw invalidFileError("UNKNOWN_FILE_TYPE");
  }

  if (!extension && mimeFromAsset) {
    extension = EXTENSION_BY_MIME[mimeFromAsset];
    name = name ? `${name}.${extension}` : `attachment.${extension}`;
  }

  const mimeFromExtension = MIME_BY_EXTENSION[extension!];
  if (mimeFromAsset && mimeFromAsset !== mimeFromExtension) {
    throw invalidFileError("FILE_TYPE_MISMATCH");
  }

  return {
    ...file,
    uri,
    name,
    mimeType: mimeFromAsset ?? mimeFromExtension,
  };
};

export const buildSupportingFileFormData = (
  file: LocalSelectedFile,
  category: string
): FormData => {
  const normalized = normalizeSupportingFile(file);
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    throw new AppError({
      kind: "VALIDATION",
      code: "MISSING_ATTACHMENT_CATEGORY",
      message: "The attachment requirement is missing. Refresh the draft and try again.",
    });
  }

  const formData = new FormData();
  formData.append(
    "files",
    {
      uri: normalized.uri,
      name: normalized.name,
      type: normalized.mimeType,
    } as unknown as Blob
  );
  formData.append("category", normalizedCategory);
  return formData;
};

export const supportingUploadError = (error: unknown): AppError => {
  if (isAppError(error)) {
    if (error.kind === "AUTH" || error.kind === "FORBIDDEN") return error;
    if (error.status === 413) {
      return new AppError({ kind: "VALIDATION", status: 413, message: "File is larger than the 5 MB limit." });
    }
    if (error.status === 415) {
      return new AppError({ kind: "VALIDATION", status: 415, message: "Unsupported file type." });
    }
    if (error.kind === "VALIDATION") return error;
    if (error.kind === "NETWORK") {
      return new AppError({
        kind: "NETWORK",
        code: error.code,
        message: "Unable to connect to TESTIMONIUM.",
        retryable: true,
      });
    }
    if (error.kind === "TIMEOUT") {
      return new AppError({
        kind: "TIMEOUT",
        code: error.code,
        message: "Upload timed out. Your draft is safe. Check the draft before trying again.",
        retryable: true,
      });
    }
  }

  return new AppError({
    kind: "UNKNOWN",
    code: "SUPPORTING_UPLOAD_FAILED",
    message: "We couldn't upload this attachment. Your request is saved as a draft.",
    retryable: true,
  });
};
