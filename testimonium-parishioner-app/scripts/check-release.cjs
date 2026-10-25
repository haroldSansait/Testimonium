/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { assertReleaseEnvironment, PRODUCTION_API_URL } = require("./release-policy.cjs");

const root = path.resolve(__dirname, "..");
process.chdir(root);
const eas = JSON.parse(fs.readFileSync("eas.json", "utf8"));
function resolveProfile(name, visited = []) {
  assert(!visited.includes(name), "Cyclic EAS profile inheritance");
  const own = eas.build[name];
  assert(own, `Missing EAS profile: ${name}`);
  const base = own.extends ? resolveProfile(own.extends, [...visited, name]) : {};
  return { ...base, ...own, env: { ...base.env, ...own.env }, android: { ...base.android, ...own.android } };
}
const profile = resolveProfile("release-apk");
assert.equal(eas.cli.appVersionSource, "remote");
assert.equal(profile.environment, "production");
assert.equal(profile.developmentClient, false);
assert.equal(profile.distribution, "internal");
assert.equal(profile.credentialsSource, "remote");
assert.equal(profile.autoIncrement, true);
assert.equal(profile.android.buildType, "apk");
assert(!profile.android.gradleCommand, "Custom Gradle command can override APK build type");
assert(!profile.android.withoutCredentials, "Release must use signing credentials");
const env = { ...process.env, ...profile.env, EAS_BUILD_PROFILE: "release-apk" };
assertReleaseEnvironment(env);

const cli = require.resolve("expo/bin/cli");
const configResult = spawnSync(process.execPath, [cli, "config", "--type", "public", "--json"], { cwd: root, env, encoding: "utf8" });
if (configResult.status !== 0) {
  throw new Error(`Expo config failed: ${configResult.error?.message ?? configResult.stderr}`);
}
const config = JSON.parse(configResult.stdout);
assert.equal(config.name, "TESTIMONIUM");
assert.equal(config.version, "1.0.0");
assert.equal(config.android.package, "com.testimonium.app");
assert.equal(config.slug, "testimonium");
assert.equal(config.scheme, "testimonium");
assert.equal(config.owner, "agos-testimonium");
assert.equal(config.extra.eas.projectId, "c5ceefeb-6a8a-46b4-a53f-af529ac894b1");
assert(Number.isInteger(config.android.versionCode) && config.android.versionCode > 0);
assert.equal(JSON.parse(fs.readFileSync("package.json", "utf8")).version, config.version);
const firebase = JSON.parse(fs.readFileSync(config.android.googleServicesFile, "utf8"));
assert.equal(firebase.project_info.project_id, "testimonium-b46b0");
const firebaseAndroidClient = firebase.client.find(client => client.client_info.android_client_info?.package_name === config.android.package);
assert(firebaseAndroidClient, "Firebase Android package registration is missing");
const webClients = firebaseAndroidClient.oauth_client.filter(client => client.client_type === 3);
assert.equal(webClients.length, 1, "Expected one Firebase Web OAuth client for the Android app");
assert.equal(env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED, "true");
assert.equal(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, webClients[0].client_id, "Release must use the Firebase type-3 Web OAuth client ID");
const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
assert(splash, "Missing splash config");
for (const asset of [config.icon, config.android.adaptiveIcon.foregroundImage, splash[1].image]) {
  const data = fs.readFileSync(asset);
  assert.equal(data.subarray(1, 4).toString(), "PNG");
  assert.equal(data.readUInt32BE(16), data.readUInt32BE(20), "Branding must use square PNGs");
}
console.log(`Release config OK: ${config.version}; com.testimonium.app; standalone signed APK profile; remote auto-increment.`);
console.log(`Effective release API: ${PRODUCTION_API_URL}; dotenv disabled; Google Sign-In enabled with matching Firebase Web OAuth client ID.`);
console.log("Signed-device authentication behavior is not verified by this configuration check.");

if (process.argv.includes("--export")) {
  // Public environment changes must not reuse transforms from a disabled-Google export.
  const result = spawnSync(process.execPath, [cli, "export", "--platform", "android", "--no-bytecode", "--clear"], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (result.status === 0) {
    const bundleDir = path.join(root, "dist/_expo/static/js/android");
    const bundle = fs.readdirSync(bundleDir).filter(file => file.endsWith(".js"))
      .map(file => fs.readFileSync(path.join(bundleDir, file), "utf8")).join("\n");
    assert(bundle.includes(PRODUCTION_API_URL), "Production API missing from exported Android bundle");
    assert(!bundle.includes("process.env.EXPO_PUBLIC_API_BASE_URL"), "API environment value was not inlined");
    assert(!bundle.includes(".trycloudflare.com"), "Development tunnel found in release bundle");
    assert(bundle.includes(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID), "Google Web OAuth client ID missing from exported Android bundle");
    assert(!bundle.includes("process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"), "Google Web client ID was not inlined");
    assert(!bundle.includes("process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED"), "Google Sign-In feature flag was not inlined");
    console.log("Export verified: production API and enabled Google Sign-In configuration inlined; no development tunnel in Android JS.");
  }
}
