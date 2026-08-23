import { AppError } from "@/services/api/errors";
import {
  buildSupportingFileFormData,
  normalizeSupportingFile,
  supportingUploadError,
} from "@/features/requests/supportingUpload";
import type { LocalSelectedFile } from "@/features/requests/types";

const OriginalFormData = globalThis.FormData;

class ReactNativeFormDataCapture {
  readonly _parts: [string, unknown][] = [];

  append(name: string, value: unknown) {
    this._parts.push([name, value]);
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, "FormData", {
    configurable: true,
    value: ReactNativeFormDataCapture,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "FormData", {
    configurable: true,
    value: OriginalFormData,
  });
});
const selectedFile = (
  overrides: Partial<LocalSelectedFile> = {}
): LocalSelectedFile => ({
  requirementId: "valid_id",
  requirementLabel: "Valid ID",
  uri: "file:///data/user/0/com.testimonium.app/cache/DocumentPicker/id.jpg",
  name: "id.jpg",
  size: 128_000,
  mimeType: "image/jpeg",
  ...overrides,
});

describe("supporting file normalization", () => {
  it.each([
    ["valid-id.jpg", "image/jpeg", "image/jpeg"],
    ["valid-id.jpeg", "image/jpg", "image/jpeg"],
    ["valid-id.png", "image/png", "image/png"],
    ["valid-id.webp", "image/webp", "image/webp"],
    ["valid-id.pdf", "application/pdf", "application/pdf"],
  ])("normalizes %s with a valid MIME", (name, mimeType, expectedMime) => {
    expect(normalizeSupportingFile(selectedFile({ name, mimeType }))).toMatchObject({
      name,
      mimeType: expectedMime,
    });
  });

  it.each([
    ["valid-id.jpg", null, "image/jpeg"],
    ["valid-id.png", undefined, "image/png"],
    ["valid-id.webp", undefined, "image/webp"],
    ["valid-id.pdf", undefined, "application/pdf"],
  ])("derives %s MIME when Android omits it", (name, mimeType, expectedMime) => {
    expect(normalizeSupportingFile(selectedFile({ name, mimeType })).mimeType).toBe(
      expectedMime
    );
  });

  it("adds a safe extension when the provider returns an extensionless name", () => {
    expect(
      normalizeSupportingFile(selectedFile({ name: "Valid ID", mimeType: "image/png" }))
    ).toMatchObject({ name: "Valid ID.png", mimeType: "image/png" });
  });

  it("accepts Android content URIs as well as cached file URIs", () => {
    expect(
      normalizeSupportingFile(
        selectedFile({ uri: "content://com.android.providers.downloads.documents/42" })
      ).uri
    ).toMatch(/^content:\/\//);
  });

  it.each([
    ["id.exe", "application/octet-stream"],
    ["id.jpg", "application/pdf"],
    ["id", undefined],
  ])("rejects unsupported or contradictory metadata", (name, mimeType) => {
    expect(() => normalizeSupportingFile(selectedFile({ name, mimeType }))).toThrow(AppError);
  });

  it("rejects oversized and unreadable files before fetch", () => {
    expect(() =>
      normalizeSupportingFile(selectedFile({ size: 5 * 1024 * 1024 + 1 }))
    ).toThrow(/under 5 MB/);
    expect(() => normalizeSupportingFile(selectedFile({ uri: "https://example.test/id.jpg" }))).toThrow(
      /could not be uploaded/
    );
  });
});

describe("supporting multipart body", () => {
  it("uses the backend files field, authoritative category, and RN file object", () => {
    const formData = buildSupportingFileFormData(
      selectedFile({ name: "valid-id.png", mimeType: undefined }),
      "valid_id"
    );
    const parts = (formData as unknown as { _parts: [string, unknown][] })._parts;

    expect(parts).toEqual([
      [
        "files",
        {
          uri: "file:///data/user/0/com.testimonium.app/cache/DocumentPicker/id.jpg",
          name: "valid-id.png",
          type: "image/png",
        },
      ],
      ["category", "valid_id"],
    ]);
  });

  it("creates a distinct FormData instance for each body build", () => {
    expect(buildSupportingFileFormData(selectedFile(), "valid_id")).not.toBe(
      buildSupportingFileFormData(selectedFile(), "valid_id")
    );
  });
});

describe("supporting upload error UX", () => {
  it("does not misclassify a local FormData failure as backend connectivity", () => {
    expect(
      supportingUploadError(
        new AppError({
          kind: "VALIDATION",
          code: "UPLOAD_BODY_UNREADABLE",
          message: "The selected file could not be uploaded.",
        })
      )
    ).toMatchObject({ kind: "VALIDATION", code: "UPLOAD_BODY_UNREADABLE" });
  });

  it("uses draft-safe timeout and unknown messages", () => {
    expect(supportingUploadError(new AppError({ kind: "TIMEOUT", message: "old" })).message).toMatch(
      /draft is safe/
    );
    expect(supportingUploadError(new Error("unexpected")).message).toMatch(/saved as a draft/);
  });
});
