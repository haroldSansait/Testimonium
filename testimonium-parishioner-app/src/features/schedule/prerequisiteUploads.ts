import { getInfoAsync } from "expo-file-system/legacy";
import { normalizeSupportingFile } from "@/features/requests/supportingUpload";
import type { LocalSelectedFile } from "@/features/requests/types";
import { AppError, isAppError } from "@/services/api/errors";

/**
 * Re-read native content on every submission, including retries. Picker cache URIs,
 * names and reported sizes do not identify file contents. MD5 is only a local
 * change detector from the existing Expo dependency; the server independently
 * validates content and binds its authoritative idempotency hash with SHA-256.
 */
export const makePrerequisiteUploadSignature = async (
  files?: Record<string, LocalSelectedFile> | null
): Promise<string> => {
  const fingerprints: [string, string][] = [];
  for (const [id, file] of Object.entries(files ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const normalized = normalizeSupportingFile(file);
    try {
      const info = await getInfoAsync(normalized.uri, { md5: true });
      if (!info.exists || info.isDirectory || !info.md5 || !/^[a-f0-9]{32}$/i.test(info.md5)) {
        throw new Error("Unreadable prerequisite file");
      }
      // Validate actual bytes even if the document provider omitted or misstated size.
      normalizeSupportingFile({ ...normalized, size: info.size });
      fingerprints.push([id, info.md5.toLowerCase()]);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError({
        kind: "VALIDATION",
        code: "UPLOAD_BODY_UNREADABLE",
        message: "A prerequisite document is no longer readable. Please select it again.",
      });
    }
  }
  return JSON.stringify(fingerprints);
};
