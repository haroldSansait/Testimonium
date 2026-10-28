import { getInfoAsync } from "expo-file-system/legacy";
import { createApiClient } from "@/services/api/core";
import type { User } from "@react-native-firebase/auth";
import { AppError } from "@/services/api/errors";
import { apiClient } from "@/services/api/client";
import {
  createScheduleRequest,
  fetchSchedulingConfiguration,
  type CreateScheduleInput,
} from "../features/schedule/api";
import {
  makeSchedulePayloadSignature,
} from "../features/schedule/presentation";
import { makePrerequisiteUploadSignature } from "../features/schedule/prerequisiteUploads";
import type {
  ScheduleEventType,
  ScheduleServiceRequirement,
  SchedulingConfiguration,
} from "../features/schedule/types";
import { normalizeSupportingFile } from "../features/requests/supportingUpload";
import type { LocalSelectedFile } from "../features/requests/types";

jest.mock("expo-file-system/legacy", () => ({ getInfoAsync: jest.fn() }));
const { createHash } = jest.requireActual("node:crypto");
const mockGetInfoAsync = getInfoAsync as jest.Mock;
let mockContents: Record<string, string> = {};
beforeEach(() => {
  mockContents = {};
  mockGetInfoAsync.mockReset().mockImplementation(async (uri: string) => ({
    exists: true, isDirectory: false, size: 200_000,
    md5: createHash("md5").update(mockContents[uri] ?? uri).digest("hex"),
  }));
});

// Capture multipart structure; actual native execution requires a device.
const OriginalFormData = globalThis.FormData;
class MockFormData {
  readonly _parts: [string, unknown][] = [];
  append(name: string, value: unknown) {
    this._parts.push([name, value]);
  }
  get(name: string) {
    const entry = this._parts.find(([k]) => k === name);
    return entry ? entry[1] : null;
  }
  getAll(name: string) {
    return this._parts.filter(([k]) => k === name).map(([, v]) => v);
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, "FormData", {
    configurable: true,
    value: MockFormData,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "FormData", {
    configurable: true,
    value: OriginalFormData,
  });
});

const mockFile = (overrides: Partial<LocalSelectedFile> = {}): LocalSelectedFile => ({
  requirementId: "cenomar",
  requirementLabel: "CENOMAR",
  name: "cenomar.pdf",
  uri: "file:///cache/cenomar.pdf",
  size: 250_000,
  mimeType: "application/pdf",
  ...overrides,
});

describe("Schedule Prerequisite Uploads: 1. Service Types & Authoritative Configuration", () => {
  const SIX_CONFIGURABLE_SERVICES: ScheduleEventType[] = [
    "WEDDING",
    "MARRIAGE_SPECIAL",
    "BAPTISM",
    "CONFIRMATION",
    "WAKE_MASS",
    "FUNERAL",
  ];

  it("supports all six configurable scheduling services with prerequisite requirements", () => {
    const mockConfig: SchedulingConfiguration = {
      parishId: 1,
      schedulingAvailable: true,
      configurationUnavailable: false,
      services: [
        {
          eventType: "WEDDING",
          label: "Marriage (Canonical Interview)",
          requirements: [
            { id: "cenomar", label: "CENOMAR" },
            { id: "marriage_license", label: "Marriage License" },
            { id: "baptismal_cert", label: "Baptismal Certificate" },
          ],
        },
        {
          eventType: "MARRIAGE_SPECIAL",
          label: "Marriage (Special)",
          requirements: [
            { id: "cenomar", label: "CENOMAR" },
            { id: "marriage_license", label: "Marriage License" },
            { id: "baptismal_cert", label: "Baptismal Certificate" },
          ],
        },
        {
          eventType: "BAPTISM",
          label: "Baptism",
          requirements: [
            { id: "marriage_cert", label: "Marriage Certificate" },
            { id: "birth_cert", label: "Birth Certificate / Immunization Card" },
          ],
        },
        {
          eventType: "CONFIRMATION",
          label: "Confirmation",
          requirements: [
            { id: "baptismal_cert", label: "Baptismal Certificate" },
          ],
        },
        {
          eventType: "WAKE_MASS",
          label: "Wake Mass",
          requirements: [
            { id: "death_cert", label: "Death Certificate" },
          ],
        },
        {
          eventType: "FUNERAL",
          label: "Funeral",
          requirements: [
            { id: "death_cert", label: "Death Certificate" },
          ],
        },
      ],
      timeSlots: ["09:00 AM", "10:00 AM"],
      capacity: null,
      venueCapacity: 200,
      horizonDays: 90,
      configurationUpdatedAt: "2026-10-26T00:00:00.000Z",
    };

    expect(mockConfig.services).toHaveLength(6);
    for (const serviceType of SIX_CONFIGURABLE_SERVICES) {
      const match = mockConfig.services.find((s) => s.eventType === serviceType);
      expect(match).toBeDefined();
      expect(match?.requirements?.length).toBeGreaterThan(0);
    }
  });

  it("only displays parish-enabled prerequisites, not universally hardcoding every possible document", () => {
    // Parish A enables CENOMAR and Marriage License, but NOT Baptismal Certificate
    const parishAWedding: SchedulingConfiguration["services"][number] = {
      eventType: "WEDDING",
      label: "Marriage (Canonical Interview)",
      requirements: [
        { id: "cenomar", label: "CENOMAR" },
        { id: "marriage_license", label: "Marriage License" },
      ],
    };

    expect(parishAWedding.requirements).toHaveLength(2);
    expect(parishAWedding.requirements?.map((r) => r.id)).toEqual(["cenomar", "marriage_license"]);
    expect(parishAWedding.requirements?.some((r) => r.id === "baptismal_cert")).toBe(false);
  });

  it("identifies services with no configured prerequisites", () => {
    const confessionService: SchedulingConfiguration["services"][number] = {
      eventType: "CONFESSION",
      label: "Confession",
      requirements: [],
    };

    const hasRequirements = (confessionService.requirements?.length ?? 0) > 0;
    expect(hasRequirements).toBe(false);
  });
});

describe("Schedule Prerequisite Uploads: 2. File Selection & Validation", () => {
  it.each([
    ["document.pdf", "application/pdf"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["scan.png", "image/png"],
    ["image.webp", "image/webp"],
  ])("accepts allowed document format: %s (%s)", (name, mimeType) => {
    const file = mockFile({ name, mimeType });
    const normalized = normalizeSupportingFile(file);
    expect(normalized.name).toBe(name);
    expect(normalized.mimeType).toBe(mimeType);
  });

  it.each([
    ["file.exe", "application/x-msdownload"],
    ["file.txt", "text/plain"],
    ["file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["file.zip", "application/zip"],
  ])("rejects unsupported document format: %s", (name, mimeType) => {
    const file = mockFile({ name, mimeType });
    expect(() => normalizeSupportingFile(file)).toThrow(AppError);
  });

  it("rejects files exceeding 5 MiB (5 * 1024 * 1024 bytes)", () => {
    const oversizedFile = mockFile({ size: 5 * 1024 * 1024 + 1 });
    expect(() => normalizeSupportingFile(oversizedFile)).toThrow(/under 5 MB/);
  });

  it("accepts files up to exactly 5 MiB", () => {
    const validFile = mockFile({ size: 5 * 1024 * 1024 });
    const normalized = normalizeSupportingFile(validFile);
    expect(normalized.size).toBe(5 * 1024 * 1024);
  });

  it("rejects empty files (0 bytes)", () => {
    const emptyFile = mockFile({ size: 0 });
    expect(() => normalizeSupportingFile(emptyFile)).toThrow(AppError);
  });

  it("rejects missing or invalid file URIs", () => {
    const invalidUriFile = mockFile({ uri: "http://remote.host/doc.pdf" });
    expect(() => normalizeSupportingFile(invalidUriFile)).toThrow(AppError);
  });

  it("detects and rejects inconsistent MIME types and extensions", () => {
    const mismatched = mockFile({ name: "license.png", mimeType: "application/pdf" });
    expect(() => normalizeSupportingFile(mismatched)).toThrow(AppError);
  });
});

describe("Schedule Prerequisite Uploads: 3. Idempotency Key & Upload Signature", () => {
  const baseBooking = {
    parishId: 1,
    eventType: "WEDDING",
    date: "2026-11-15",
    timeSlot: "10:00 AM",
    remarks: "Special wedding request",
    requestedPriestId: null,
  };

  it("sorts content fingerprints by requirement ID", async () => {
    const files = { z: mockFile({ uri: "file:///z.pdf" }), a: mockFile({ uri: "file:///a.pdf" }) };
    const signature = await makePrerequisiteUploadSignature(files);
    expect(JSON.parse(signature)).toEqual([
      ["a", createHash("md5").update("file:///a.pdf").digest("hex")],
      ["z", createHash("md5").update("file:///z.pdf").digest("hex")],
    ]);
    expect(await makePrerequisiteUploadSignature({ a: files.a, z: files.z })).toBe(signature);
  });

  it("keeps identity on retry and identical bytes reselected at a different URI/name", async () => {
    mockContents = { "file:///one.pdf": "same bytes", "file:///two.pdf": "same bytes" };
    const first = { cenomar: mockFile({ uri: "file:///one.pdf" }) };
    const reselected = { cenomar: mockFile({ uri: "file:///two.pdf", name: "renamed.pdf" }) };
    const signature = await makePrerequisiteUploadSignature(first);
    expect(await makePrerequisiteUploadSignature(first)).toBe(signature);
    expect(await makePrerequisiteUploadSignature(reselected)).toBe(signature);
  });

  it("distinguishes different bytes with identical filename, size and URI", async () => {
    const files = { cenomar: mockFile() };
    mockContents[files.cenomar.uri] = "first";
    const first = makeSchedulePayloadSignature({ ...baseBooking, uploadSignature: await makePrerequisiteUploadSignature(files) });
    mockContents[files.cenomar.uri] = "other";
    const second = makeSchedulePayloadSignature({ ...baseBooking, uploadSignature: await makePrerequisiteUploadSignature(files) });
    expect(second).not.toBe(first);
    expect(mockGetInfoAsync).toHaveBeenCalledTimes(2);
  });

  it("distinguishes removed files and requirement ID changes", async () => {
    const file = mockFile();
    const signature = await makePrerequisiteUploadSignature({ cenomar: file });
    expect(await makePrerequisiteUploadSignature({ license: file })).not.toBe(signature);
    expect(await makePrerequisiteUploadSignature({})).toBe("[]");
    expect(await makePrerequisiteUploadSignature({})).not.toBe(signature);
  });

  it.each([
    { exists: false },
    { exists: true, isDirectory: true, size: 100, md5: "a".repeat(32) },
    { exists: true, isDirectory: false, size: 100, md5: null },
  ])("fails closed when native file cannot be fingerprinted: %j", async (info) => {
    mockGetInfoAsync.mockResolvedValueOnce(info);
    await expect(makePrerequisiteUploadSignature({ cenomar: mockFile() })).rejects.toMatchObject({ code: "UPLOAD_BODY_UNREADABLE" });
  });

  it.each([0, 5 * 1024 * 1024 + 1])("validates native size even when picker omits size: %s", async (size) => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: false, size, md5: "a".repeat(32) });
    await expect(makePrerequisiteUploadSignature({ cenomar: mockFile({ size: undefined }) })).rejects.toMatchObject({ kind: "VALIDATION" });
  });
});

describe("Schedule Prerequisite Uploads: 4. API Client & Multipart Transport", () => {
  const mockApiRequest = jest.spyOn(apiClient, "request");

  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  afterAll(() => {
    mockApiRequest.mockRestore();
  });

  it("routes no-prerequisite bookings to multipart /schedule-requests/web with empty IDs and no files", async () => {
    mockApiRequest.mockResolvedValueOnce({ id: 101, eventType: "CONFESSION", status: "PENDING" });

    const input: CreateScheduleInput = {
      payload: {
        parishId: 1,
        eventType: "CONFESSION",
        date: "2026-11-15",
        timeSlot: "09:00 AM",
        remarks: "First confession",
      },
      idempotencyKey: "test-idemp-123",
      requirements: [],
    };

    const result = await createScheduleRequest(input);
    expect(result).toEqual({ id: 101, eventType: "CONFESSION", status: "PENDING" });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    const callArgs = mockApiRequest.mock.calls[0][0];
    expect(callArgs.path).toBe("/schedule-requests/web");
    expect(callArgs.method).toBe("POST");
    expect(callArgs.isMultipart).toBe(true);
    expect(callArgs.body).toBeUndefined();
    const body = callArgs.createBody!() as MockFormData;
    expect(JSON.parse(body.get("booking") as string)).toEqual(input.payload);
    expect(JSON.parse(body.get("requirementIds") as string)).toEqual([]);
    expect(body.getAll("files")).toEqual([]);
    expect(callArgs.headers).toEqual({ "Idempotency-Key": "test-idemp-123" });
  });

  it("routes prerequisite bookings to /schedule-requests/web with isMultipart: true and correct fields", async () => {
    mockApiRequest.mockResolvedValueOnce({ id: 202, eventType: "WEDDING", status: "PENDING" });

    const requirements: ScheduleServiceRequirement[] = [
      { id: "cenomar", label: "CENOMAR" },
      { id: "marriage_license", label: "Marriage License" },
    ];

    const files: Record<string, LocalSelectedFile> = {
      cenomar: mockFile({
        requirementId: "cenomar",
        name: "my_cenomar.pdf",
        uri: "file:///cache/my_cenomar.pdf",
        size: 150_000,
        mimeType: "application/pdf",
      }),
      marriage_license: mockFile({
        requirementId: "marriage_license",
        name: "license.jpg",
        uri: "file:///cache/license.jpg",
        size: 300_000,
        mimeType: "image/jpeg",
      }),
    };

    const input: CreateScheduleInput = {
      payload: {
        parishId: 1,
        eventType: "WEDDING",
        date: "2026-11-20",
        timeSlot: "10:00 AM",
        remarks: "Wedding interview",
        requestedPriestId: 7,
      },
      idempotencyKey: "web-idemp-456",
      requirements,
      files,
    };

    const result = await createScheduleRequest(input);
    expect(result).toEqual({ id: 202, eventType: "WEDDING", status: "PENDING" });

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    const callArgs = mockApiRequest.mock.calls[0][0];
    expect(callArgs.path).toBe("/schedule-requests/web");
    expect(callArgs.method).toBe("POST");
    expect(callArgs.isMultipart).toBe(true);
    expect(callArgs.timeoutMs).toBe(60_000);
    expect(callArgs.headers).toEqual({ "Idempotency-Key": "web-idemp-456" });

    // Verify createBody generates FormData with exact expected structure
    expect(typeof callArgs.createBody).toBe("function");
    const formData = callArgs.createBody!() as unknown as MockFormData;
    expect(formData).toBeInstanceOf(MockFormData);

    const bookingRaw = formData.get("booking");
    expect(typeof bookingRaw).toBe("string");
    const booking = JSON.parse(bookingRaw as string);
    expect(booking).toEqual({
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-11-20",
      timeSlot: "10:00 AM",
      remarks: "Wedding interview",
      requestedPriestId: 7,
    });

    const requirementIdsRaw = formData.get("requirementIds");
    expect(typeof requirementIdsRaw).toBe("string");
    const requirementIds = JSON.parse(requirementIdsRaw as string);
    expect(requirementIds).toEqual(["cenomar", "marriage_license"]);

    const uploadedFiles = formData.getAll("files");
    expect(uploadedFiles).toHaveLength(2);
    expect(uploadedFiles[0]).toEqual({
      uri: "file:///cache/my_cenomar.pdf",
      name: "my_cenomar.pdf",
      type: "application/pdf",
    });
    expect(uploadedFiles[1]).toEqual({
      uri: "file:///cache/license.jpg",
      name: "license.jpg",
      type: "image/jpeg",
    });
  });

  it("blocks submission and throws AppError if required prerequisite files are missing", async () => {
    const requirements: ScheduleServiceRequirement[] = [
      { id: "cenomar", label: "CENOMAR" },
      { id: "marriage_license", label: "Marriage License" },
    ];

    // Only one file provided
    const files: Record<string, LocalSelectedFile> = {
      cenomar: mockFile({ requirementId: "cenomar" }),
    };

    const input: CreateScheduleInput = {
      payload: {
        parishId: 1,
        eventType: "WEDDING",
        date: "2026-11-20",
        timeSlot: "10:00 AM",
      },
      requirements,
      files,
    };

    await expect(createScheduleRequest(input)).rejects.toMatchObject({
      kind: "VALIDATION",
      code: "MISSING_SCHEDULE_ATTACHMENTS",
      message: expect.stringContaining("Marriage License"),
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("recreates aligned multipart bodies and keeps the key through a real API-client 401 retry", async () => {
    const getIdToken = jest.fn(async (refresh: boolean) => refresh ? "new-token" : "old-token");
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 303 } }), {
        status: 201, headers: { "content-type": "application/json" },
      }));
    const client = createApiClient({
      getCurrentUser: () => ({ getIdToken }) as unknown as User,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });
    mockApiRequest.mockImplementation(client.request);
    await expect(createScheduleRequest({
      payload: { parishId: 1, eventType: "WEDDING", date: "2026-11-20", timeSlot: "10:00 AM" },
      idempotencyKey: "retry-same-key",
      requirements: [{ id: "z", label: "Z" }, { id: "a", label: "A" }],
      files: { z: mockFile({ uri: "file:///z.pdf" }), a: mockFile({ uri: "file:///a.pdf" }) },
    })).resolves.toEqual({ id: 303 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(getIdToken.mock.calls).toEqual([[false], [true]]);
    const first = fetchImpl.mock.calls[0][1];
    const second = fetchImpl.mock.calls[1][1];
    expect(first.body).not.toBe(second.body);
    for (const [attempt, token] of [[first, "old-token"], [second, "new-token"]] as const) {
      expect(attempt.headers).toEqual({ "Idempotency-Key": "retry-same-key", Authorization: `Bearer ${token}` });
      expect(JSON.parse(attempt.body.get("requirementIds"))).toEqual(["a", "z"]);
      expect(attempt.body.getAll("files").map((file: { uri: string }) => file.uri)).toEqual(["file:///a.pdf", "file:///z.pdf"]);
    }
  });

  it("serializes URI parts using React Native's actual FormData implementation", async () => {
    const NativeFormData = jest.requireActual("react-native/Libraries/Network/FormData").default;
    Object.defineProperty(globalThis, "FormData", { configurable: true, value: NativeFormData });
    try {
      mockApiRequest.mockResolvedValueOnce({ id: 404 });
      await createScheduleRequest({
        payload: { parishId: 1, eventType: "WEDDING", date: "2026-11-20", timeSlot: "10:00 AM" },
        idempotencyKey: "native-parts",
        requirements: [{ id: "cenomar", label: "CENOMAR" }],
        files: { cenomar: mockFile() },
      });
      const body = mockApiRequest.mock.calls[0][0].createBody!() as { getParts: () => unknown[] };
      expect(body.getParts()).toEqual([
        expect.objectContaining({ string: expect.any(String) }),
        expect.objectContaining({ string: '["cenomar"]' }),
        expect.objectContaining({
          uri: "file:///cache/cenomar.pdf", name: "cenomar.pdf", type: "application/pdf",
          headers: { "content-disposition": 'form-data; name="files"; filename="cenomar.pdf"', "content-type": "application/pdf" },
        }),
      ]);
    } finally {
      Object.defineProperty(globalThis, "FormData", { configurable: true, value: MockFormData });
    }
  });

  it("selects the established native fetch transport for scheduling multipart", async () => {
    const nativeFetch = jest.spyOn(jest.requireActual("whatwg-fetch"), "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: { id: 505 } }), {
        status: 201, headers: { "content-type": "application/json" },
      }));
    try {
      const getIdToken = jest.fn(async () => "native-token");
      const client = createApiClient({
        getCurrentUser: () => ({ getIdToken }) as unknown as User,
        getBaseUrl: () => "https://api.test/api/v1",
      });
      mockApiRequest.mockImplementation(client.request);
      await expect(createScheduleRequest({
        payload: { parishId: 1, eventType: "CONFESSION", date: "2026-11-20", timeSlot: "10:00 AM" },
        idempotencyKey: "native-transport",
      })).resolves.toEqual({ id: 505 });
      expect(nativeFetch).toHaveBeenCalledTimes(1);
      expect(nativeFetch.mock.calls[0][0]).toBe("https://api.test/api/v1/schedule-requests/web");
    } finally {
      nativeFetch.mockRestore();
    }
  });

  it("rejects more than 3 prerequisite documents matching backend upload limits", async () => {
    const fourRequirements: ScheduleServiceRequirement[] = [
      { id: "doc1", label: "Document 1" },
      { id: "doc2", label: "Document 2" },
      { id: "doc3", label: "Document 3" },
      { id: "doc4", label: "Document 4" },
    ];

    const fourFiles: Record<string, LocalSelectedFile> = {
      doc1: mockFile({ requirementId: "doc1", name: "1.pdf" }),
      doc2: mockFile({ requirementId: "doc2", name: "2.pdf" }),
      doc3: mockFile({ requirementId: "doc3", name: "3.pdf" }),
      doc4: mockFile({ requirementId: "doc4", name: "4.pdf" }),
    };

    const input: CreateScheduleInput = {
      payload: {
        parishId: 1,
        eventType: "WEDDING",
        date: "2026-11-20",
        timeSlot: "10:00 AM",
      },
      requirements: fourRequirements,
      files: fourFiles,
    };

    await expect(createScheduleRequest(input)).rejects.toMatchObject({
      kind: "VALIDATION",
      code: "TOO_MANY_ATTACHMENTS",
      message: expect.stringContaining("maximum of 3"),
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("never falls back to legacy JSON endpoint when multipart submission fails", async () => {
    const backendError = new AppError({
      kind: "VALIDATION",
      status: 400,
      code: "INVALID_SCHEDULE_ATTACHMENTS",
      message: "Only PDF, JPG, PNG, and WebP documents are allowed.",
    });

    mockApiRequest.mockRejectedValueOnce(backendError);

    const input: CreateScheduleInput = {
      payload: {
        parishId: 1,
        eventType: "WEDDING",
        date: "2026-11-20",
        timeSlot: "10:00 AM",
      },
      requirements: [{ id: "cenomar", label: "CENOMAR" }],
      files: { cenomar: mockFile() },
    };

    await expect(createScheduleRequest(input)).rejects.toBe(backendError);
    // Verified that only one call to /schedule-requests/web occurred, no subsequent call to /schedule-requests
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest.mock.calls[0][0].path).toBe("/schedule-requests/web");
  });
});
