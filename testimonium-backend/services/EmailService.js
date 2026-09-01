import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export class EmailService {
  constructor() {
    const hasUser = Boolean(env.smtp.user);
    const hasPass = Boolean(env.smtp.password);
    const authMisconfigured = (hasUser && !hasPass) || (!hasUser && hasPass);

    if (authMisconfigured) {
      console.warn("[EmailService] SMTP authentication is misconfigured: either SMTP_USER or SMTP_PASSWORD is missing while the other is provided.");
    }

    this.transporter = (env.smtp.enabled && !authMisconfigured)
      ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          auth: hasUser ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
          connectionTimeout: env.smtp.connectionTimeoutMs,
          greetingTimeout: env.smtp.greetingTimeoutMs,
          socketTimeout: env.smtp.socketTimeoutMs,
        })
      : null;
  }

  isConfigured() {
    return Boolean(this.transporter && env.smtp.fromEmail);
  }

  async send({ to, subject, html, text }) {
    if (!this.isConfigured()) {
      const error = new Error("SMTP transport is not configured.");
      error.permanent = false;
      throw error;
    }
    return this.transporter.sendMail({
      from: { name: env.smtp.fromName, address: env.smtp.fromEmail },
      to,
      subject,
      html,
      text,
    });
  }
}
