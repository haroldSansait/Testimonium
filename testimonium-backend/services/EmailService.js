import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

const GMAIL_SENDER = "testimonium.system@gmail.com";
const GMAIL_REQUEST_TIMEOUT_MS = 20_000;
const TEMPORARY_REASONS = new Set([
  "rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded",
  "quotaExceeded", "RESOURCE_EXHAUSTED", "backendError", "internalError",
]);

// Never propagate Google/Gaxios errors: they may contain credential-bearing
// request headers, token exchange bodies, or the entire email payload.
function gmailDeliveryError(error) {
  const status = Number(error?.response?.status || error?.status || error?.code) || 0;
  const data = error?.response?.data;
  const oauthError = typeof data?.error === "string" ? data.error : null;
  const reasons = [data?.error?.status, ...(data?.error?.errors || []).map((item) => item.reason)];
  const transient = status === 408 || status === 429 || status >= 500
    || reasons.some((reason) => TEMPORARY_REASONS.has(reason))
    || ["temporarily_unavailable", "server_error"].includes(oauthError);
  const permanent = !transient && (
    [400, 401, 403, 404, 405, 413, 422].includes(status)
    || ["invalid_grant", "invalid_client", "unauthorized_client", "invalid_scope"].includes(oauthError)
    || ["EENVELOPE", "EMESSAGE"].includes(error?.code)
  );
  const safe = new Error(`Gmail API delivery ${permanent ? "rejected" : "temporarily unavailable"}${status ? ` (HTTP ${status})` : ""}.`);
  safe.code = "GMAIL_API_DELIVERY_ERROR";
  safe.permanent = permanent;
  return safe;
}

export class EmailService {
  constructor(config = env) {
    this.config = config;
    this.transport = config.emailTransport ?? "smtp";
    this.transporter = null;
    this.oauthClient = null;

    if (this.transport === "gmail_api") {
      const gmail = config.gmail || {};
      if (!gmail.clientId || !gmail.clientSecret || !gmail.refreshToken
        || config.smtp.fromEmail?.trim().toLowerCase() !== GMAIL_SENDER) {
        console.warn("[EmailService] Gmail API requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and SMTP_FROM_EMAIL=testimonium.system@gmail.com; queued email will remain durable.");
        return;
      }
      this.oauthClient = new OAuth2Client({
        clientId: gmail.clientId,
        clientSecret: gmail.clientSecret,
        forceRefreshOnFailure: true,
        transporterOptions: {
          timeout: GMAIL_REQUEST_TIMEOUT_MS,
          // The outbox owns retries. Also disable token exchange HTTP retries.
          retryConfig: { retry: 0 },
          maxRedirects: 0,
        },
      });
      // Reuse the existing gmail.send grant; no authorization flow or new scope.
      this.oauthClient.setCredentials({ refresh_token: gmail.refreshToken });
      return;
    }
    if (this.transport !== "smtp") {
      console.warn("[EmailService] Unsupported EMAIL_TRANSPORT; queued email will remain durable.");
      return;
    }

    const hasUser = Boolean(config.smtp.user);
    const hasPass = Boolean(config.smtp.password);
    const authMisconfigured = (hasUser && !hasPass) || (!hasUser && hasPass);

    if (authMisconfigured) {
      console.warn("[EmailService] SMTP authentication is misconfigured: either SMTP_USER or SMTP_PASSWORD is missing while the other is provided.");
    }

    this.transporter = (config.smtp.enabled && !authMisconfigured)
      ? nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: hasUser ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
          connectionTimeout: config.smtp.connectionTimeoutMs,
          greetingTimeout: config.smtp.greetingTimeoutMs,
          socketTimeout: config.smtp.socketTimeoutMs,
        })
      : null;
  }

  isConfigured() {
    return Boolean((this.oauthClient || this.transporter) && this.config.smtp.fromEmail);
  }

  getDeliveryTimeoutMs() {
    // At most: initial token exchange, send, one auth refresh and one replay.
    // Every HTTP request (including OAuth) has a timeout and no HTTP retries.
    if (this.transport === "gmail_api") return 4 * GMAIL_REQUEST_TIMEOUT_MS;
    const smtp = this.config.smtp;
    return smtp.connectionTimeoutMs + smtp.greetingTimeoutMs + smtp.socketTimeoutMs;
  }

  async send({ to, subject, html, text, attachments }) {
    if (!this.isConfigured()) {
      const error = new Error("Email delivery transport is not configured.");
      error.permanent = false;
      throw error;
    }
    const message = {
      from: { name: this.config.smtp.fromName, address: this.config.smtp.fromEmail },
      to,
      subject,
      html,
      text,
      ...(attachments ? { attachments } : {}),
    };
    if (this.transport === "gmail_api") {
      try {
        // MailComposer only builds MIME bytes and never opens an SMTP socket.
        const mime = await new MailComposer({
          ...message, disableFileAccess: true, disableUrlAccess: true,
        }).compile().build();
        const result = await this.oauthClient.request({
          method: "POST",
          url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          data: { raw: mime.toString("base64url") },
          timeout: GMAIL_REQUEST_TIMEOUT_MS,
          retry: false,
          retryConfig: { retry: 0 },
        });
        if (!result.data?.id) throw new Error("Missing Gmail message ID");
        return { messageId: result.data.id };
      } catch (error) {
        throw gmailDeliveryError(error);
      }
    }
    return this.transporter.sendMail(message);
  }
}
