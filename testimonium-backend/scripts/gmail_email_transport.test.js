import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

// Never use private Gmail credentials or a real database/provider in this suite.
Object.assign(process.env, {
  NODE_ENV: "production", EMAIL_TRANSPORT: "gmail_api",
  GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret",
  GMAIL_REFRESH_TOKEN: "test-refresh", SMTP_FROM_EMAIL: "testimonium.system@gmail.com",
  SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "",
  SUPABASE_DATABASE_URL: "postgresql://test:test@127.0.0.1:9/test",
});
const { env } = await import("../config/env.js");
const { EmailService } = await import("../services/EmailService.js");
const { EmailOutboxWorker } = await import("../services/EmailOutboxWorker.js");
const { prisma } = await import("../config/db.js");
const { logger } = await import("../config/logger.js");

const config = (overrides = {}) => ({
  emailTransport: "gmail_api",
  gmail: { clientId: "test-client", clientSecret: "test-secret", refreshToken: "test-refresh" },
  smtp: {
    enabled: false, fromName: "TESTIMONIUM", fromEmail: "testimonium.system@gmail.com",
    connectionTimeoutMs: 10000, greetingTimeoutMs: 10000, socketTimeoutMs: 20000,
  },
  ...overrides,
});
const message = {
  to: "recipient@example.invalid", subject: "TESTIMONIUM notice",
  html: "<p>Hello &amp; welcome</p>", text: "Hello & welcome\nSecond line",
};

test("environment parser selects Gmail explicitly and defaults to SMTP only when absent", async (t) => {
  const original = process.env.EMAIL_TRANSPORT;
  t.after(() => { process.env.EMAIL_TRANSPORT = original; });
  t.mock.method(dotenv, "config", () => ({ parsed: {} }));
  for (const [index, [value, expected]] of [
    [undefined, "smtp"], ["smtp", "smtp"], [" GMAIL_API ", "gmail_api"], ["unknown", "unknown"],
  ].entries()) {
    if (value === undefined) delete process.env.EMAIL_TRANSPORT;
    else process.env.EMAIL_TRANSPORT = value;
    const parsed = await import(`../config/env.js?email-transport-test=${index}`);
    assert.equal(parsed.env.emailTransport, expected);
    assert.equal(parsed.env.gmail.clientId, "test-client");
  }
});
function apiError(status, reason, oauthError) {
  return Object.assign(new Error("private token and message details"), {
    responseCode: status, // HTTP 5xx must never become permanent SMTP errors.
    response: { status, data: { error: oauthError || { errors: [{ reason }] } } },
    config: { headers: { Authorization: "private-access-token" }, data: "private-refresh-token" },
  });
}
function mockHttp(service, handler) {
  // Mock below OAuth2Client: exercise its real token acquisition/cache/refresh.
  service.oauthClient.transporter.defaults.adapter = async (options) => {
    const data = await handler(options);
    return { config: options, status: 200, statusText: "OK", headers: new Headers(), data };
  };
}
function decodeHeader(value) {
  return value.replace(/(\?=)[ \t]+(?==\?)/g, "$1").replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=/gi, (_, encoding, data) => (
    encoding.toUpperCase() === "B"
      ? Buffer.from(data, "base64").toString("utf8")
      : Buffer.from(data.replaceAll("_", " ").replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16))), "binary").toString("utf8")
  ));
}
function stub(t, target, key, implementation) {
  // Prisma exposes methods through proxies rather than own method descriptors.
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}
function parseMime(raw) {
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  const unfolded = mime.replace(/\r\n[ \t]+/g, " ");
  const boundary = /boundary="([^"]+)"/.exec(unfolded)?.[1];
  assert.ok(boundary, "multipart alternative boundary");
  const parts = mime.split(`--${boundary}`).slice(1, -1).map((part) => {
    const split = part.indexOf("\r\n\r\n");
    const headers = part.slice(0, split);
    let body = part.slice(split + 4).replace(/\r\n$/, "");
    if (/Content-Transfer-Encoding: base64/i.test(headers)) body = Buffer.from(body, "base64").toString("utf8");
    if (/Content-Transfer-Encoding: quoted-printable/i.test(headers)) {
      body = Buffer.from(body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16))), "binary").toString("utf8");
    }
    return { headers, body: body.replace(/\r\n/g, "\n") };
  });
  return { headers: unfolded.split("\r\n\r\n")[0], parts };
}

test("Gmail configuration needs no SMTP host/auth and never creates an SMTP transport", (t) => {
  const smtp = t.mock.method(nodemailer, "createTransport", () => { throw new Error("SMTP forbidden"); });
  const service = new EmailService(config());
  assert.equal(service.isConfigured(), true);
  assert.equal(service.transporter, null);
  assert.equal(service.oauthClient.credentials.refresh_token, "test-refresh");
  assert.equal(smtp.mock.callCount(), 0);
  assert.equal(env.emailTransport, "gmail_api");
  assert.equal(env.smtp.enabled, false);
});

test("Gmail HTTPS send preserves MIME content and maps the provider ID", async () => {
  const service = new EmailService(config());
  let sent;
  mockHttp(service, (options) => {
    if (String(options.url).includes("oauth2.googleapis.com")) {
      assert.equal(options.timeout, 20000);
      assert.equal(options.retryConfig.retry, 0);
      assert.equal(options.data.get("grant_type"), "refresh_token");
      assert.equal(options.data.has("scope"), false, "existing send-only grant is reused");
      return { access_token: "mock-access", expires_in: 3600, token_type: "Bearer" };
    }
    sent = options;
    return { id: "gmail-provider-id" };
  });
  assert.deepEqual(await service.send(message), { messageId: "gmail-provider-id" });
  assert.equal(String(sent.url), "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(sent.method, "POST");
  assert.equal(sent.headers.get("Authorization"), "Bearer mock-access");
  assert.equal(sent.retryConfig.retry, 0);
  assert.match(sent.data.raw, /^[A-Za-z0-9_-]+$/);
  const parsed = parseMime(sent.data.raw);
  assert.match(parsed.headers, /From: TESTIMONIUM <testimonium.system@gmail.com>/);
  assert.match(parsed.headers, /To: recipient@example.invalid/);
  assert.match(parsed.headers, /Subject: TESTIMONIUM notice/);
  assert.equal(parsed.parts.find((part) => /text\/plain/.test(part.headers)).body, message.text);
  assert.equal(parsed.parts.find((part) => /text\/html/.test(part.headers)).body, message.html);
});

test("MIME preserves Unicode display names, recipient names, subject and multiline bodies", async () => {
  const cfg = config();
  cfg.smtp.fromName = "TESTIMONIUM — Paróquia";
  const service = new EmailService(cfg);
  let raw;
  mockHttp(service, (options) => {
    if (String(options.url).includes("oauth2.googleapis.com")) return { access_token: "mock", expires_in: 3600 };
    raw = options.data.raw;
    return { id: "unicode-id" };
  });
  const unicode = {
    to: [{ name: "José Niño", address: "jose@example.invalid" }, "second@example.invalid"],
    subject: "María — 確認 🙏 & <notice>",
    html: "<p>José &amp; María 🙏</p>\n<p>確認</p>",
    text: "José & María 🙏\n\n確認\nSecond line & <text>",
  };
  await service.send(unicode);
  const parsed = parseMime(raw);
  const headers = decodeHeader(parsed.headers);
  assert.ok(headers.includes(cfg.smtp.fromName));
  assert.ok(headers.includes("José Niño"));
  assert.ok(headers.includes("second@example.invalid"));
  assert.ok(headers.includes(unicode.subject));
  assert.equal(parsed.parts.find((part) => /text\/plain/.test(part.headers)).body, unicode.text);
  assert.equal(parsed.parts.find((part) => /text\/html/.test(part.headers)).body, unicode.html);
});

test("OAuth acquires, caches, refreshes expired tokens and reacquires after restart", async () => {
  let tokens = 0;
  const service = new EmailService(config());
  const handler = (options) => {
    if (String(options.url).includes("oauth2.googleapis.com")) {
      tokens += 1;
      assert.equal(options.data.get("refresh_token"), "test-refresh");
      return { access_token: `access-${tokens}`, expires_in: 3600 };
    }
    assert.equal(options.headers.get("Authorization"), `Bearer access-${tokens}`);
    return { id: "sent" };
  };
  mockHttp(service, handler);
  await service.send(message);
  await service.send(message);
  assert.equal(tokens, 1);
  service.oauthClient.credentials.expiry_date = Date.now() - 1;
  await service.send(message);
  assert.equal(tokens, 2);
  const restarted = new EmailService(config());
  mockHttp(restarted, handler);
  await restarted.send(message);
  assert.equal(tokens, 3);
});

test("OAuth refreshes once after a rejected access token and bounds authorization replay", async () => {
  for (const rejectedAgain of [false, true]) {
    const service = new EmailService(config());
    let tokens = 0;
    let sends = 0;
    service.oauthClient.transporter.defaults.adapter = async (options) => {
      assert.equal(options.timeout, 20000);
      assert.equal(options.retryConfig.retry, 0);
      assert.equal(options.maxRedirects, 0);
      if (String(options.url).includes("oauth2.googleapis.com")) {
        tokens += 1;
        return { config: options, status: 200, headers: new Headers(), data: { access_token: `token-${tokens}`, expires_in: 3600 } };
      }
      sends += 1;
      return {
        config: options, status: sends === 1 || rejectedAgain ? 401 : 200,
        headers: new Headers(), data: { id: "refreshed-send" },
      };
    };
    if (rejectedAgain) await assert.rejects(service.send(message), (error) => error.permanent === true);
    else assert.deepEqual(await service.send(message), { messageId: "refreshed-send" });
    assert.equal(tokens, 2);
    assert.equal(sends, 2);
  }
});

test("a rejected OAuth grant is sanitized and not retried within one attempt", async () => {
  const service = new EmailService(config());
  let requests = 0;
  service.oauthClient.transporter.defaults.adapter = async (options) => {
    requests += 1;
    assert.equal(options.retryConfig.retry, 0);
    return { config: options, status: 400, headers: new Headers(), data: { error: "invalid_grant", error_description: "private detail" } };
  };
  await assert.rejects(service.send(message), (error) => {
    assert.equal(error.permanent, true);
    assert.doesNotMatch(error.message + JSON.stringify(error), /private|invalid_grant|test-refresh/);
    return true;
  });
  assert.equal(requests, 1);
});

test("Gmail 503 has no internal HTTP retries and a missing response ID is not success", async () => {
  for (const status of [503, 200]) {
    const service = new EmailService(config());
    service.oauthClient.setCredentials({ access_token: "mock", refresh_token: "test-refresh", expiry_date: Date.now() + 3600000 });
    let requests = 0;
    service.oauthClient.transporter.defaults.adapter = async (options) => {
      requests += 1;
      return { config: options, status, headers: new Headers(), data: {} };
    };
    await assert.rejects(service.send(message), (error) => error.permanent === false);
    assert.equal(requests, 1);
  }
});

test("missing Gmail credentials or incorrect sender disables delivery without SMTP fallback", async (t) => {
  t.mock.method(console, "warn", () => {});
  const smtp = t.mock.method(nodemailer, "createTransport", () => { throw new Error("fallback forbidden"); });
  for (const key of ["clientId", "clientSecret", "refreshToken"]) {
    const cfg = config();
    cfg.gmail[key] = "";
    const service = new EmailService(cfg);
    assert.equal(service.isConfigured(), false);
    await assert.rejects(service.send(message), (error) => error.permanent === false);
  }
  for (const fromEmail of ["", "other@gmail.com"]) {
    const cfg = config();
    cfg.smtp.fromEmail = fromEmail;
    assert.equal(new EmailService(cfg).isConfigured(), false);
  }
  assert.equal(new EmailService(config({ emailTransport: "unsupported" })).isConfigured(), false);
  assert.equal(smtp.mock.callCount(), 0);
});

test("SMTP explicit/default selection keeps transport options and send result", async (t) => {
  let options;
  let sent;
  t.mock.method(nodemailer, "createTransport", (value) => {
    options = value;
    return { sendMail: async (mail) => { sent = mail; return { messageId: "smtp-id" }; } };
  });
  const cfg = config({ emailTransport: "smtp" });
  Object.assign(cfg.smtp, { enabled: true, host: "smtp.example.invalid", port: 587, secure: false, user: "smtp-user", password: "smtp-pass" });
  for (const selection of ["smtp", undefined]) {
    cfg.emailTransport = selection;
    const service = new EmailService(cfg);
    assert.equal(service.isConfigured(), true);
    assert.equal(service.oauthClient, null);
    assert.deepEqual(await service.send(message), { messageId: "smtp-id" });
    assert.equal(options.host, cfg.smtp.host);
    assert.deepEqual(options.auth, { user: "smtp-user", pass: "smtp-pass" });
    assert.equal(options.socketTimeout, 20000);
    assert.deepEqual(sent, { from: { name: "TESTIMONIUM", address: cfg.smtp.fromEmail }, ...message });
  }
  t.mock.method(console, "warn", () => {});
  cfg.smtp.password = "";
  assert.equal(new EmailService(cfg).isConfigured(), false);
});

for (const [label, error, permanent] of [
  ["HTTP 500", apiError(500), false], ["HTTP 503", apiError(503), false],
  ["HTTP 429", apiError(429), false], ["HTTP 408", apiError(408), false],
  ...["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded"].map((reason) => [reason, apiError(403, reason), false]),
  ["network timeout", Object.assign(new Error("private timeout"), { code: "ETIMEDOUT" }), false],
  ["invalid payload", apiError(400), true], ["invalid grant", apiError(400, null, "invalid_grant"), true],
  ["invalid client", apiError(401, null, "invalid_client"), true],
  ["permission denied", apiError(403, "insufficientPermissions"), true],
]) {
  test(`Gmail ${label}: safe ${permanent ? "permanent" : "retryable"} failure and worker state`, async (t) => {
    t.mock.method(OAuth2Client.prototype, "request", async () => { throw error; });
    const service = new EmailService(config());
    await assert.rejects(service.send(message), (safe) => {
      assert.equal(safe.permanent, permanent);
      assert.equal(safe.code, "GMAIL_API_DELIVERY_ERROR");
      assert.doesNotMatch(JSON.stringify(safe) + safe.message, /private|Authorization|test-secret|test-refresh/);
      assert.equal(safe.cause, undefined);
      assert.equal(safe.responseCode, undefined);
      return true;
    });
    const writes = [];
    stub(t, prisma.emailOutbox, "updateMany", async (args) => { writes.push(args); return { count: 1 }; });
    t.mock.method(logger, "warn", () => {});
    const job = { email_outbox_id: 1, processing_token: "lease-token", attempt_count: 1, email_type: "DOCUMENT_SUBMITTED", payload: {}, recipient_email: message.to };
    const before = Date.now();
    await EmailOutboxWorker.process(job);
    assert.equal(writes[0].data.status, permanent ? "FAILED" : "RETRY");
    assert.equal(writes[0].where.processingToken, "lease-token");
    assert.equal(writes[0].data.processingToken, null);
    assert.doesNotMatch(writes[0].data.lastError, /private/);
    if (!permanent) {
      assert.ok(writes[0].data.nextAttemptAt.getTime() >= before + 60_000);
      await EmailOutboxWorker.process({ ...job, attempt_count: env.smtp.maxAttempts });
      assert.equal(writes[1].data.status, "FAILED");
    }
  });
}

test("worker starts and records Gmail ID with no SMTP host; claim lease covers HTTP phases", async (t) => {
  const job = { email_outbox_id: 42, processing_token: "owned", attempt_count: 1, email_type: "DOCUMENT_SUBMITTED", payload: {}, recipient_email: message.to };
  let claims = 0;
  let lease;
  let update;
  stub(t, prisma, "$queryRaw", async (_sql, _token, seconds) => {
    lease = seconds;
    claims += 1;
    return claims === 1 ? [job] : [];
  });
  stub(t, prisma.emailOutbox, "updateMany", async (args) => { update = args; return { count: 1 }; });
  t.mock.method(OAuth2Client.prototype, "request", async () => ({ data: { id: "worker-gmail-id" } }));
  const originalLease = env.smtp.workerLeaseSeconds;
  env.smtp.workerLeaseSeconds = 1;
  t.after(() => { env.smtp.workerLeaseSeconds = originalLease; });
  try {
    EmailOutboxWorker.start();
    await EmailOutboxWorker.stop();
    assert.equal(claims, 2);
    assert.ok(lease >= 110);
    assert.equal(update.data.status, "SENT");
    assert.equal(update.data.providerMessageId, "worker-gmail-id");
    assert.deepEqual(update.where, { id: 42, status: "PROCESSING", processingToken: "owned" });
  } finally {
    await EmailOutboxWorker.stop();
  }
});

test("unconfigured worker startup warns safely and does not claim queued rows", async (t) => {
  t.mock.method(EmailService.prototype, "isConfigured", () => false);
  const claim = t.mock.method(EmailOutboxWorker, "claimOne", async () => { throw new Error("must not claim"); });
  const warning = t.mock.method(logger, "warn", () => {});
  EmailOutboxWorker.start();
  await EmailOutboxWorker.stop();
  assert.equal(claim.mock.callCount(), 0);
  assert.match(warning.mock.calls[0].arguments[0], /queued email will remain durable/);
});

test("worker retains SMTP permanent 550 and transient 450 classification", async (t) => {
  t.mock.method(logger, "warn", () => {});
  for (const [responseCode, expected] of [[550, "FAILED"], [450, "RETRY"]]) {
    let update;
    stub(t, prisma.emailOutbox, "updateMany", async (args) => { update = args; return { count: 1 }; });
    const send = t.mock.method(EmailService.prototype, "send", async () => {
      throw Object.assign(new Error("SMTP rejection"), { responseCode });
    });
    await EmailOutboxWorker.process({ email_outbox_id: 1, processing_token: "owned", attempt_count: 1, email_type: "DOCUMENT_SUBMITTED", payload: {}, recipient_email: message.to });
    assert.equal(update.data.status, expected);
    send.mock.restore();
  }
});
