const PRODUCTION_API_URL = "https://testimonium-e9s5.onrender.com/api/v1";

function assertReleaseEnvironment(env) {
  const releaseProfile = ["release-apk", "production"].includes(env.EAS_BUILD_PROFILE);
  if (!releaseProfile && env.EXPO_PUBLIC_ENV !== "production") return;

  // Do not include supplied values in errors; they may be private configuration.
  if (env.EXPO_PUBLIC_ENV !== "production" || env.EXPO_NO_DOTENV !== "1") {
    throw new Error("Release requires EXPO_PUBLIC_ENV=production and EXPO_NO_DOTENV=1. Use the mobile EAS release-apk profile.");
  }
  if (env.EXPO_PUBLIC_API_BASE_URL !== PRODUCTION_API_URL) {
    throw new Error("Release requires the exact approved HTTPS production API URL, including /api/v1.");
  }
  if (env.EXPO_NO_CLIENT_ENV_VARS && env.EXPO_NO_CLIENT_ENV_VARS !== "0") {
    throw new Error("Release requires Expo public environment variable inlining to remain enabled.");
  }
  // v1.0.0: release signing/OAuth pairing has not been verified by the owner.
  if (env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED !== "false" || env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google Sign-In must remain disabled for this release until release signing/OAuth pairing is verified.");
  }
}

module.exports = { PRODUCTION_API_URL, assertReleaseEnvironment };

if (require.main === module) {
  assertReleaseEnvironment(process.env);
}
