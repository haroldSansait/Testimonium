import { getApiBaseUrl, getGoogleWebClientId, isGoogleSignInEnabled } from "@/config/environment";

const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const originalEnvironment = process.env.EXPO_PUBLIC_ENV;
const originalGoogleEnv = {
  EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalGoogleEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_ENV;
  else process.env.EXPO_PUBLIC_ENV = originalEnvironment;
  if (originalApiBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  }
});

describe("mobile API environment", () => {
  it("exposes enabled Google authentication using the production profile Web client ID", () => {
    const { env } = require("../../eas.json").build.production;
    process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED = env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    expect(isGoogleSignInEnabled()).toBe(true);
    expect(getGoogleWebClientId()).toBe(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  });
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
