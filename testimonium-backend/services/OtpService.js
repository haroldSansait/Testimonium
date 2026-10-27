import crypto from "node:crypto";
import { prisma as defaultPrisma } from "../config/db.js";
import { env, getOtpHmacSecret, getOtpMaxDailySends } from "../config/env.js";
import { logger } from "../config/logger.js";
import { EmailService } from "./EmailService.js";
import { FirebaseAdminService } from "./FirebaseAdminService.js";
import { renderEmail } from "./email/EmailTemplates.js";
import { AuditLogService } from "./AuditLogService.js";

const TEN_MINUTES = 600_000;
const DAY = 86_400_000;
const RESET_LEASE = 120_000;
const normalizeEmail = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = email => email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const failure = (code, message, statusCode = 400, extra = {}) => Object.assign(new Error(message), { code, statusCode, ...extra });
const invalidCode = () => failure("OTP_INVALID", "Invalid or expired code. Please try again or request a new code.");
const invalidGrant = () => failure("RESET_GRANT_INVALID", "Password reset session is invalid or expired. Please request a new code.");
const hmac = value => crypto.createHmac("sha256", getOtpHmacSecret()).update(value).digest("hex");
const sameHash = (left, right) => typeof right === "string" && left.length === right.length
  && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));

export const formatRemainingTime = (seconds) => {
  const totalSeconds = Math.max(1, Math.ceil(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSecs = totalSeconds % 60;

  if (hours > 0) {
    const hrText = `${hours} ${hours === 1 ? "hour" : "hours"}`;
    if (minutes > 0) {
      const minText = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
      return `${hrText} and ${minText}`;
    }
    return hrText;
  }
  if (minutes > 0) {
    const minText = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
    if (remainingSecs > 0 && minutes < 5) {
      const secText = `${remainingSecs} ${remainingSecs === 1 ? "second" : "seconds"}`;
      return `${minText} and ${secText}`;
    }
    return minText;
  }
  return `${remainingSecs} ${remainingSecs === 1 ? "second" : "seconds"}`;
};

export const generateOtpCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
export const generateResetToken = () => crypto.randomBytes(32).toString("hex");
export const hashOtpCode = (code, email, purpose, binding = "") => hmac(JSON.stringify([purpose, normalizeEmail(email), binding, code]));
export const verifyOtpCode = (code, email, purpose, stored, binding = "") => typeof code === "string" && /^\d{6}$/.test(code)
  && sameHash(hashOtpCode(code, email, purpose, binding), stored);
export const hashResetToken = (token, email) => hmac(JSON.stringify(["RESET_TOKEN", normalizeEmail(email), token]));
export const verifyResetToken = (token, email, stored) => typeof token === "string" && sameHash(hashResetToken(token, email), stored);

export class OtpService {
  constructor(prisma = defaultPrisma, emailService = new EmailService(), firebaseAdmin = new FirebaseAdminService(), auditLog = AuditLogService, options = {}) {
    Object.assign(this, { prisma, emailService, firebaseAdmin, auditLog });
    this.dispatches = new Set();
    this.maxDailySends = options?.maxDailySends;
  }

  async recordAudit(firebaseUid, action) {
    try {
      const user = await this.prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
      if (user) await this.auditLog.log(user.id, action, null, false);
    } catch {
      // Audit availability cannot turn a completed external side effect into a
      // failed reset, or encourage replay. No provider data enters this log.
      logger.warn("OTP audit record could not be written");
    }
  }

  // Transaction-scoped PostgreSQL locks serialize all instances, including an
  // initially empty challenge set. Sorted keys prevent email/UID deadlocks.
  async locked(email, purpose, uid, work) {
    return this.prisma.$transaction(async tx => {
      const keys = [`otp:${purpose}:email:${email}`, ...(uid ? [`otp:${purpose}:uid:${uid}`] : [])].sort();
      for (const key of keys) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
      }
      return work(tx);
    }, { maxWait: 10_000, timeout: 100_000 });
  }

  async identity(uid, email, passwordRequired = false) {
    let user;
    try { user = await this.firebaseAdmin.getUser(uid); }
    catch { throw failure("IDENTITY_UNAVAILABLE", "Could not confirm your account. Please retry.", 503); }
    if (!user || user.disabled || user.uid !== uid || normalizeEmail(user.email) !== email
      || (passwordRequired && !user.providerData?.some(p => p.providerId === "password"))) {
      throw failure("IDENTITY_CHANGED", "Your account has changed. Please sign in again or request a new code.", 409);
    }
    return user;
  }

  async invalidate(tx, email, purpose, uid) {
    await tx.otpChallenge.updateMany({
      where: { purpose, OR: [{ email }, ...(uid ? [{ firebaseUid: uid }] : [])], status: { in: ["PENDING", "VERIFIED", "SENDING"] } },
      data: { status: "INVALIDATED", invalidatedAt: new Date() },
    });
  }

  async sendChallenge({ email, firebaseUid, purpose, recipientName, ipAddress, userAgent }) {
    const code = generateOtpCode();
    const binding = `${firebaseUid}:${crypto.randomBytes(16).toString("hex")}`;
    const challenge = await this.locked(email, purpose, firebaseUid, async tx => {
      const maxDailySends = this.maxDailySends ?? getOtpMaxDailySends?.() ?? env.otp?.maxDailySends ?? 30;
      const recent = await tx.otpChallenge.findMany({
        where: { purpose, OR: [{ email }, { firebaseUid }], createdAt: { gte: new Date(Date.now() - DAY) } },
        orderBy: { createdAt: "desc" },
      });
      const retryAfter = recent[0] ? Math.ceil((60_000 - (Date.now() - recent[0].lastSentAt.getTime())) / 1000) : 0;
      if (retryAfter > 0) throw failure("RESEND_COOLDOWN_ACTIVE", `Please wait ${retryAfter} seconds before requesting another code.`, 429, { retryAfter });
      if (recent.length >= maxDailySends) {
        const limitingChallenge = recent[maxDailySends - 1] || recent[recent.length - 1];
        const remainingMs = Math.max(0, (limitingChallenge.createdAt.getTime() + DAY) - Date.now());
        const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        const timeStr = formatRemainingTime(retryAfterSeconds);
        throw failure(
          "ACCOUNT_RESEND_LIMIT_EXCEEDED",
          `You've reached the verification email limit (${maxDailySends} requests). You can request another code in ${timeStr}.`,
          429,
          { retryAfter: retryAfterSeconds, limit: maxDailySends }
        );
      }
      // Do not supersede a delivery still in flight, even on a slow transport.
      if (recent.some(c => c.status === "SENDING" && Date.now() - c.createdAt.getTime() < RESET_LEASE)) {
        throw failure("DELIVERY_IN_PROGRESS", "A code is still being sent. Please wait.", 409);
      }
      const activeReset = purpose === "PASSWORD_RESET" && await tx.otpChallenge.findFirst({
        where: { firebaseUid, purpose, operationStage: { in: ["APPLYING", "APPLIED", "UNCERTAIN"] }, operationStartedAt: { gt: new Date(Date.now() - RESET_LEASE) } },
      });
      if (activeReset) throw failure("RESET_IN_PROGRESS", "A password reset is being completed. Please wait.", 409);
      await this.invalidate(tx, email, purpose, firebaseUid);
      return tx.otpChallenge.create({ data: {
        email, firebaseUid, purpose, codeHash: hashOtpCode(code, email, purpose, binding), binding,
        status: "SENDING", expiresAt: new Date(Date.now() + TEN_MINUTES),
        ipAddress: typeof ipAddress === "string" ? ipAddress.slice(0, 64) : null,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
      } });
    });
    try {
      await this.identity(firebaseUid, email, purpose === "PASSWORD_RESET");
      const rendered = renderEmail(`${purpose}_OTP`, { code, recipientName });
      // Direct bounded delivery. The workflow outbox persists raw payloads and
      // retries beyond a challenge's lifetime, so must not carry OTP messages.
      await this.emailService.send({ to: email, ...rendered });
      const activated = await this.prisma.otpChallenge.updateMany({
        where: { id: challenge.id, status: "SENDING", expiresAt: { gt: new Date() } }, data: { status: "PENDING" },
      });
      if (activated.count !== 1) throw new Error("Challenge superseded before delivery completed");
    } catch {
      await this.prisma.otpChallenge.updateMany({
        where: { id: challenge.id, status: "SENDING" }, data: { status: "INVALIDATED", invalidatedAt: new Date() },
      });
      // Provider errors may contain the message body or credentials.
      logger.warn({ challengeId: challenge.id }, "OTP delivery did not complete");
      throw failure("EMAIL_DELIVERY_FAILED", "Could not send the code. Please wait one minute and try again.", 503);
    }
    if (purpose === "PASSWORD_RESET") await this.recordAudit(firebaseUid, "Password Reset Requested");
    return { success: true, message: "Verification code sent. Check your inbox and spam folder.", retryAfter: 60, cooldownSeconds: 60, expiresInMinutes: 10 };
  }

  async requestEmailVerificationOtp({ email, firebaseUid, ...context }) {
    email = normalizeEmail(email);
    if (!firebaseUid || !validEmail(email)) throw failure("UNAUTHORIZED", "A valid authenticated account is required.", 401);
    const user = await this.identity(firebaseUid, email);
    if (user.emailVerified) return { success: true, alreadyVerified: true, message: "Email is already verified." };
    return this.sendChallenge({ ...context, email, firebaseUid, purpose: "EMAIL_VERIFICATION" });
  }

  async checkCode(tx, email, purpose, code, uid) {
    const challenge = await tx.otpChallenge.findFirst({
      where: { email, purpose, ...(uid ? { firebaseUid: uid } : {}), status: "PENDING" }, orderBy: { createdAt: "desc" },
    });
    if (!challenge) return { error: invalidCode() };
    if (challenge.expiresAt <= new Date()) {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { status: "EXPIRED" } });
      return { error: invalidCode() };
    }
    if (challenge.attempts >= 5) {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { status: "FAILED" } });
      return { error: invalidCode() };
    }
    if (!verifyOtpCode(code, email, purpose, challenge.codeHash, challenge.binding)) {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: {
        attempts: { increment: 1 }, status: challenge.attempts + 1 >= 5 ? "FAILED" : "PENDING",
      } });
      // Return instead of throwing: wrong attempts must commit, not roll back.
      return { error: invalidCode() };
    }
    return { challenge };
  }

  async confirmEmailVerificationOtp({ email, firebaseUid, code }) {
    email = normalizeEmail(email);
    if (!firebaseUid || !validEmail(email)) throw failure("UNAUTHORIZED", "Authentication required.", 401);
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw invalidCode();
    const result = await this.locked(email, "EMAIL_VERIFICATION", firebaseUid, async tx => {
      const checked = await this.checkCode(tx, email, "EMAIL_VERIFICATION", code, firebaseUid);
      if (checked.error) return checked;
      await this.identity(firebaseUid, email);
      // Explicit email binds the update to the checked address if a separate
      // Firebase email change races the lookup. It never verifies that new email.
      try { await this.firebaseAdmin.setEmailVerified(firebaseUid, true, email); }
      catch { throw failure("VERIFICATION_UNAVAILABLE", "Verification could not complete. Please retry the same code.", 503); }
      await tx.user.updateMany({ where: { firebaseUid }, data: { email, isVerified: true } });
      await tx.otpChallenge.update({ where: { id: checked.challenge.id }, data: { status: "CONSUMED", consumedAt: new Date() } });
      await this.invalidate(tx, email, "EMAIL_VERIFICATION", firebaseUid);
      return { success: true, message: "Email verified successfully." };
    });
    if (result.error) throw result.error;
    return result;
  }

  async requestPasswordResetOtp({ email, ...context }) {
    email = normalizeEmail(email);
    // Same acknowledgement and latency path for absent, ineligible, throttled
    // and eligible accounts. Never claim successful delivery before transport.
    if (validEmail(email)) {
      const task = new Promise(resolve => setImmediate(resolve)).then(async () => {
        const user = await this.firebaseAdmin.getUserByEmail(email);
        if (!user || user.disabled || !user.providerData?.some(p => p.providerId === "password")) return;
        await this.sendChallenge({ ...context, email, firebaseUid: user.uid, purpose: "PASSWORD_RESET", recipientName: user.displayName });
      }).catch(() => logger.warn("Password reset dispatch was not completed"));
      this.dispatches.add(task);
      task.finally(() => this.dispatches.delete(task));
    }
    return { success: true, message: "If an eligible account exists, a reset code was requested. Check your inbox or try again later.", cooldownSeconds: 60, expiresInMinutes: 10 };
  }

  async verifyPasswordResetOtp({ email, code }) {
    email = normalizeEmail(email);
    if (!validEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) throw invalidCode();
    const result = await this.locked(email, "PASSWORD_RESET", null, async tx => {
      const checked = await this.checkCode(tx, email, "PASSWORD_RESET", code);
      if (checked.error) return checked;
      const { challenge } = checked;
      try { await this.identity(challenge.firebaseUid, email, true); }
      catch { return { error: invalidCode() }; }
      const resetToken = generateResetToken();
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: {
        status: "VERIFIED", resetTokenHash: hashResetToken(resetToken, email), resetTokenExpiresAt: new Date(Date.now() + TEN_MINUTES),
      } });
      return { success: true, resetToken, expiresIn: 600, expiresInMinutes: 10 };
    });
    if (result.error) throw result.error;
    return result;
  }

  async completePasswordReset({ email, resetToken, newPassword }) {
    email = normalizeEmail(email);
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      throw failure("WEAK_PASSWORD", "Password must contain between 8 and 128 characters.");
    }
    if (!validEmail(email) || typeof resetToken !== "string" || !/^[a-f0-9]{64}$/.test(resetToken)) throw invalidGrant();
    const operationHash = hmac(JSON.stringify(["RESET_OPERATION", resetToken, newPassword]));
    const claim = await this.locked(email, "PASSWORD_RESET", null, async tx => {
      const challenge = await tx.otpChallenge.findFirst({ where: { email, purpose: "PASSWORD_RESET", resetTokenHash: hashResetToken(resetToken, email) } });
      if (!challenge || !verifyResetToken(resetToken, email, challenge.resetTokenHash)
        || !challenge.resetTokenExpiresAt || challenge.resetTokenExpiresAt <= new Date()) throw invalidGrant();
      if (challenge.operationHash && !sameHash(operationHash, challenge.operationHash)) throw invalidGrant();
      if (challenge.operationStage === "COMPLETED") return { challenge, receipt: true };
      if (challenge.operationStage === "UNCERTAIN_DONE") throw failure("RESET_OUTCOME_UNKNOWN", "The password update could not be confirmed. Try signing in or request a fresh code.", 409);
      if (challenge.operationStartedAt && Date.now() - challenge.operationStartedAt.getTime() < RESET_LEASE) {
        throw failure("RESET_IN_PROGRESS", "Password reset is being processed. Wait two minutes before retrying the same password.", 409, { retryAfter: 120 });
      }
      if (challenge.status !== "VERIFIED" && !["APPLYING", "APPLIED", "UNCERTAIN"].includes(challenge.operationStage)) throw invalidGrant();
      await this.identity(challenge.firebaseUid, email, true);
      const resuming = challenge.status === "CONSUMED";
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: {
        status: "CONSUMED", consumedAt: new Date(), resetTokenConsumedAt: new Date(),
        operationHash, operationStage: resuming ? challenge.operationStage : "APPLYING", operationStartedAt: new Date(),
      } });
      await this.invalidate(tx, email, "PASSWORD_RESET", challenge.firebaseUid);
      return { challenge, resuming };
    });
    const { challenge } = claim;
    if (claim.receipt) return { success: true, message: "Password reset completed. Please sign in again." };
    // Durable saga, NOT a distributed Firebase/Postgres transaction. An APPLYING
    // retry is ambiguous: it can only revoke/reconcile, never update again.
    let uncertain = claim.resuming && challenge.operationStage !== "APPLIED";
    let stageWriteFailed = false;
    if (!claim.resuming) {
      try { await this.firebaseAdmin.updatePassword(challenge.firebaseUid, newPassword); }
      catch (error) {
        if (["auth/invalid-password", "auth/password-does-not-meet-requirements"].includes(error?.code)) {
          await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: {
            status: "VERIFIED", operationHash: null, operationStage: null, operationStartedAt: null, resetTokenConsumedAt: null,
          } });
          throw failure("WEAK_PASSWORD", "Password does not meet the account password requirements.");
        }
        uncertain = true;
      }
      // If this write fails, persisted APPLYING prevents another password write.
      try { await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { operationStage: uncertain ? "UNCERTAIN" : "APPLIED" } }); }
      catch { stageWriteFailed = true; }
    }
    try { await this.firebaseAdmin.revokeRefreshTokens(challenge.firebaseUid); }
    catch { throw failure("RESET_REVOCATION_PENDING", "The reset needs session cleanup. Wait two minutes, then retry with the same password.", 503); }
    if (stageWriteFailed) throw failure("RESET_RECONCILIATION_PENDING", "The password update needs confirmation. Try signing in or retry the same request after two minutes.", 503);
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { operationStage: uncertain ? "UNCERTAIN_DONE" : "COMPLETED" } });
    if (uncertain) throw failure("RESET_OUTCOME_UNKNOWN", "The password update could not be confirmed. Try signing in or request a fresh code.", 409);
    await this.recordAudit(challenge.firebaseUid, "Password Reset Completed");
    return { success: true, message: "Password reset completed. Please sign in again." };
  }
}

export const defaultOtpService = new OtpService();
