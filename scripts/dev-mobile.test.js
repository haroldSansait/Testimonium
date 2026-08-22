"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPublicHealthUrl,
  classifyHealthProbe,
  CLOUDFLARED_FALLBACK,
  createCommandInvocation,
  derivePublicApiUrl,
  parseQuickTunnelUrl,
  resolveCloudflared,
  sanitizeQuickTunnelUrl,
  updateEnvApiBaseUrl,
} = require("./dev-mobile");

test("parses a Cloudflare Quick Tunnel URL from cloudflared output", () => {
  assert.equal(
    parseQuickTunnelUrl("INF Your quick Tunnel has been created! Visit it at https://orange-river.trycloudflare.com"),
    "https://orange-river.trycloudflare.com",
  );
  assert.equal(parseQuickTunnelUrl("still connecting"), null);
});

test("derives the public API root only from a Quick Tunnel URL", () => {
  assert.equal(derivePublicApiUrl("https://orange-river.trycloudflare.com"), "https://orange-river.trycloudflare.com/api/v1");
  assert.throws(() => derivePublicApiUrl("http://localhost:5000"), /invalid Quick Tunnel URL/);
});

test("updates only EXPO_PUBLIC_API_BASE_URL while preserving other .env content", () => {
  const input = "# local development\r\nEXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED=true\r\nEXPO_PUBLIC_API_BASE_URL=https://old.example/api/v1\r\nEXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=keep-this-value\r\n";
  const actual = updateEnvApiBaseUrl(input, "https://new-tunnel.trycloudflare.com/api/v1");
  assert.equal(
    actual,
    "# local development\r\nEXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED=true\r\nEXPO_PUBLIC_API_BASE_URL=https://new-tunnel.trycloudflare.com/api/v1\r\nEXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=keep-this-value\r\n",
  );
});

test("appends the API variable without changing existing values when it is absent", () => {
  const actual = updateEnvApiBaseUrl("CUSTOM_VALUE=preserved", "https://new-tunnel.trycloudflare.com/api/v1");
  assert.equal(actual, "CUSTOM_VALUE=preserved\nEXPO_PUBLIC_API_BASE_URL=https://new-tunnel.trycloudflare.com/api/v1\n");
});

test("prefers PATH cloudflared before the supported local fallback", () => {
  assert.equal(
    resolveCloudflared({ findOnPath: () => "C:\\Program Files\\cloudflared.exe", exists: () => true }),
    "C:\\Program Files\\cloudflared.exe",
  );
  assert.equal(
    resolveCloudflared({ findOnPath: () => null, exists: (candidate) => candidate === CLOUDFLARED_FALLBACK }),
    CLOUDFLARED_FALLBACK,
  );
  assert.equal(resolveCloudflared({ findOnPath: () => null, exists: () => false }), null);
});


test("uses cmd.exe safely for Windows npm and npx .cmd commands", () => {
  const comSpec = "C:\\Windows\\System32\\cmd.exe";
  assert.deepEqual(
    createCommandInvocation("npm.cmd", ["run", "dev", "--prefix", "testimonium-backend"], "win32", comSpec),
    { command: comSpec, args: ["/d", "/s", "/c", "npm.cmd run dev --prefix testimonium-backend"] },
  );
  assert.deepEqual(
    createCommandInvocation("npx.cmd", ["expo", "start", "--dev-client", "--tunnel"], "win32", comSpec),
    { command: comSpec, args: ["/d", "/s", "/c", "npx.cmd expo start --dev-client --tunnel"] },
  );
});

test("keeps direct command invocation on non-Windows platforms", () => {
  assert.deepEqual(
    createCommandInvocation("npm", ["run", "dev"], "linux"),
    { command: "npm", args: ["run", "dev"] },
  );
});


test("sanitizes ANSI-decorated tunnel output and constructs the exact health URL", () => {
  const tunnelUrl = sanitizeQuickTunnelUrl("\u001B[32mhttps://orange-river.trycloudflare.com,\u001B[0m");
  assert.equal(tunnelUrl, "https://orange-river.trycloudflare.com");
  assert.equal(buildPublicHealthUrl(tunnelUrl), "https://orange-river.trycloudflare.com/api/v1/health");
});

test("classifies transient Cloudflare readiness states and validates the health contract", () => {
  assert.deepEqual(classifyHealthProbe({ url: "https://x.trycloudflare.com/api/v1/health", statusCode: 502, body: "Bad Gateway" }).retryable, true);
  assert.equal(classifyHealthProbe({ url: "https://x.trycloudflare.com/api/v1/health", statusCode: 530, body: "Error code: 1033" }).reason, "CLOUDFLARE_1033");
  assert.equal(classifyHealthProbe({ url: "https://x.trycloudflare.com/api/v1/health", errorName: "Error", errorCode: "ENOTFOUND", errorMessage: "not found" }).retryable, true);
  assert.equal(classifyHealthProbe({ url: "https://x.trycloudflare.com/api/v1/health", statusCode: 200, body: '{"status":"healthy","database":"connected"}' }).ready, true);
  assert.equal(classifyHealthProbe({ url: "https://x.trycloudflare.com/api/v1/health", statusCode: 200, body: "<html>wrong endpoint</html>" }).reason, "INVALID_200_HEALTH_BODY");
});
