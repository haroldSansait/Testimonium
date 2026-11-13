import { Linking, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { getApiBaseUrl } from "@/config/environment";
import { firebaseAuth } from "@/services/firebase";
import { AppError } from "@/services/api/errors";

export interface SecureFileDescriptor {
  path: string;
  fileName: string;
  mimeType?: string | null;
}

export interface DownloadedSecureFile {
  uri: string;
  fileName: string;
  mimeType: string;
  isImage: boolean;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic"]);

export const sanitizeFileName = (rawName?: string | null, fallback = "document"): string => {
  const base = (rawName || fallback).trim() || fallback;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || fallback;
};

export const inferMimeType = (fileName?: string | null, mimeType?: string | null): string => {
  const explicit = (mimeType || "").trim().toLowerCase();
  if (explicit && explicit !== "application/octet-stream") {
    return explicit;
  }
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "ics") return "text/calendar";
  return explicit || "application/octet-stream";
};

export const isPreviewableImage = (fileName?: string | null, mimeType?: string | null): boolean => {
  const resolved = inferMimeType(fileName, mimeType);
  if (resolved.startsWith("image/")) return true;
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.has(ext);
};

const getAuthToken = async (forceRefresh = false): Promise<string> => {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new AppError({
      kind: "AUTH",
      code: "AUTH_REQUIRED",
      message: "Please sign in to access private documents.",
    });
  }
  return user.getIdToken(forceRefresh);
};

export const downloadSecureFileToCache = async (
  descriptor: SecureFileDescriptor
): Promise<DownloadedSecureFile> => {
  const normalizedPath = descriptor.path.startsWith("/")
    ? descriptor.path
    : `/${descriptor.path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;
  const safeName = `${Date.now()}-${sanitizeFileName(descriptor.fileName)}`;
  const cacheDir = new Directory(Paths.cache, "secure-files");
  if (!cacheDir.exists) {
    cacheDir.create({ intermediates: true, idempotent: true });
  }
  const targetFile = new File(cacheDir, safeName);

  const attemptDownload = async (forceRefresh: boolean) => {
    const token = await getAuthToken(forceRefresh);
    return File.downloadFileAsync(url, targetFile, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
  };

  let downloaded: File;
  try {
    downloaded = await attemptDownload(false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401")) {
      downloaded = await attemptDownload(true);
    } else if (msg.includes("404")) {
      throw new AppError({
        kind: "NOT_FOUND",
        code: "FILE_NOT_FOUND",
        message: "This document file is no longer available on the server.",
      });
    } else if (msg.includes("403")) {
      throw new AppError({
        kind: "FORBIDDEN",
        code: "FILE_FORBIDDEN",
        message: "You do not have permission to access this file.",
      });
    } else {
      throw new AppError({
        kind: "NETWORK",
        code: "FILE_DOWNLOAD_FAILED",
        message: "Unable to download the file securely. Please check your connection and try again.",
        retryable: true,
      });
    }
  }

  const mimeType = inferMimeType(descriptor.fileName, descriptor.mimeType);
  return {
    uri: downloaded.uri,
    fileName: descriptor.fileName,
    mimeType,
    isImage: isPreviewableImage(descriptor.fileName, mimeType),
  };
};

export const openLocalFileExternally = async (localUri: string): Promise<boolean> => {
  try {
    const targetUri =
      Platform.OS === "android" && localUri.startsWith("file://")
        ? await getContentUriAsync(localUri)
        : localUri;
    await Linking.openURL(targetUri);
    return true;
  } catch {
    return false;
  }
};

export const saveCachedFileToDevice = async (
  cached: Pick<DownloadedSecureFile, "uri" | "fileName" | "mimeType">
): Promise<{ saved: boolean; canceled?: boolean; savedFileName?: string }> => {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (msg.includes("cancel")) {
      return { saved: false, canceled: true };
    }
    throw err;
  }

  const sourceFile = new File(cached.uri);
  const bytes = await sourceFile.bytes();
  const safeName = sanitizeFileName(cached.fileName);
  const destFile = directory.createFile(safeName, cached.mimeType || "application/octet-stream");
  destFile.write(bytes);
  return { saved: true, savedFileName: destFile.name || safeName };
};

