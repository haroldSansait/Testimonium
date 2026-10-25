// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertReleaseEnvironment, PRODUCTION_API_URL } = require("../../scripts/release-policy.cjs");

const release = {
  EAS_BUILD_PROFILE: "release-apk",
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_ENV: "production",
  EXPO_PUBLIC_API_BASE_URL: PRODUCTION_API_URL,
  EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: "false",
};

describe("release environment guard", () => {
  it("allows the production APK configuration", () => {
    expect(() => assertReleaseEnvironment(release)).not.toThrow();
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
    { EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED: "true" },
    { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "unverified-client" },
  ])("blocks unsafe release flags %o", overrides => {
    expect(() => assertReleaseEnvironment({ ...release, ...overrides })).toThrow();
  });
  it("preserves development tunnel configuration", () => {
    expect(() => assertReleaseEnvironment({
      EAS_BUILD_PROFILE: "development", EXPO_PUBLIC_ENV: "development",
      EXPO_PUBLIC_API_BASE_URL: "https://temporary.trycloudflare.com/api/v1",
    })).not.toThrow();
  });
});
