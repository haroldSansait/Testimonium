import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ImageCompressionService } from "./ImageCompressionService.js";
import { RegistrantIdStorageService } from "./RegistrantIdStorageService.js";
import { OcrProviderFactory } from "./ocr/OcrProviderFactory.js";
import {
  classifyGovernmentIdSide,
  extractExpiryDate,
  getGovernmentIdSideIssue,
  identifyGovernmentIdType,
  identifyGovernmentIdTypeFromSubmission,
  parseDateString,
} from "../utils/governmentIdOcrParser.js";

let timer = null;
let activeDrain = null;

const firstMatch = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim().slice(0, 200);
  }
  return null;
};

export function parseRegistrantIdOcr(frontText, backText) {
  const combined = `${frontText || ""}\n${backText || ""}`.trim();
  const idConfig = identifyGovernmentIdType(frontText, backText) || identifyGovernmentIdTypeFromSubmission(frontText, backText);
  const expiry = extractExpiryDate(combined);
  const dobRaw = firstMatch(combined, [/(?:DATE OF BIRTH|BIRTHDATE|DOB)\s*[:.-]?\s*([^\n]{6,30})/i]);
  const frontClass = idConfig ? classifyGovernmentIdSide({ idType: idConfig.idType, text: frontText }) : null;
  const backClass = idConfig ? classifyGovernmentIdSide({ idType: idConfig.idType, text: backText }) : null;
  const sideIssue = idConfig ? getGovernmentIdSideIssue(frontClass, backClass) : null;
  const advisoryFlags = [];
  if (frontText.trim().length < 15 || backText.trim().length < 10) advisoryFlags.push("LOW_TEXT_YIELD");
  if (sideIssue) advisoryFlags.push(sideIssue);
  if (expiry.found && expiry.isExpired) advisoryFlags.push("POSSIBLY_EXPIRED");
  return {
    extractedName: firstMatch(combined, [/(?:FULL NAME|NAME)\s*[:.-]?\s*([^\n]{3,100})/i]),
    detectedIdType: idConfig?.idType || null,
    idNumber: firstMatch(combined, [/(?:ID|CARD|DOCUMENT|LICENSE|LICENCE|PASSPORT)\s*(?:NO\.?|NUMBER|#)\s*[:.-]?\s*([A-Z0-9-]{4,40})/i]),
    dateOfBirth: dobRaw ? parseDateString(dobRaw) : null,
    expiryDate: expiry.expiresAt || null,
    advisoryFlags,
  };
}

async function bodyToBuffer(body) {
  if (!body) throw new Error("MISSING_OBJECT_BODY");
  if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export class RegistrantIdOcrWorker {
  static start() {
    if (timer) return;
    timer = setInterval(() => void this.drain(), env.registrantId.workerPollMs);
    timer.unref();
    void this.drain();
  }

  static async stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (activeDrain) await activeDrain;
  }

  static drain() {
    if (activeDrain) return activeDrain;
    activeDrain = (async () => {
      for (let i = 0; i < env.registrantId.workerBatchSize; i += 1) {
        const job = await this.claimOne();
        if (!job) break;
        await this.process(job);
      }
    })().catch((error) => logger.error({ err: error }, "[RegistrantIdOCR] Worker cycle failed"))
      .finally(() => { activeDrain = null; });
    return activeDrain;
  }

  static async claimOne() {
    const token = randomUUID();
    const leaseSeconds = Math.max(env.registrantId.workerLeaseSeconds, Math.ceil((env.ocr.timeout * 2) / 1000) + 30);
    const rows = await prisma.$queryRaw`
      WITH candidate AS (
        SELECT "registrant_id_evidence_id"
        FROM "registrant_id_evidence"
        WHERE "front_object_key" IS NOT NULL AND "back_object_key" IS NOT NULL
          AND "ocr_attempt_count" < ${env.registrantId.maxOcrAttempts}
          AND (
            ("ocr_status" = 'PENDING' AND COALESCE("ocr_next_attempt_at", CURRENT_TIMESTAMP) <= CURRENT_TIMESTAMP)
            OR ("ocr_status" = 'PROCESSING' AND "ocr_lease_expires_at" < CURRENT_TIMESTAMP)
          )
        ORDER BY COALESCE("ocr_next_attempt_at", "updated_at"), "registrant_id_evidence_id"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "registrant_id_evidence" AS evidence
      SET "ocr_status" = 'PROCESSING',
          "ocr_processing_token" = ${token}::uuid,
          "ocr_processing_at" = CURRENT_TIMESTAMP,
          "ocr_lease_expires_at" = CURRENT_TIMESTAMP + (${leaseSeconds} * INTERVAL '1 second'),
          "ocr_attempt_count" = "ocr_attempt_count" + 1,
          "ocr_claimed_version" = "version",
          "ocr_claimed_front_key" = "front_object_key",
          "ocr_claimed_back_key" = "back_object_key",
          "updated_at" = CURRENT_TIMESTAMP
      FROM candidate
      WHERE evidence."registrant_id_evidence_id" = candidate."registrant_id_evidence_id"
      RETURNING evidence.*
    `;
    return rows[0] || null;
  }

  static async process(job) {
    const where = {
      id: job.registrant_id_evidence_id,
      ocrStatus: "PROCESSING",
      ocrProcessingToken: job.ocr_processing_token,
      version: job.ocr_claimed_version,
      frontObjectKey: job.ocr_claimed_front_key,
      backObjectKey: job.ocr_claimed_back_key,
    };
    const provider = OcrProviderFactory.create();
    if (!env.ocr.enabled || provider.providerName === "stub") {
      await prisma.registrantIdEvidence.updateMany({
        where,
        data: { ocrStatus: "UNAVAILABLE", ocrErrorCode: "OCR_PROVIDER_UNAVAILABLE", ocrProvider: provider.providerName, ocrProcessingToken: null, ocrProcessingAt: null, ocrLeaseExpiresAt: null, processedAt: new Date() },
      });
      return;
    }

    try {
      const [frontObject, backObject] = await Promise.all([
        RegistrantIdStorageService.download(job.ocr_claimed_front_key),
        RegistrantIdStorageService.download(job.ocr_claimed_back_key),
      ]);
      const [frontBuffer, backBuffer] = await Promise.all([bodyToBuffer(frontObject.Body), bodyToBuffer(backObject.Body)]);
      const [frontCompressed, backCompressed] = await Promise.all([
        ImageCompressionService.compress(frontBuffer, job.front_mime_type),
        ImageCompressionService.compress(backBuffer, job.back_mime_type),
      ]);
      const [frontResult, backResult] = await Promise.all([
        provider.extractText(frontCompressed.compressedBuffer, "image/jpeg"),
        provider.extractText(backCompressed.compressedBuffer, "image/jpeg"),
      ]);
      const frontText = String(frontResult.rawText || "").trim();
      const backText = String(backResult.rawText || "").trim();
      const infrastructureFailure = [frontResult, backResult].some((result) =>
        result.failureType === "INFRASTRUCTURE" || result.httpStatusCode === 408 || Number(result.httpStatusCode) >= 500
      );
      if (infrastructureFailure) {
        await this.retryOrFinish(job, where, "OCR_PROVIDER_UNAVAILABLE", "UNAVAILABLE");
        return;
      }
      const parsed = parseRegistrantIdOcr(frontText, backText);
      const bothSucceeded = Boolean(frontResult.ocrSuccess && backResult.ocrSuccess && frontText && backText);
      const anyText = Boolean(frontText || backText);
      const status = bothSucceeded && !parsed.advisoryFlags.includes("LOW_TEXT_YIELD") ? "COMPLETED" : anyText ? "PARTIAL" : "FAILED";
      await prisma.registrantIdEvidence.updateMany({
        where,
        data: {
          ocrStatus: status,
          ocrProvider: provider.providerName,
          ocrErrorCode: status === "FAILED" ? "OCR_NO_TEXT" : null,
          ocrProcessedVersion: job.ocr_claimed_version,
          extractedName: parsed.extractedName,
          detectedIdType: parsed.detectedIdType,
          idNumber: parsed.idNumber,
          dateOfBirth: parsed.dateOfBirth,
          expiryDate: parsed.expiryDate,
          frontText: frontText || null,
          backText: backText || null,
          advisoryFlags: parsed.advisoryFlags,
          processedAt: new Date(),
          ocrProcessingToken: null,
          ocrProcessingAt: null,
          ocrLeaseExpiresAt: null,
          ocrNextAttemptAt: null,
        },
      });
    } catch (error) {
      const code = error?.code === "REGISTRANT_ID_STORAGE_UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "OCR_PROCESSING_FAILED";
      await this.retryOrFinish(job, where, code, code === "STORAGE_UNAVAILABLE" ? "UNAVAILABLE" : "FAILED");
      logger.warn({ evidenceId: job.registrant_id_evidence_id, code }, "[RegistrantIdOCR] Advisory extraction attempt failed");
    }
  }

  static async retryOrFinish(job, where, errorCode, finalStatus) {
    const exhausted = job.ocr_attempt_count >= env.registrantId.maxOcrAttempts;
    const delayMinutes = Math.min(60, 2 ** Math.max(0, job.ocr_attempt_count - 1));
    await prisma.registrantIdEvidence.updateMany({
      where,
      data: {
        ocrStatus: exhausted ? finalStatus : "PENDING",
        ocrErrorCode: errorCode,
        ocrNextAttemptAt: exhausted ? null : new Date(Date.now() + delayMinutes * 60_000),
        ocrProcessingToken: null,
        ocrProcessingAt: null,
        ocrLeaseExpiresAt: null,
        processedAt: exhausted ? new Date() : null,
      },
    });
  }
}
