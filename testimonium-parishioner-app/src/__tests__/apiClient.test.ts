import type { User } from "@react-native-firebase/auth";
import { __resetTokenRefreshForTests, createApiClient } from "@/services/api/core";
import { AppError } from "@/services/api/errors";

const getIdToken = jest.fn(async (forceRefresh: boolean) => forceRefresh ? "fresh-token" : "cached-token");
const user = { getIdToken } as unknown as User;
beforeEach(() => { __resetTokenRefreshForTests(); jest.clearAllMocks(); });

describe("API 401 handling", () => {
  it("refreshes once and retries exactly once", async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = createApiClient({ getCurrentUser: () => user, getBaseUrl: () => "https://api.test/api/v1", fetchImpl });
    await expect(client.request({ path: "/auth/profile" })).resolves.toEqual({ ok: true });
    expect(getIdToken).toHaveBeenCalledTimes(2); expect(getIdToken).toHaveBeenLastCalledWith(true); expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("shares concurrent forced refreshes and never loops a failed retry", async () => {
    const expired = jest.fn(); const fetchImpl = jest.fn().mockResolvedValue(new Response("", { status: 401 }));
    const client = createApiClient({ getCurrentUser: () => user, getBaseUrl: () => "https://api.test/api/v1", fetchImpl, onSessionExpired: expired });
    const results = await Promise.allSettled([client.request({ path: "/one" }), client.request({ path: "/two" })]);
    expect(results.every((result) => result.status === "rejected" && (result.reason as AppError).kind === "AUTH")).toBe(true);
    expect(getIdToken.mock.calls.filter(([force]: [boolean]) => force).length).toBe(1); expect(fetchImpl).toHaveBeenCalledTimes(4); expect(expired).toHaveBeenCalledTimes(2);
  });
});

describe("API connection error classification", () => {
  it("does not relabel API configuration failures as device network failures", async () => {
    const configurationError = new AppError({
      kind: "CONFIGURATION",
      code: "MISSING_API_BASE_URL",
      message: "Missing API URL",
    });
    const fetchImpl = jest.fn();
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => {
        throw configurationError;
      },
      fetchImpl,
    });

    await expect(client.request({ method: "POST", path: "/auth/login" })).rejects.toBe(
      configurationError
    );
    expect(getIdToken).toHaveBeenCalledWith(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports an unreachable backend without claiming that the device is offline", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });

    await expect(client.request({ method: "POST", path: "/auth/login" })).rejects.toMatchObject({
      kind: "NETWORK",
      code: "API_CONNECTION_FAILED",
      message: "Unable to connect to TESTIMONIUM.",
    });
  });

  it("classifies local multipart serialization failures as invalid uploads", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("Unsupported FormDataPart implementation"));
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });

    await expect(
      client.request({ method: "POST", path: "/requests/31/files", body: new FormData(), isMultipart: true })
    ).rejects.toMatchObject({
      kind: "VALIDATION",
      code: "UPLOAD_BODY_UNREADABLE",
    });
  });
});

describe("API multipart handling", () => {
  it("preserves FormData, Authorization, and leaves Content-Type to native fetch", async () => {
    const formData = new FormData();
    formData.append("category", "valid_id");
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });

    await client.request({
      method: "POST",
      path: "/requests/31/files",
      body: formData,
      isMultipart: true,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.body).toBe(formData);
    expect(headers.Authorization).toBe("Bearer cached-token");
    expect(headers.Accept).toBe("application/json");
    expect(Object.keys(headers).some((name) => name.toLowerCase() === "content-type")).toBe(false);
  });

  it("creates fresh FormData for the single 401 retry", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      );
    const createBody = jest.fn(() => new FormData());
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });

    await client.request({
      method: "POST",
      path: "/requests/31/files",
      createBody,
      isMultipart: true,
    });

    expect(createBody).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]?.body).not.toBe(fetchImpl.mock.calls[1][1]?.body);
  });

  it("cleans up its timeout after a failed request", async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn().mockRejectedValue(new Error("unexpected transport"));
      const client = createApiClient({
        getCurrentUser: () => user,
        getBaseUrl: () => "https://api.test/api/v1",
        fetchImpl,
      });
      await expect(client.request({ path: "/requests/31", timeout: 45_000 })).rejects.toMatchObject({
        kind: "UNKNOWN",
        code: "REQUEST_TRANSPORT_FAILED",
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it("cleans up its timeout after a completed request", async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const client = createApiClient({
        getCurrentUser: () => user,
        getBaseUrl: () => "https://api.test/api/v1",
        fetchImpl,
      });
      await client.request({ path: "/requests/31", timeout: 45_000 });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
describe("API response envelopes", () => {
  it("preserves paginated list data and metadata", async () => {
    const payload = {
      success: true,
      data: [{ id: 31, trackingNumber: "SR-2026-000031" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createApiClient({
      getCurrentUser: () => user,
      getBaseUrl: () => "https://api.test/api/v1",
      fetchImpl,
    });

    await expect(client.request({ path: "/requests" })).resolves.toEqual(payload);
  });
});
