import { getApiBaseUrl } from "@/config/environment";

const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const originalEnvironment = process.env.EXPO_PUBLIC_ENV;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_ENV;
  else process.env.EXPO_PUBLIC_ENV = originalEnvironment;
  if (originalApiBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  }
});

describe("mobile API environment", () => {
  it("fails explicitly when the API base URL is missing", () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => getApiBaseUrl()).toThrow(
      expect.objectContaining({
        kind: "CONFIGURATION",
        code: "MISSING_API_BASE_URL",
      })
    );
  });

  it.each(["http://localhost:5000", "http://127.0.0.1:5000", "http://[::1]:5000"])(
    "rejects physical-device loopback URL %s",
    (baseUrl) => {
      process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;

      expect(() => getApiBaseUrl()).toThrow(
        expect.objectContaining({
          kind: "CONFIGURATION",
          code: "LOOPBACK_API_BASE_URL",
        })
      );
    }
  );

  it("normalizes a phone-reachable HTTPS origin to the v1 API root", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://dev-api.example.test/";

    expect(getApiBaseUrl()).toBe("https://dev-api.example.test/api/v1");
  });

  it("keeps the production /api/v1 prefix exactly once", () => {
    process.env.EXPO_PUBLIC_ENV = "production";
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://testimonium-e9s5.onrender.com/api/v1";
    expect(getApiBaseUrl()).toBe("https://testimonium-e9s5.onrender.com/api/v1");
  });

  it("rejects a development tunnel in a production bundle", () => {
    process.env.EXPO_PUBLIC_ENV = "production";
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://temporary.trycloudflare.com/api/v1";
    expect(() => getApiBaseUrl()).toThrow(expect.objectContaining({
      code: "INVALID_PRODUCTION_API_BASE_URL",
    }));
  });
});
