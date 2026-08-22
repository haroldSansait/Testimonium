"use strict";

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const MOBILE_DIR = path.join(ROOT_DIR, "testimonium-parishioner-app");
const HEALTH_URL = "http://127.0.0.1:5000/api/v1/health";
const CLOUDFLARED_FALLBACK = "C:\\tmp\\testimonium-cloudflared\\cloudflared.exe";
const STARTUP_TIMEOUT_MS = 120_000;
const RETRY_INTERVAL_MS = 1_000;

class LauncherError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.code = code;
  }
}

const log = (message) => console.log(`[dev:mobile] ${message}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const npmCommand = () => (process.platform === "win32" ? "npm.cmd" : "npm");
const npxCommand = () => (process.platform === "win32" ? "npx.cmd" : "npx");

function redactSensitiveText(value) {
  return String(value)
    .replace(/(authorization\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]")
    .replace(/((?:access[_-]?token|refresh[_-]?token|api[_-]?key|password)\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]");
}

function prefixOutput(name, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line) console.log(`[${name}] ${redactSensitiveText(line)}`);
  }
}

function sanitizeQuickTunnelUrl(value) {
  const withoutAnsi = String(value).replace(/\u001B\[[0-?]*[ -\/]*[@-~]/g, "");
  const match = withoutAnsi.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === "https:" && /^[a-z0-9-]+\.trycloudflare\.com$/i.test(url.hostname)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function parseQuickTunnelUrl(output) {
  return sanitizeQuickTunnelUrl(output);
}

function derivePublicApiUrl(tunnelUrl) {
  const url = new URL(tunnelUrl);
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(url.hostname)) {
    throw new LauncherError("TUNNEL_URL_INVALID", "Cloudflare returned an invalid Quick Tunnel URL.");
  }
  return `${url.origin}/api/v1`;
}

function buildPublicHealthUrl(tunnelUrl) {
  return `${derivePublicApiUrl(tunnelUrl)}/health`;
}

function updateEnvApiBaseUrl(envText, apiBaseUrl) {
  const newline = envText.includes("\r\n") ? "\r\n" : "\n";
  const linePattern = /(^[\t ]*EXPO_PUBLIC_API_BASE_URL[\t ]*=[^\r\n]*)(\r?\n|$)/m;
  const replacement = `EXPO_PUBLIC_API_BASE_URL=${apiBaseUrl}`;
  if (linePattern.test(envText)) {
    return envText.replace(linePattern, (_line, _existing, ending) => `${replacement}${ending}`);
  }
  const separator = envText.length === 0 || envText.endsWith("\n") ? "" : newline;
  return `${envText}${separator}${replacement}${newline}`;
}

function findCloudflaredOnPath() {
  const lookup = process.platform === "win32"
    ? spawnSync("where.exe", ["cloudflared"], { encoding: "utf8", windowsHide: true })
    : spawnSync("which", ["cloudflared"], { encoding: "utf8" });
  if (lookup.status !== 0) return null;
  return lookup.stdout.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean) || null;
}

function resolveCloudflared({ findOnPath, exists = fs.existsSync, fallback = CLOUDFLARED_FALLBACK } = {}) {
  const fromPath = findOnPath ? findOnPath() : findCloudflaredOnPath();
  if (fromPath) return fromPath;
  return exists(fallback) ? fallback : null;
}

function safeBodyExcerpt(body) {
  const normalized = redactSensitiveText(String(body).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim());
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function requestText(url, timeoutMs = 5_000, { connectHost, servername, hostHeader } = {}) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ url, errorName: error.name, errorMessage: error.message });
      return;
    }
    const transport = parsed.protocol === "https:" ? https : parsed.protocol === "http:" ? http : null;
    if (!transport) {
      resolve({ url, errorName: "UnsupportedProtocol", errorMessage: `Unsupported protocol: ${parsed.protocol}` });
      return;
    }
    const headers = { Accept: "application/json" };
    if (hostHeader) headers.Host = hostHeader;
    const request = transport.get({
      protocol: parsed.protocol,
      hostname: connectHost || parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      headers,
      servername: servername || undefined,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { if (body.length < 4_096) body += chunk; });
      response.on("end", () => resolve({ url, statusCode: response.statusCode || 0, body, connectedAddress: connectHost }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), { code: "ETIMEDOUT" })));
    request.on("error", (error) => resolve({ url, errorName: error.name, errorMessage: error.message, errorCode: error.code, connectedAddress: connectHost }));
  });
}

function resolveWithCloudflareDns(hostname) {
  return new Promise((resolve) => {
    const pathName = `/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
    const request = https.get({
      hostname: "1.1.1.1",
      servername: "cloudflare-dns.com",
      path: pathName,
      headers: { Host: "cloudflare-dns.com", Accept: "application/dns-json" },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { if (body.length < 4_096) body += chunk; });
      response.on("end", () => {
        try {
          const payload = JSON.parse(body);
          const address = payload.Answer?.find((answer) => answer.type === 1 && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(answer.data))?.data;
          if (address) resolve({ address });
          else resolve({ errorName: "DnsResponse", errorCode: payload.Status === 3 ? "DNS_NXDOMAIN" : "DNS_NO_A_RECORD", errorMessage: `Cloudflare DNS status ${payload.Status ?? "unknown"}` });
        } catch (error) {
          resolve({ errorName: error.name, errorCode: "DNS_RESPONSE_INVALID", errorMessage: error.message });
        }
      });
    });
    request.setTimeout(5_000, () => request.destroy(Object.assign(new Error("Cloudflare DNS lookup timed out"), { code: "ETIMEDOUT" })));
    request.on("error", (error) => resolve({ errorName: error.name, errorCode: error.code, errorMessage: error.message }));
  });
}

async function requestPublicHealth(url) {
  const initial = await requestText(url);
  if (initial.errorCode !== "ENOTFOUND") return initial;
  const hostname = new URL(url).hostname;
  const dnsFallback = await resolveWithCloudflareDns(hostname);
  if (!dnsFallback.address) return { ...initial, dnsFallback };
  return { ...await requestText(url, 5_000, { connectHost: dnsFallback.address, servername: hostname, hostHeader: hostname }), dnsFallback };
}

function classifyHealthProbe(probe) {
  if (probe.errorName) {
    return { ready: false, retryable: probe.errorName !== "TypeError" || probe.errorCode !== "ERR_INVALID_URL", reason: `NETWORK_${probe.errorCode || probe.errorName}` };
  }
  const excerpt = safeBodyExcerpt(probe.body);
  if (probe.statusCode === 200) {
    try {
      const body = JSON.parse(probe.body);
      if (body?.status === "healthy") return { ready: true, retryable: false, reason: "TESTIMONIUM_HEALTHY" };
      return { ready: false, retryable: false, reason: "UNEXPECTED_200_HEALTH_BODY", excerpt };
    } catch {
      return { ready: false, retryable: false, reason: "INVALID_200_HEALTH_BODY", excerpt };
    }
  }
  const cloudflareCode = excerpt.match(/(?:error\s*code|cloudflare\s+error)\s*[:#]?\s*(1033)/i)?.[1];
  if (cloudflareCode) return { ready: false, retryable: true, reason: `CLOUDFLARE_${cloudflareCode}`, excerpt };
  if ([408, 425, 429, 502, 503, 520, 521, 522, 523, 524, 525, 526, 530].includes(probe.statusCode)) {
    return { ready: false, retryable: true, reason: `HTTP_${probe.statusCode}`, excerpt };
  }
  return { ready: false, retryable: false, reason: `HTTP_${probe.statusCode}`, excerpt };
}

async function isHealthy(url) {
  return classifyHealthProbe(await requestText(url)).ready;
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

function getWindowsPortOwner(port) {
  if (process.platform !== "win32") return null;
  const command = `$connection = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1; if ($connection) { $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue; [pscustomobject]@{ pid = $connection.OwningProcess; name = $process.ProcessName } | ConvertTo-Json -Compress }`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

function quoteForWindowsCommandProcessor(value) {
  const stringValue = String(value);
  if (!/[\s"&|<>()^]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '"')}"`;
}

function createCommandInvocation(command, args, platform = process.platform, comSpec = process.env.ComSpec) {
  if (platform !== "win32") return { command, args };
  const commandLine = [command, ...args].map(quoteForWindowsCommandProcessor).join(" ");
  return { command: comSpec || "cmd.exe", args: ["/d", "/s", "/c", commandLine] };
}

function startChild(name, command, args, cwd, { useWindowsCommandProcessor = false } = {}) {
  const invocation = useWindowsCommandProcessor
    ? createCommandInvocation(command, args)
    : { command, args };
  const child = spawn(invocation.command, invocation.args, { cwd, shell: false, windowsHide: true, stdio: ["inherit", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => prefixOutput(name, chunk));
  child.stderr.on("data", (chunk) => prefixOutput(name, chunk));
  child.on("error", (error) => console.error(`[${name}] ${redactSensitiveText(error.message)}`));
  return child;
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await wait(RETRY_INTERVAL_MS);
  }
  return false;
}

function isChildAlive(child) {
  return Boolean(child?.pid) && child.exitCode === null && child.signalCode === null;
}

function formatReadinessAttempt(attempt, elapsedMs, childAlive, probe, classification) {
  const prefix = `Tunnel readiness #${attempt} +${elapsedMs}ms cloudflared=${childAlive ? "alive" : "stopped"} GET ${probe.url}`;
  const fallback = probe.dnsFallback?.address
    ? ` via Cloudflare DNS A ${probe.dnsFallback.address}`
    : probe.dnsFallback?.errorCode ? ` Cloudflare DNS fallback=${probe.dnsFallback.errorCode}` : "";
  if (probe.errorName) {
    return `${prefix} -> ${classification.reason}: ${probe.errorName}: ${probe.errorMessage}${fallback}`;
  }
  const excerpt = classification.excerpt ? ` body="${classification.excerpt}"` : "";
  return `${prefix} -> HTTP ${probe.statusCode} ${classification.reason}${fallback}${excerpt}`;
}

function independentPublicCheck(url) {
  const command = process.platform === "win32" ? "curl.exe" : "curl";
  const result = spawnSync(command, ["--silent", "--show-error", "--max-time", "5", "--output", "-", "--write-out", "\n__DEV_MOBILE_HTTP_STATUS__:%{http_code}", url], { encoding: "utf8", windowsHide: true });
  if (result.error) return { errorName: result.error.name, errorMessage: result.error.message };
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const marker = "__DEV_MOBILE_HTTP_STATUS__:";
  const markerIndex = stdout.lastIndexOf(marker);
  const body = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout;
  const statusCode = markerIndex >= 0 ? Number(stdout.slice(markerIndex + marker.length).match(/\d{3}/)?.[0]) : 0;
  return { statusCode, body, errorMessage: safeBodyExcerpt(stderr), exitCode: result.status };
}

async function waitForPublicBackend(healthUrl, tunnel, timeoutMs) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let attempt = 0;
  let lastSummary = "no public request completed";
  while (Date.now() < deadline) {
    if (!isChildAlive(tunnel)) {
      throw new LauncherError("TUNNEL_START_FAILED", `cloudflared stopped during readiness after ${attempt} attempt(s).`);
    }
    attempt += 1;
    const probe = await requestPublicHealth(healthUrl);
    const classification = classifyHealthProbe(probe);
    const elapsedMs = Date.now() - startedAt;
    lastSummary = formatReadinessAttempt(attempt, elapsedMs, isChildAlive(tunnel), probe, classification);
    log(lastSummary);
    if (classification.ready) return true;
    if (!classification.retryable) {
      throw new LauncherError("TUNNEL_HEALTH_FAILED", `Public health verification failed permanently: ${lastSummary}`);
    }
    if (attempt === 1) {
      const independent = independentPublicCheck(healthUrl);
      if (independent.errorName) {
        log(`Independent curl check GET ${healthUrl} -> ${independent.errorName}: ${independent.errorMessage}`);
      } else {
        log(`Independent curl check GET ${healthUrl} -> HTTP ${independent.statusCode || "none"} exit=${independent.exitCode ?? "unknown"}${independent.errorMessage ? ` error="${independent.errorMessage}"` : ""}${safeBodyExcerpt(independent.body) ? ` body="${safeBodyExcerpt(independent.body)}"` : ""}`);
      }
    }
    await wait(Math.min(1_000 * 2 ** Math.min(attempt - 1, 3), 8_000));
  }
  throw new LauncherError("TUNNEL_HEALTH_FAILED", `Public health verification timed out after ${attempt} attempt(s): ${lastSummary}`);
}

function waitForTunnelUrl(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => finish(new LauncherError("TUNNEL_URL_NOT_FOUND", "Cloudflare Quick Tunnel did not publish a URL within two minutes.")), timeoutMs);
    const onOutput = (chunk) => {
      output += chunk.toString();
      const tunnelUrl = parseQuickTunnelUrl(output);
      if (tunnelUrl) finish(null, tunnelUrl);
    };
    const onExit = (code, signal) => finish(new LauncherError("TUNNEL_START_FAILED", `cloudflared exited before publishing a tunnel URL (code ${code ?? "unknown"}, signal ${signal ?? "none"}).`));
    function finish(error, value) {
      clearTimeout(timeout);
      child.stdout.off("data", onOutput);
      child.stderr.off("data", onOutput);
      child.off("exit", onExit);
      if (error) reject(error); else resolve(value);
    }
    child.stdout.on("data", onOutput);
    child.stderr.on("data", onOutput);
    child.once("exit", onExit);
  });
}

function writeMobileEnv(apiBaseUrl) {
  const envPath = path.join(MOBILE_DIR, ".env");
  try {
    const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    fs.writeFileSync(envPath, updateEnvApiBaseUrl(current, apiBaseUrl), "utf8");
  } catch (error) {
    throw new LauncherError("ENV_UPDATE_FAILED", "Could not update testimonium-parishioner-app/.env.", error);
  }
}

function terminateChild(child) {
  if (!child?.pid || child.exitCode !== null || child.killed) return Promise.resolve();
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
  }
  child.kill("SIGTERM");
  return Promise.resolve();
}

async function cleanup(children) {
  await Promise.allSettled([...children].reverse().map(terminateChild));
}

function waitForShutdown(children) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const signalHandler = () => finish();
    const exits = children.map(({ name }) => () => finish(new LauncherError("PROCESS_EXITED", `${name} stopped unexpectedly.`)));
    function finish(error) {
      if (settled) return;
      settled = true;
      process.off("SIGINT", signalHandler);
      process.off("SIGTERM", signalHandler);
      children.forEach(({ child }, index) => child.off("exit", exits[index]));
      if (error) reject(error); else resolve();
    }
    process.once("SIGINT", signalHandler);
    process.once("SIGTERM", signalHandler);
    children.forEach(({ child }, index) => child.once("exit", exits[index]));
  });
}

async function main() {
  const ownedChildren = [];
  try {
    log("Checking backend...");
    if (!(await isHealthy(HEALTH_URL))) {
      if (await isPortListening(5000)) {
        throw new LauncherError("BACKEND_UNHEALTHY", "Port 5000 is occupied, but GET /api/v1/health did not report a healthy TESTIMONIUM backend. Stop or fix that process, then retry.");
      }
      log("Starting existing TESTIMONIUM backend package...");
      ownedChildren.push(startChild("backend", npmCommand(), ["run", "dev", "--prefix", "testimonium-backend"], ROOT_DIR, { useWindowsCommandProcessor: true }));
      if (!(await waitFor(() => isHealthy(HEALTH_URL), STARTUP_TIMEOUT_MS))) {
        throw new LauncherError("BACKEND_START_FAILED", "The TESTIMONIUM backend did not become healthy on http://localhost:5000/api/v1/health within two minutes.");
      }
    }
    log("Backend ready on http://localhost:5000");

    const cloudflared = resolveCloudflared();
    if (!cloudflared) {
      throw new LauncherError("CLOUDFLARED_NOT_FOUND", "cloudflared was not found on PATH or at C:\\tmp\\testimonium-cloudflared\\cloudflared.exe. Install it on PATH or place it at that path, then retry.");
    }
    log("Starting Cloudflare Quick Tunnel...");
    const tunnel = startChild("cloudflared", cloudflared, ["tunnel", "--url", "http://localhost:5000"], ROOT_DIR);
    ownedChildren.push(tunnel);
    const tunnelUrl = await waitForTunnelUrl(tunnel, STARTUP_TIMEOUT_MS);
    const publicHealthUrl = buildPublicHealthUrl(tunnelUrl);
    const publicApiUrl = derivePublicApiUrl(tunnelUrl);
    log(`Tunnel URL captured: ${tunnelUrl}`);
    await waitForPublicBackend(publicHealthUrl, tunnel, STARTUP_TIMEOUT_MS);
    log("Public backend health verified");
    log(`Public API: ${publicApiUrl}`);

    writeMobileEnv(publicApiUrl);
    log("Updated mobile .env (EXPO_PUBLIC_API_BASE_URL only)");

    if (await isPortListening(8081)) {
      const owner = getWindowsPortOwner(8081);
      const detail = owner ? ` (${owner.name || "unknown process"}, PID ${owner.pid})` : "";
      throw new LauncherError("METRO_START_FAILED", `Port 8081 is already in use${detail}. Stop the existing Expo/Metro server if it belongs to another session, then retry. This launcher will not kill it or change ports.`);
    }
    log("Starting Expo development server...");
    ownedChildren.push(startChild("metro", npxCommand(), ["expo", "start", "--dev-client", "--tunnel"], MOBILE_DIR, { useWindowsCommandProcessor: true }));
    await waitForShutdown(ownedChildren.map((child, index) => ({ name: ["backend", "cloudflared", "metro"][index], child })));
  } finally {
    if (ownedChildren.length) {
      log("Stopping launcher-owned processes...");
      await cleanup(ownedChildren);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[dev:mobile] ${error.code || "DEV_MOBILE_FAILED"}: ${redactSensitiveText(error.message)}`);
    process.exitCode = 1;
  });
}

module.exports = { buildPublicHealthUrl, classifyHealthProbe, CLOUDFLARED_FALLBACK, createCommandInvocation, derivePublicApiUrl, parseQuickTunnelUrl, resolveCloudflared, sanitizeQuickTunnelUrl, updateEnvApiBaseUrl };
