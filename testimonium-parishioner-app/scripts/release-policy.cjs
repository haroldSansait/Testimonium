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
  if (env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED !== "true") {
    throw new Error("Release requires Google Sign-In to be enabled.");
  }
  const firebase = require("../google-services.json");
  const androidClient = firebase.client.find(client =>
    client.client_info.android_client_info?.package_name === "com.testimonium.app");
  const webClients = androidClient?.oauth_client?.filter(client => client.client_type === 3) ?? [];
  if (webClients.length !== 1 || !webClients[0].client_id ||
      env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID !== webClients[0].client_id) {
    throw new Error("Release requires the matching type-3 Web OAuth client ID from google-services.json for com.testimonium.app.");
  }
}

module.exports = { PRODUCTION_API_URL, assertReleaseEnvironment };

if (require.main === module) {
  assertReleaseEnvironment(process.env);
}
