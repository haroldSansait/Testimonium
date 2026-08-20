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