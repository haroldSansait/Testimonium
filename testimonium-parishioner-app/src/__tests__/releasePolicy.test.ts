// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertReleaseEnvironment, PRODUCTION_API_URL } = require("../../scripts/release-policy.cjs");
const firebase = require("../../google-services.json");
const eas = require("../../eas.json");
const oauthClients = firebase.client.find((client: any) =>
  client.client_info.android_client_info?.package_name === "com.testimonium.app").oauth_client;
const webClientId = oauthClients.find((client: any) => client.client_type === 3).client_id;
const androidClientId = oauthClients.find((client: any) => client.client_type === 1).client_id;

const release = {
  EAS_BUILD_PROFILE: "release-apk",
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_ENV: "production",
  EXPO_PUBLIC_API_BASE_URL: PRODUCTION_API_URL,
  EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: "true",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: webClientId,
};

describe("release environment guard", () => {
  it("allows the production APK configuration", () => {
    expect(() => assertReleaseEnvironment(release)).not.toThrow();
  });
  it.each(["production", "release-apk"])("enables Google with the Web OAuth client in %s", profile => {
    const env = { ...eas.build.production.env, ...eas.build[profile].env, EAS_BUILD_PROFILE: profile };
    expect(env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED).toBe("true");
    expect(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).toBe(webClientId);
    expect(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).not.toBe(androidClientId);
    expect(() => assertReleaseEnvironment(env)).not.toThrow();
  });
  it.each([
    undefined, "", "http://testimonium-e9s5.onrender.com/api/v1",
    "http://localhost:5000/api/v1", "https://192.168.1.2/api/v1",
    "https://temporary.trycloudflare.com/api/v1",
    `${PRODUCTION_API_URL}/api/v1`, `${PRODUCTION_API_URL}?token=private`,
  ])("blocks an invalid production endpoint (%s)", value => {
    expect(() => assertReleaseEnvironment({ ...release, EXPO_PUBLIC_API_BASE_URL: value })).toThrow();
  });
  it.each([
    { EXPO_NO_DOTENV: undefined }, { EXPO_PUBLIC_ENV: "development" },
    { EXPO_NO_CLIENT_ENV_VARS: "1" },
    { EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: "false" },
    { EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: undefined },
  ])("blocks unsafe release flags %o", overrides => {
    expect(() => assertReleaseEnvironment({ ...release, ...overrides })).toThrow();
  });
  it.each([undefined, "", " ", "incorrect.apps.googleusercontent.com", androidClientId])(
    "rejects missing or mismatched Web OAuth client ID (%s)", clientId => {
      expect(() => assertReleaseEnvironment({ ...release, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: clientId }))
        .toThrow("type-3 Web OAuth client ID");
    }
  );
  it("preserves development tunnel configuration", () => {
    expect(() => assertReleaseEnvironment({
      EAS_BUILD_PROFILE: "development", EXPO_PUBLIC_ENV: "development",
      EXPO_PUBLIC_API_BASE_URL: "https://temporary.trycloudflare.com/api/v1",
    })).not.toThrow();
  });
});
